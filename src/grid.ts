/** Slot grid of a storage screenshot, in pixels of the screenshot image. */
export interface Grid {
  left: number
  top: number
  /** Distance from one slot to the next (slot + gap). */
  pitchX: number
  pitchY: number
  cols: number
  rows: number
}

export interface CellRect {
  r: number
  c: number
  x: number
  y: number
  w: number
  h: number
}

export function cellRect(g: Grid, r: number, c: number): CellRect {
  return { r, c, x: g.left + c * g.pitchX, y: g.top + r * g.pitchY, w: g.pitchX, h: g.pitchY }
}

export function allCells(g: Grid): CellRect[] {
  const out: CellRect[] = []
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) out.push(cellRect(g, r, c))
  return out
}

/** Grey-level image data for analysis. */
export function luminance(img: HTMLImageElement): { L: Float32Array; rgba: Uint8ClampedArray; W: number; H: number } {
  const W = img.naturalWidth
  const H = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const rgba = ctx.getImageData(0, 0, W, H).data
  const L = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) L[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  return { L, rgba, W, H }
}

/** Keep only above-average edges so weak texture doesn't count as a line. */
function edgePeaks(profile: Float64Array) {
  const mean = profile.reduce((a, b) => a + b, 0) / profile.length
  return profile.map((v) => Math.max(0, v - mean))
}

/** Dominant repeating spacing of edge lines along one axis (autocorrelation), preferring the fundamental. */
function findPitch(p: Float64Array, minP: number, maxP: number): number | null {
  const n = p.length
  maxP = Math.min(maxP, Math.floor(n / 2))
  if (maxP <= minP) return null
  const scores: number[] = []
  for (let lag = minP; lag <= maxP; lag++) {
    let num = 0
    let den = 0
    for (let i = 0; i + lag < n; i++) {
      num += p[i] * p[i + lag]
      den += p[i] * p[i]
    }
    scores[lag] = den ? num / den : 0
  }
  let best = minP
  for (let lag = minP; lag <= maxP; lag++) if (scores[lag] > scores[best]) best = lag
  // Multiples of the slot spacing (2×, 3×) also correlate; take the smallest divisor that still scores well.
  for (let k = 6; k >= 2; k--) {
    const lag = Math.round(best / k)
    if (lag < minP) continue
    const s = Math.max(scores[lag - 1] ?? 0, scores[lag] ?? 0, scores[lag + 1] ?? 0)
    if (s >= 0.5 * scores[best]) return lag
  }
  return best
}

/**
 * Given an approximate spacing, find the exact sub-pixel spacing, the phase, and the first..last grid line.
 * Edges cut off by a tight crop are recovered: a whole slot that still fits before the first / after the last
 * detected line is counted too.
 */
function fitLines(p: Float64Array, approx: number) {
  const n = p.length
  const peakAt = (x: number) => {
    const i = Math.round(x)
    let m = 0
    for (let k = i - 1; k <= i + 1; k++) if (k >= 0 && k < n) m = Math.max(m, p[k])
    return m
  }
  let pitch = approx
  let offset = 0
  let bestSum = -1
  for (let f = approx - 0.7; f <= approx + 0.7; f += 0.05) {
    for (let o = 0; o < f; o += 0.5) {
      let sum = 0
      for (let x = o; x < n; x += f) sum += peakAt(x)
      if (sum > bestSum) {
        bestSum = sum
        pitch = f
        offset = o
      }
    }
  }
  const lines: { x: number; v: number }[] = []
  for (let x = offset; x < n; x += pitch) lines.push({ x, v: peakAt(x) })
  // A line counts when it is reasonably strong compared to a typical grid line, so one faint border
  // (e.g. a column of dark icons) doesn't split the grid. Extent = first..last such line.
  const sorted = lines.map((l) => l.v).sort((a, b) => b - a)
  const typical = sorted[Math.floor(sorted.length / 4)] || sorted[0]
  const isLine = lines.map((l) => l.v > 0.35 * typical)
  let first = isLine.indexOf(true)
  let last = isLine.lastIndexOf(true)
  if (first < 0) return null
  let start = lines[first].x
  let count = last - first
  if (start >= pitch * 0.85) {
    start -= pitch
    count++
  }
  if (n - lines[last].x >= pitch * 0.85) count++
  if (count < 1) return null
  return { start, count, pitch }
}

/** Automatically locate the slot grid. Returns null when no regular grid is found. */
export function detectGrid(img: HTMLImageElement): Grid | null {
  const { L, W, H } = luminance(img)
  const colProfile = new Float64Array(W)
  const rowProfile = new Float64Array(H)
  for (let y = 1; y < H; y++) {
    for (let x = 1; x < W; x++) {
      const v = L[y * W + x]
      colProfile[x] += Math.abs(v - L[y * W + x - 1])
      rowProfile[y] += Math.abs(v - L[(y - 1) * W + x])
    }
  }
  const px = edgePeaks(colProfile)
  const py = edgePeaks(rowProfile)
  const minP = Math.max(12, Math.round(Math.min(W, H) / 60))
  const maxP = Math.round(Math.min(W, H) / 1.5)
  const pitchX = findPitch(px, minP, maxP)
  const pitchY = findPitch(py, minP, maxP)
  if (!pitchX && !pitchY) return null
  // Slots are square: if the axes disagree, one locked onto a multiple — use the smaller spacing for both.
  let pX = pitchX ?? pitchY!
  let pY = pitchY ?? pitchX!
  if (Math.abs(pX - pY) / Math.min(pX, pY) > 0.1) pX = pY = Math.min(pX, pY)
  const ax = fitLines(px, pX)
  const ay = fitLines(py, pY)
  if (!ax || !ay) return null
  return { left: ax.start, top: ay.start, pitchX: ax.pitch, pitchY: ay.pitch, cols: ax.count, rows: ay.count }
}

/** Fallback when detection fails: one row of square cells across the image, for the user to adjust. */
export function defaultGrid(img: HTMLImageElement): Grid {
  const W = img.naturalWidth
  const H = img.naturalHeight
  const cols = 8
  const pitch = W / cols
  return { left: 0, top: 0, pitchX: pitch, pitchY: pitch, cols, rows: Math.max(1, Math.floor(H / pitch)) }
}

// Grids remembered per screenshot size, so the same UI layout lines up automatically next time.
const TEMPLATE_KEY = 'harmony-shake:grid-templates'

export function loadTemplate(W: number, H: number): Grid | null {
  try {
    const all = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '{}') as Record<string, Grid>
    return all[`${W}x${H}`] ?? null
  } catch {
    return null
  }
}

export function saveTemplate(W: number, H: number, g: Grid) {
  try {
    const all = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '{}') as Record<string, Grid>
    all[`${W}x${H}`] = g
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable: grid just won't be remembered */
  }
}
