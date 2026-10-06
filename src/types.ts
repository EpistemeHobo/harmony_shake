export type ItemCategory = 'product' | 'intermediate' | 'raw' | 'group'

export interface Item {
  id: string
  /** English name. */
  name: string
  /** Thai name (as shown in the TH client). */
  nameTh?: string
  category: ItemCategory
  /** For category 'group': any of these items can satisfy the requirement. */
  members?: string[]
  /** User-saved reference icon (data URL); overrides defaultIcon. */
  icon?: string
  /** Bundled icon from bdocodex, e.g. "/icons/salt.webp". */
  defaultIcon?: string
  /** In-game grade: 0 white, 1 green, 2 blue, 3 yellow, 4 orange (slot frame color). */
  grade?: number
  note?: string
  /** bdocodex.com item id. */
  codexId?: number
  /** Other items whose stock counts toward this one, e.g. a blue-grade elixir worth 3 green. */
  stockAliases?: { itemId: string; factor: number }[]
}

export interface Ingredient {
  itemId: string
  qty: number
}

export type CraftMethod = 'Alchemy' | 'Simple Alchemy' | 'Cooking' | 'Simple Cooking' | 'Processing' | 'Other'

export interface Recipe {
  id: string
  output: string
  method: CraftMethod
  /** Average units produced per craft (proc rate included). */
  yield: number
  ingredients: Ingredient[]
  /** bdocodex recipe path, e.g. "recipe/649" or "mrecipe/7674". */
  codex?: string
  /** Alchemy recipe whose own `yield` is used instead of the shared Alchemy average (e.g. Elixir of Edania = 1). */
  fixedYield?: boolean
}

export interface StockEntry {
  qty: number
  updatedAt: number
}

export interface HistoryChange {
  itemId: string
  from: number
  to: number
}

export interface HistoryEntry {
  at: number
  source: 'manual' | 'scan' | 'import'
  changes: HistoryChange[]
}

export interface Settings {
  apiKey: string
  model: string
  targetItem: string
  targetQty: number
  useIntermediateStock: boolean
  /** Average units per normal Alchemy craft, shared by every Alchemy recipe without a fixed yield. */
  alchemyYield: number
  lang: 'th' | 'en'
  /** Colour theme; 'system' follows the operating system's light/dark setting. */
  theme: 'dark' | 'light' | 'system'
}

export interface TokenLogEntry {
  at: number
  /** What made the call, e.g. "scan". */
  kind: string
  /** Model requested in Settings. */
  model: string
  /** Model that actually answered (differs when a refusal fallback ran). */
  servedBy: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  stopReason: string
  durationMs: number
}

/** A storage cell the user confirmed in an audit, kept to recognise the same icon next time. */
export interface Sample {
  itemId: string
  /** Colour fingerprint of the cell (see cells.ts cellVector). */
  vec: number[]
  at: number
}

export interface AppState {
  version: number
  items: Item[]
  recipes: Recipe[]
  stock: Record<string, StockEntry>
  history: HistoryEntry[]
  tokenLog: TokenLogEntry[]
  samples?: Sample[]
  /** One-time data repairs already applied to this browser's data. */
  migrations?: string[]
  settings: Settings
}
