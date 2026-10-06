import type { Grid } from './grid'
import { allCells, luminance } from './grid'
import type { Sample } from './types'
import { vecDistance } from './store'

export interface Cell {
  /** 1-based number shown to the reader and the user. */
  n: number
  r: number
  c: number
  x: number
  y: number
  w: number
  h: number
  empty: boolean
  /** Enlarged picture of the cell (data URL). */
  crop: string
  /** Colour fingerprint used for learned matching. */
  vec: number[]
}

const VEC_COLS = 10
const VEC_ROWS = 7
/** Fraction of the cell height used for the fingerprint: the top part, above the stack number. */
const VEC_HEIGHT = 0.65

/**
 * Cut every cell of the grid out of the screenshot.
 * `occupiedOverride` lets the user flip a cell between empty / occupied (key "r,c").
 */
export function extractCells(img: HTMLImageElement, grid: Grid, occupiedOverride: Record<string, boolean> = {}): Cell[] {
  const { L, rgba, W, H } = luminance(img)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  return allCells(grid).map((rect, i) => {
    const empty = occupiedOverride[`${rect.r},${rect.c}`] !== undefined ? !occupiedOverride[`${rect.r},${rect.c}`] : looksEmpty(L, W, H, rect)
    // Enlarge ~3× with hard pixels so small digits stay crisp.
    const scale = Math.max(2, Math.min(4, Math.round(120 / rect.w)))
    canvas.width = Math.round(rect.w * scale)
    canvas.height = Math.round(rect.h * scale)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#16181d'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height)
    return { n: i + 1, ...rect, empty, crop: canvas.toDataURL('image/png'), vec: cellVector(rgba, W, H, rect) }
  })
}

/** An empty slot is a dark, nearly flat square. */
function looksEmpty(L: Float32Array, W: number, H: number, rect: { x: number; y: number; w: number; h: number }) {
  const x0 = Math.max(0, Math.round(rect.x + rect.w * 0.18))
  const x1 = Math.min(W, Math.round(rect.x + rect.w * 0.82))
  const y0 = Math.max(0, Math.round(rect.y + rect.h * 0.18))
  const y1 = Math.min(H, Math.round(rect.y + rect.h * 0.82))
  let n = 0
  let sum = 0
  let sum2 = 0
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const v = L[y * W + x]
      sum += v
      sum2 += v * v
      n++
    }
  if (!n) return true
  const mean = sum / n
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
  return sd < 9 && mean < 70
}

/** Average RGB of a coarse grid over the top of the cell (frame colour included, digits excluded). */
function cellVector(rgba: Uint8ClampedArray, W: number, H: number, rect: { x: number; y: number; w: number; h: number }) {
  const out: number[] = []
  const bw = rect.w / VEC_COLS
  const bh = (rect.h * VEC_HEIGHT) / VEC_ROWS
  for (let j = 0; j < VEC_ROWS; j++)
    for (let i = 0; i < VEC_COLS; i++) {
      const x0 = Math.max(0, Math.floor(rect.x + i * bw))
      const x1 = Math.min(W, Math.max(x0 + 1, Math.floor(rect.x + (i + 1) * bw)))
      const y0 = Math.max(0, Math.floor(rect.y + j * bh))
      const y1 = Math.min(H, Math.max(y0 + 1, Math.floor(rect.y + (j + 1) * bh)))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const k = (y * W + x) * 4
          r += rgba[k]
          g += rgba[k + 1]
          b += rgba[k + 2]
          n++
        }
      out.push(Math.round(r / (n || 1)), Math.round(g / (n || 1)), Math.round(b / (n || 1)))
    }
  return out
}

/** Distance under which a learned sample is trusted, and how clearly it must beat the next-best item. */
const MATCH_MAX = 14
const MATCH_MARGIN = 4

export interface LearnedMatch {
  itemId: string
  distance: number
  /** True when the match is close and unambiguous. */
  sure: boolean
}

export function matchLearned(vec: number[], samples: Sample[]): LearnedMatch | null {
  const bestPerItem = new Map<string, number>()
  for (const s of samples) {
    const d = vecDistance(vec, s.vec)
    if (d < (bestPerItem.get(s.itemId) ?? Infinity)) bestPerItem.set(s.itemId, d)
  }
  const ranked = [...bestPerItem].sort((a, b) => a[1] - b[1])
  if (!ranked.length || ranked[0][1] > MATCH_MAX * 1.6) return null
  const [itemId, distance] = ranked[0]
  const next = ranked[1]?.[1] ?? Infinity
  return { itemId, distance, sure: distance <= MATCH_MAX && next - distance >= MATCH_MARGIN }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Lay out cells as numbered tiles on one or more PNG sheets for the reader.
 * Each sheet stays under the API's ~1568px long edge so nothing gets downscaled.
 */
export async function buildCellSheets(cells: Cell[]): Promise<{ data: string; from: number; to: number }[]> {
  const COLS = 8
  const TILE = 132
  const LABEL = 20
  const PER_SHEET = COLS * 8
  const sheets: { data: string; from: number; to: number }[] = []
  for (let start = 0; start < cells.length; start += PER_SHEET) {
    const chunk = cells.slice(start, start + PER_SHEET)
    const rows = Math.ceil(chunk.length / COLS)
    const canvas = document.createElement('canvas')
    canvas.width = COLS * TILE
    canvas.height = rows * (TILE + LABEL)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0d0e11'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'
    const imgs = await Promise.all(chunk.map((c) => loadImage(c.crop)))
    chunk.forEach((cell, i) => {
      const x = (i % COLS) * TILE
      const y = Math.floor(i / COLS) * (TILE + LABEL)
      ctx.fillStyle = '#ffd54a'
      ctx.fillText(`#${cell.n}`, x + TILE / 2, y + 15)
      ctx.drawImage(imgs[i], x + 4, y + LABEL, TILE - 8, TILE - 8)
    })
    sheets.push({ data: canvas.toDataURL('image/png').split(',')[1], from: chunk[0].n, to: chunk[chunk.length - 1].n })
  }
  return sheets
}

/** Shrink a slot picture to a compact icon (keeps localStorage small). */
export async function toIcon(src: string, size = 64): Promise<string> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, size, size)
  return canvas.toDataURL('image/png')
}
