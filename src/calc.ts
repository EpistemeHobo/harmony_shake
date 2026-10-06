import type { AppState, Item, Recipe } from './types'

export interface CraftStep {
  itemId: string
  /** Total units the tree asked for. */
  needed: number
  /** Units covered by items already in storage. */
  fromStock: number
  /** Number of crafts to perform. */
  crafts: number
  /** Expected units produced by those crafts (crafts × yield). */
  produced: number
  depth: number
}

export interface MaterialLine {
  itemId: string
  required: number
  inStock: number
  lacking: number
  /** For groups: units covered by crafting the group's base item instead (e.g. filtering water). */
  crafted?: number
}

export interface CalcResult {
  steps: CraftStep[]
  materials: MaterialLine[]
  complete: boolean
}

const MAX_DEPTH = 20

/** Largest per-craft quantity any recipe asks for, per ingredient group (cached per recipe list). */
const groupNeedCache = new WeakMap<Recipe[], Map<string, number>>()
function groupNeeds(recipes: Recipe[]): Map<string, number> {
  let m = groupNeedCache.get(recipes)
  if (!m) {
    m = new Map()
    for (const r of recipes) for (const g of r.ingredients) if (g.qty > 0) m.set(g.itemId, Math.max(m.get(g.itemId) ?? 0, g.qty))
    groupNeedCache.set(recipes, m)
  }
  return m
}

/**
 * How many basic units one item of `worth` really covers when a craft needs `need` units.
 * Items can't be split, so each craft rounds up to whole items and leftover worth is wasted:
 * need 4 → a Special mushroom (worth 216) covers 4 (one craft), a Distilled Water (worth 2) for need 3 covers 1.5.
 */
export function usableWorth(worth: number, need: number): number {
  if (!(need > 0) || !(worth > 0)) return worth
  return need / Math.ceil(need / worth)
}

/**
 * Effective stock: own qty + weighted aliases (e.g. a higher-grade elixir = 3 base).
 * For ingredient groups each member counts by the worth it can actually use per craft (see usableWorth),
 * estimated with the group's largest per-craft need. Plans don't use this estimate: calculate() assigns
 * items to each recipe's real per-craft need (groupShortfall).
 */
export function stockOf(state: AppState, itemId: string, itemsById: Map<string, Item>): number {
  const item = itemsById.get(itemId)
  let total = state.stock[itemId]?.qty ?? 0
  const factors = new Map((item?.stockAliases ?? []).map((a) => [a.itemId, a.factor]))
  if (item?.category === 'group') {
    const need = groupNeeds(state.recipes).get(itemId) ?? 0
    const worth = (id: string) => usableWorth(factors.get(id) ?? 1, need)
    for (const m of item.members ?? []) total += stockOf(state, m, itemsById) * worth(m)
    for (const [id] of factors) if (!item.members?.includes(id)) total += (state.stock[id]?.qty ?? 0) * worth(id)
  } else {
    for (const [id, f] of factors) total += (state.stock[id]?.qty ?? 0) * f
  }
  return Math.floor(total)
}

/** Units one craft produces: normal Alchemy uses the shared average from Settings unless the recipe is fixed. */
export function effectiveYield(recipe: Recipe, alchemyYield: number | undefined): number {
  const y = recipe.method === 'Alchemy' && !recipe.fixedYield && alchemyYield && alchemyYield > 0 ? alchemyYield : recipe.yield
  return y > 0 ? y : 1
}

/** Items in a group as (worth, quantity), highest worth first. */
function groupItems(state: AppState, group: Item, itemsById: Map<string, Item>) {
  const factors = new Map((group.stockAliases ?? []).map((a) => [a.itemId, a.factor]))
  const ids = new Set([...(group.members ?? []), ...factors.keys()])
  const list = [...ids].map((id) => ({ worth: factors.get(id) ?? 1, qty: stockOf(state, id, itemsById) }))
  const own = state.stock[group.id]?.qty ?? 0
  if (own) list.push({ worth: 1, qty: own })
  return list.filter((x) => x.qty > 0).sort((a, b) => b.worth - a.worth)
}

/**
 * Assign a group's items to each use (per-craft need × crafts). Each craft is filled with whole items of one
 * kind, highest worth first, biggest needs first; leftover worth on an item is wasted (it can't be split).
 * Returns the units still missing and an estimate of what's left over (in basic units).
 */
function groupShortfall(state: AppState, group: Item, itemsById: Map<string, Item>, demands: { n: number; units: number }[]) {
  const items = groupItems(state, group, itemsById).map((x) => ({ ...x }))
  let lacking = 0
  for (const d of [...demands].sort((a, b) => b.n - a.n)) {
    let crafts = Math.ceil(d.units / d.n - 1e-9)
    for (const it of items) {
      if (crafts <= 0) break
      const perCraft = Math.ceil(d.n / it.worth)
      const use = Math.min(crafts, Math.floor(it.qty / perCraft))
      it.qty -= use * perCraft
      crafts -= use
    }
    lacking += Math.max(0, crafts) * d.n
  }
  const maxN = Math.max(...demands.map((d) => d.n))
  const leftover = Math.floor(items.reduce((sum, it) => sum + it.qty * usableWorth(it.worth, maxN), 0))
  return { lacking: Math.min(lacking, demands.reduce((a, d) => a + d.units, 0)), leftover }
}

export function recipeIndex(recipes: Recipe[]): Map<string, Recipe> {
  const map = new Map<string, Recipe>()
  for (const r of recipes) if (!map.has(r.output)) map.set(r.output, r)
  return map
}

export function calculate(state: AppState, targetId: string, qty: number, useIntermediateStock: boolean): CalcResult {
  const itemsById = new Map(state.items.map((i) => [i.id, i]))
  const recipeByOutput = recipeIndex(state.recipes)

  const pool = new Map<string, number>() // remaining intermediate stock
  const surplus = new Map<string, number>() // leftover output from earlier crafts
  const stepMap = new Map<string, CraftStep>()
  const raw = new Map<string, number>()
  const groupDemands = new Map<string, { n: number; units: number }[]>() // per-craft need of every group use

  const need = (itemId: string, amount: number, depth: number, usePool = true, perCraft?: number) => {
    if (amount <= 0) return
    const recipe = recipeByOutput.get(itemId)
    if (!recipe || depth > MAX_DEPTH) {
      raw.set(itemId, (raw.get(itemId) ?? 0) + amount)
      if (itemsById.get(itemId)?.category === 'group') {
        const list = groupDemands.get(itemId) ?? []
        list.push({ n: perCraft && perCraft > 0 ? perCraft : 1, units: amount })
        groupDemands.set(itemId, list)
      }
      return
    }
    let step = stepMap.get(itemId)
    if (!step) {
      step = { itemId, needed: 0, fromStock: 0, crafts: 0, produced: 0, depth }
      stepMap.set(itemId, step)
    }
    step.depth = Math.max(step.depth, depth)
    step.needed += amount

    let remaining = amount
    const extra = surplus.get(itemId) ?? 0
    const fromSurplus = Math.min(extra, remaining)
    surplus.set(itemId, extra - fromSurplus)
    remaining -= fromSurplus

    // Intermediates already in storage reduce what must be crafted (never the final product itself).
    if (useIntermediateStock && usePool && depth > 0 && remaining > 0) {
      if (!pool.has(itemId)) pool.set(itemId, stockOf(state, itemId, itemsById))
      const take = Math.min(pool.get(itemId)!, remaining)
      pool.set(itemId, pool.get(itemId)! - take)
      step.fromStock += take
      remaining -= take
    }
    if (remaining <= 0) return

    const y = effectiveYield(recipe, state.settings?.alchemyYield)
    const crafts = Math.ceil(remaining / y - 1e-9)
    step.crafts += crafts
    step.produced += crafts * y
    surplus.set(itemId, (surplus.get(itemId) ?? 0) + crafts * y - remaining)
    for (const ing of recipe.ingredients) need(ing.itemId, ing.qty * crafts, depth + 1, true, ing.qty)
  }

  need(targetId, qty, 0)

  // Groups: what the items really cover once each craft is rounded up to whole items.
  const groupCover = new Map<string, { lacking: number; leftover: number }>()
  const coverOf = (id: string) => {
    const g = itemsById.get(id)
    const demands = groupDemands.get(id)
    if (!g || !demands?.length) return null
    const r = groupShortfall(state, g, itemsById, demands)
    groupCover.set(id, r)
    return r
  }

  // A group short on stock whose base member is craftable (e.g. Purified Water): craft the shortfall.
  // Its own stock is already counted in the group, so the intermediate pool is skipped.
  const crafted = new Map<string, number>()
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (const [id, req] of [...raw]) {
      const it = itemsById.get(id)
      if (it?.category !== 'group') continue
      const base = it.members?.find((m) => recipeByOutput.has(m))
      if (!base) continue
      const cover = coverOf(id)
      const short = (cover ? cover.lacking : req - stockOf(state, id, itemsById)) - (crafted.get(id) ?? 0)
      if (short > 0) {
        crafted.set(id, (crafted.get(id) ?? 0) + short)
        need(base, short, Math.max(0, ...[...stepMap.values()].map((x) => x.depth)) + 1, false)
        changed = true
      }
    }
    if (!changed) break
  }

  const materials: MaterialLine[] = [...raw.entries()].map(([itemId, required]) => {
    const c = crafted.get(itemId) ?? 0
    const cover = groupCover.get(itemId) ?? coverOf(itemId)
    if (cover) {
      // Groups: "in stock" = what the items cover for this plan + an estimate of what's left over.
      const lacking = Math.max(0, cover.lacking - c)
      return { itemId, required, inStock: required - cover.lacking + cover.leftover, lacking, crafted: c || undefined }
    }
    const inStock = stockOf(state, itemId, itemsById)
    return { itemId, required, inStock, lacking: Math.max(0, required - inStock - c), crafted: c || undefined }
  })
  materials.sort((a, b) => b.lacking - a.lacking || a.itemId.localeCompare(b.itemId))

  const steps = [...stepMap.values()].sort((a, b) => a.depth - b.depth)
  return { steps, materials, complete: materials.every((m) => m.lacking === 0) }
}

/** Largest N that can be crafted with current stock (exponential + binary search). */
export function maxCraftable(state: AppState, targetId: string, useIntermediateStock: boolean): number {
  const ok = (n: number) => calculate(state, targetId, n, useIntermediateStock).complete
  if (!ok(1)) return 0
  let lo = 1
  let hi = 2
  while (hi <= 1_000_000 && ok(hi)) {
    lo = hi
    hi *= 2
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (ok(mid)) lo = mid
    else hi = mid
  }
  return lo
}
