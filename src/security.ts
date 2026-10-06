import type { AppState, HistoryEntry, Item, Recipe, Sample, StockEntry } from './types'

/**
 * Input hardening for anything that can come from outside the app's own code:
 * imported backup files, data saved in localStorage, and the screenshot reader's answers.
 * React already escapes text, so the risks handled here are URLs (img src / links), oversized data,
 * and unexpected shapes.
 */

const MAX_TEXT = 300
const MAX_ICON_BYTES = 400_000 // data URL length; real icons are ~5–20 KB

const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/
const SAFE_LOCAL_ICON = /^\/icons\/[a-z0-9-]+\.(png|webp|jpg|jpeg)(\?v=\d+)?$/

/** Only base64 image data or a bundled /icons/ file may be used as an <img> source. */
export function safeImageSrc(url: unknown): string | undefined {
  if (typeof url !== 'string' || url.length > MAX_ICON_BYTES) return undefined
  return SAFE_DATA_IMAGE.test(url) || SAFE_LOCAL_ICON.test(url) ? url : undefined
}

/** bdocodex item ids are plain positive integers. */
export function safeCodexId(id: unknown): number | undefined {
  return typeof id === 'number' && Number.isInteger(id) && id > 0 && id < 100_000_000 ? id : undefined
}

export function cleanText(v: unknown, max = MAX_TEXT): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

const isId = (v: unknown): v is string => typeof v === 'string' && /^[\p{L}\p{N}-]{1,120}$/u.test(v)
const num = (v: unknown, min: number, max: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt
const arr = <T>(v: unknown, max: number): T[] => (Array.isArray(v) ? (v.slice(0, max) as T[]) : [])

const CATEGORIES = ['product', 'intermediate', 'raw', 'group'] as const
const METHODS = ['Alchemy', 'Simple Alchemy', 'Cooking', 'Simple Cooking', 'Processing', 'Other'] as const

function cleanItem(raw: unknown): Item | null {
  const i = raw as Record<string, unknown>
  if (!i || !isId(i.id)) return null
  const item: Item = {
    id: i.id,
    name: cleanText(i.name) || i.id,
    category: CATEGORIES.includes(i.category as Item['category']) ? (i.category as Item['category']) : 'raw',
  }
  if (i.nameTh) item.nameTh = cleanText(i.nameTh)
  if (i.note) item.note = cleanText(i.note, 1000)
  const icon = safeImageSrc(i.icon)
  if (icon) item.icon = icon
  const defaultIcon = safeImageSrc(i.defaultIcon)
  if (defaultIcon) item.defaultIcon = defaultIcon
  if (typeof i.grade === 'number') item.grade = num(i.grade, 0, 5, 0)
  const codexId = safeCodexId(i.codexId)
  if (codexId) item.codexId = codexId
  const members = arr<unknown>(i.members, 50).filter(isId)
  if (members.length) item.members = members
  const aliases = arr<Record<string, unknown>>(i.stockAliases, 50)
    .filter((a) => a && isId(a.itemId))
    .map((a) => ({ itemId: a.itemId as string, factor: num(a.factor, 0, 1000, 1) }))
  if (aliases.length) item.stockAliases = aliases
  return item
}

function cleanRecipe(raw: unknown): Recipe | null {
  const r = raw as Record<string, unknown>
  if (!r || !isId(r.id) || !isId(r.output)) return null
  return {
    id: r.id,
    output: r.output,
    method: METHODS.includes(r.method as Recipe['method']) ? (r.method as Recipe['method']) : 'Other',
    yield: num(r.yield, 0.01, 1000, 1),
    ingredients: arr<Record<string, unknown>>(r.ingredients, 50)
      .filter((g) => g && isId(g.itemId))
      .map((g) => ({ itemId: g.itemId as string, qty: num(g.qty, 0, 1_000_000, 1) })),
    ...(typeof r.codex === 'string' && /^m?recipe\/\d+$/.test(r.codex) ? { codex: r.codex } : {}),
    ...(typeof r.fixedYield === 'boolean' ? { fixedYield: r.fixedYield } : {}),
  }
}

/**
 * Validate and clean an imported backup. Unknown fields are dropped, sizes are capped,
 * and an API key is never taken from a file.
 */
export function sanitizeImport(raw: unknown): Omit<AppState, 'settings'> & { settings: Partial<AppState['settings']> } {
  const s = raw as Record<string, unknown>
  if (!s || typeof s !== 'object' || !Array.isArray(s.items) || !Array.isArray(s.recipes) || typeof s.stock !== 'object' || !s.stock) {
    throw new Error('Not a Harmony Shake backup file')
  }
  const items = arr<unknown>(s.items, 5000).map(cleanItem).filter((x): x is Item => !!x)
  const recipes = arr<unknown>(s.recipes, 5000).map(cleanRecipe).filter((x): x is Recipe => !!x)

  const stock: Record<string, StockEntry> = {}
  for (const [id, e] of Object.entries(s.stock as Record<string, unknown>).slice(0, 10_000)) {
    const entry = e as Record<string, unknown>
    if (isId(id) && entry && typeof entry === 'object') stock[id] = { qty: Math.round(num(entry.qty, 0, 1e12, 0)), updatedAt: num(entry.updatedAt, 0, 1e15, 0) }
  }

  const history = arr<Record<string, unknown>>(s.history, 300)
    .filter((h) => h && typeof h === 'object')
    .map((h) => ({
      at: num(h.at, 0, 1e15, 0),
      source: (['manual', 'scan', 'import'].includes(h.source as string) ? h.source : 'import') as HistoryEntry['source'],
      changes: arr<Record<string, unknown>>(h.changes, 1000)
        .filter((c) => c && isId(c.itemId))
        .map((c) => ({ itemId: c.itemId as string, from: num(c.from, 0, 1e12, 0), to: num(c.to, 0, 1e12, 0) })),
    }))

  const samples = arr<Record<string, unknown>>(s.samples, 5000)
    .filter((x) => x && isId(x.itemId) && Array.isArray(x.vec) && (x.vec as unknown[]).length <= 1000)
    .map((x) => ({ itemId: x.itemId as string, vec: (x.vec as unknown[]).map((v) => num(v, 0, 255, 0)), at: num(x.at, 0, 1e15, 0) }) as Sample)

  const st = (s.settings ?? {}) as Record<string, unknown>
  const settings: Partial<AppState['settings']> = {
    ...(['th', 'en'].includes(st.lang as string) ? { lang: st.lang as 'th' | 'en' } : {}),
    ...(['dark', 'light', 'system'].includes(st.theme as string) ? { theme: st.theme as 'dark' | 'light' | 'system' } : {}),
    ...(typeof st.model === 'string' && /^claude-[a-z0-9-]{1,60}$/.test(st.model) ? { model: st.model } : {}),
    ...(isId(st.targetItem) ? { targetItem: st.targetItem } : {}),
    ...(typeof st.targetQty === 'number' ? { targetQty: Math.round(num(st.targetQty, 1, 1_000_000, 1)) } : {}),
    ...(typeof st.useIntermediateStock === 'boolean' ? { useIntermediateStock: st.useIntermediateStock } : {}),
    ...(typeof st.alchemyYield === 'number' ? { alchemyYield: num(st.alchemyYield, 0.01, 100, 3) } : {}),
  }

  return {
    version: Math.round(num(s.version, 0, 1e6, 0)),
    items,
    recipes,
    stock,
    history,
    tokenLog: [],
    samples,
    migrations: arr<unknown>(s.migrations, 100).filter((m): m is string => typeof m === 'string' && m.length < 80),
    settings,
  }
}
