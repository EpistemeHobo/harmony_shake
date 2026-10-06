import { useSyncExternalStore } from 'react'
import type { AppState, HistoryEntry, Item, Recipe, Sample, Settings, TokenLogEntry } from './types'
import { SEED_ITEMS, SEED_RECIPES, SEED_VERSION } from './seed'
import { sanitizeImport } from './security'

const KEY = 'harmony-shake:v1'
const MAX_HISTORY = 300
const MAX_TOKEN_LOG = 1000

const defaultSettings: Settings = {
  apiKey: '',
  model: 'claude-opus-5-5',
  targetItem: 'party-harmony-draught-edania',
  targetQty: 10,
  useIntermediateStock: true,
  alchemyYield: 3,
  theme: 'dark',
  lang: 'th',
}

function freshState(): AppState {
  return {
    version: SEED_VERSION,
    items: structuredClone(SEED_ITEMS),
    recipes: structuredClone(SEED_RECIPES),
    stock: {},
    history: [],
    tokenLog: [],
    settings: { ...defaultSettings },
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as AppState
    const state = { ...freshState(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } }
    // Icon files can change without a seed version bump (e.g. icons written to public/icons/): always follow the seed.
    const seedIcons = new Map(SEED_ITEMS.map((i) => [i.id, i.defaultIcon]))
    state.items = state.items.map((i) => (seedIcons.get(i.id) && seedIcons.get(i.id) !== i.defaultIcon?.split('?')[0] ? { ...i, defaultIcon: seedIcons.get(i.id) } : i))
    // New seed data: add items/recipes the user doesn't have yet, keep their edits.
    if ((parsed.version ?? 0) < SEED_VERSION) {
      // Fill in new reference data (icons, grades, codex ids) on items the user already has.
      const seedById = new Map(SEED_ITEMS.map((i) => [i.id, i]))
      state.items = state.items.map((i) => {
        const s = seedById.get(i.id)
        if (!s) return i
        // Union of stock equivalences (e.g. blue grade = 3 green); the user's own factors win.
        const aliases = [...(i.stockAliases ?? [])]
        for (const a of s.stockAliases ?? []) if (!aliases.some((x) => x.itemId === a.itemId)) aliases.push(a)
        return {
          ...i,
          defaultIcon: s.defaultIcon,
          grade: i.grade ?? s.grade,
          codexId: i.codexId ?? s.codexId,
          stockAliases: aliases.length ? aliases : undefined,
        }
      })
      const ids = new Set(state.items.map((i) => i.id))
      state.items = [...state.items, ...SEED_ITEMS.filter((i) => !ids.has(i.id))]
      // A recipe whose source changed on bdocodex (different codex recipe id) is replaced;
      // recipes the user edited but that still point at the same source are kept.
      const seedByOutput = new Map(SEED_RECIPES.map((r) => [r.output, r]))
      state.recipes = state.recipes.map((r) => {
        const s = seedByOutput.get(r.output)
        if (s && s.codex && r.codex && s.codex !== r.codex) return structuredClone(s)
        return s && s.fixedYield !== undefined && r.fixedYield === undefined ? { ...r, fixedYield: s.fixedYield } : r
      })
      const outs = new Set(state.recipes.map((r) => r.output))
      state.recipes = [...state.recipes, ...SEED_RECIPES.filter((r) => !outs.has(r.output))]
      state.version = SEED_VERSION
    }
    // One-time repairs (each runs once per browser, then is remembered so later user edits stay).
    const done = new Set(state.migrations ?? [])
    if (!done.has('party-recipe-simple-alchemy')) {
      // The final [Party] Harmony Draught recipe is Simple Alchemy, exactly 1 per craft (bdocodex mrecipe/7677).
      const seedParty = SEED_RECIPES.find((r) => r.output === 'party-harmony-draught-edania')
      if (seedParty) {
        const others = state.recipes.filter((r) => r.output !== seedParty.output)
        state.recipes = [structuredClone(seedParty), ...others]
      }
      done.add('party-recipe-simple-alchemy')
      state.migrations = [...done]
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
      } catch {
        /* storage unavailable */
      }
    }
    return state
  } catch {
    return freshState()
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function commit(next: AppState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save', e)
  }
  listeners.forEach((l) => l())
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function getState() {
  return state
}

/** Set (mode 'set') or add to (mode 'add') stock quantities, recording history. */
export function applyStock(updates: Record<string, number>, source: HistoryEntry['source'], mode: 'set' | 'add' = 'set') {
  const stock = { ...state.stock }
  const changes: HistoryEntry['changes'] = []
  const now = Date.now()
  for (const [itemId, value] of Object.entries(updates)) {
    if (!Number.isFinite(value)) continue
    const from = stock[itemId]?.qty ?? 0
    const to = Math.max(0, Math.round(mode === 'add' ? from + value : value))
    if (from === to) continue
    stock[itemId] = { qty: to, updatedAt: now }
    changes.push({ itemId, from, to })
  }
  if (!changes.length) return 0
  const history = [{ at: now, source, changes }, ...state.history].slice(0, MAX_HISTORY)
  commit({ ...state, stock, history })
  return changes.length
}

export function logTokens(entry: TokenLogEntry) {
  commit({ ...state, tokenLog: [entry, ...(state.tokenLog ?? [])].slice(0, MAX_TOKEN_LOG) })
}

export function clearTokenLog() {
  commit({ ...state, tokenLog: [] })
}

const MAX_SAMPLES_PER_ITEM = 8

/** Remember confirmed cells; skips near-duplicates and keeps the newest few per item. */
export function addSamples(list: Sample[]) {
  let samples = [...(state.samples ?? [])]
  let added = 0
  for (const s of list) {
    const same = samples.filter((x) => x.itemId === s.itemId)
    if (same.some((x) => vecDistance(x.vec, s.vec) < 3)) continue
    samples.push(s)
    added++
    if (same.length + 1 > MAX_SAMPLES_PER_ITEM) {
      const oldest = same.sort((a, b) => a.at - b.at)[0]
      samples = samples.filter((x) => x !== oldest)
    }
  }
  if (added) commit({ ...state, samples })
  return added
}

export function clearSamples(itemId?: string) {
  commit({ ...state, samples: itemId ? (state.samples ?? []).filter((s) => s.itemId !== itemId) : [] })
}

/** Mean absolute difference between two fingerprints (0-255 scale). */
export function vecDistance(a: number[], b: number[]) {
  if (a.length !== b.length) return Infinity
  let d = 0
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i])
  return d / a.length
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } })
}

export function upsertItem(item: Item) {
  const exists = state.items.some((i) => i.id === item.id)
  commit({ ...state, items: exists ? state.items.map((i) => (i.id === item.id ? item : i)) : [...state.items, item] })
}

/** Point items at new icon files (e.g. just written to public/icons/) and drop in-browser overrides. */
export function setFileIcons(paths: Record<string, string>) {
  if (!Object.keys(paths).length) return
  commit({ ...state, items: state.items.map((i) => (paths[i.id] ? { ...i, defaultIcon: paths[i.id], icon: undefined } : i)) })
}

/** Set several items' icons at once (data URLs). */
export function setIcons(icons: Record<string, string>) {
  if (!Object.keys(icons).length) return
  commit({ ...state, items: state.items.map((i) => (icons[i.id] ? { ...i, icon: icons[i.id] } : i)) })
}

export function deleteItem(id: string) {
  commit({
    ...state,
    items: state.items.filter((i) => i.id !== id),
    recipes: state.recipes
      .filter((r) => r.output !== id)
      .map((r) => ({ ...r, ingredients: r.ingredients.filter((g) => g.itemId !== id) })),
  })
}

export function upsertRecipe(recipe: Recipe) {
  const exists = state.recipes.some((r) => r.id === recipe.id)
  commit({ ...state, recipes: exists ? state.recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [...state.recipes, recipe] })
}

export function deleteRecipe(id: string) {
  commit({ ...state, recipes: state.recipes.filter((r) => r.id !== id) })
}

/** Restore default items/recipes; keeps stock, history, settings and saved icons. */
export function resetRecipes() {
  const icons = new Map(state.items.filter((i) => i.icon).map((i) => [i.id, i.icon]))
  const items = structuredClone(SEED_ITEMS).map((i) => ({ ...i, icon: icons.get(i.id) ?? i.icon }))
  commit({ ...state, items, recipes: structuredClone(SEED_RECIPES), version: SEED_VERSION })
}

export function exportJson(): string {
  return JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '' } }, null, 2)
}

export function importJson(text: string) {
  if (text.length > 30_000_000) throw new Error('File is too large to be a Harmony Shake backup')
  // Validate and clean everything from the file; the API key is never taken from a file.
  const clean = sanitizeImport(JSON.parse(text))
  commit({ ...clean, tokenLog: state.tokenLog ?? [], settings: { ...defaultSettings, ...clean.settings, apiKey: state.settings.apiKey } })
}

export function slugify(name: string) {
  const s = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  return s || `item-${Date.now()}`
}
