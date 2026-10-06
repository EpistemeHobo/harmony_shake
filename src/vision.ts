import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { Item } from './types'
import { logTokens } from './store'
import { cleanText } from './security'

/** What the reader reports for one numbered cell. */
export interface CellReading {
  cell: number
  label: string
  matched_item_id: string
  quantity: number
  quantity_text: string
  confidence: 'high' | 'medium' | 'low'
}

export interface CellScanResult {
  cells: CellReading[]
  notes: string
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cells', 'notes'],
  properties: {
    cells: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cell', 'label', 'matched_item_id', 'quantity', 'quantity_text', 'confidence'],
        properties: {
          cell: { type: 'integer', description: 'The yellow #number above the tile' },
          label: { type: 'string', description: 'At most 4 words: what the item looks like, e.g. "red flask blue frame"' },
          matched_item_id: { type: 'string', description: 'id from the legend, or "" if the item is not in it' },
          quantity: { type: 'integer', description: 'Stack count as a whole number (1 if no number shown)' },
          quantity_text: { type: 'string', description: 'The count exactly as printed, e.g. "12,345" or "196.8K"' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    notes: { type: 'string' },
  },
} as const

const SYSTEM = `You identify Black Desert (Thai or English client) storage slots.
You get cell sheets: each tile is ONE storage slot, cut out and enlarged, with its yellow #number above it. Return exactly one entry per listed cell number.
For each tile: identify the item icon using the numbered reference sheet and its legend, and read the stack quantity printed in white digits at the bottom-right of the tile.
The colored frame around a slot is the item grade (grey/white=0, green=1, blue=2, yellow=3, orange=4). Many items share the same picture and differ only by frame color (e.g. an elixir in a green frame vs. its stronger version in a blue frame) — always check the frame.
Some cells come with a "learned" hint: the user previously confirmed that exact picture as that item. Keep the hinted id unless the tile clearly shows something else.
If the item is not in the legend, set matched_item_id to "" and give a short label.
Read quantities digit by digit; never invent a number. Big stacks are abbreviated: "196.8K" = 196800, "1.2M" = 1200000 — convert to a whole number, copy the printed text into quantity_text, and use confidence at most "medium" for rounded values.
Keep entries short (label at most 4 words) and do not explain your reasoning.`

export async function fileToImageBlock(file: Blob): Promise<{ media: 'image/png' | 'image/jpeg'; data: string; url: string }> {
  const bitmap = await createImageBitmap(file)
  const MAX = 2400
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  // PNG keeps the small stack digits crisp; fall back to JPEG if the file is too big.
  let url = canvas.toDataURL('image/png')
  let media: 'image/png' | 'image/jpeg' = 'image/png'
  if (url.length > 6_500_000) {
    url = canvas.toDataURL('image/jpeg', 0.92)
    media = 'image/jpeg'
  }
  return { media, data: url.split(',')[1], url }
}

/** Ask Claude to identify pre-cut, numbered cells. `hints` maps cell number -> learned item id. */
export async function scanCells(opts: {
  apiKey: string
  model: string
  items: Item[]
  sheets: { data: string; from: number; to: number }[]
  cellNumbers: number[]
  hints: Map<number, string>
}): Promise<CellScanResult> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })

  const content: BetaContentBlockParam[] = []
  const ref = await buildReferenceSheet(opts.items)
  if (ref) {
    content.push({ type: 'text', text: `Reference sheet legend (# = id | English | Thai | grade):\n${ref.legend}` })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: ref.data } })
  } else {
    const known = opts.items
      .filter((i) => i.category !== 'group')
      .map((i) => `${i.id} | ${i.name}${i.nameTh ? ` | ${i.nameTh}` : ''}`)
      .join('\n')
    content.push({ type: 'text', text: `Known items (id | English | Thai):\n${known}` })
  }
  for (const sheet of opts.sheets) {
    content.push({ type: 'text', text: `Cell sheet: cells #${sheet.from}–#${sheet.to}` })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: sheet.data } })
  }
  const hintLines = [...opts.hints].map(([n, id]) => `#${n}: learned = ${id}`)
  content.push({
    type: 'text',
    text:
      `Cells to report: ${opts.cellNumbers.map((n) => `#${n}`).join(', ')}.` +
      (hintLines.length ? `\nLearned hints:\n${hintLines.join('\n')}` : ''),
  })

  const started = Date.now()
  // Allow a large output budget and stream it (the SDK requires streaming for long responses).
  const response = await client.beta.messages
    .stream({
      model: opts.model,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }],
    })
    .finalMessage()

  logTokens({
    at: started,
    kind: 'scan',
    model: opts.model,
    servedBy: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    stopReason: response.stop_reason ?? '',
    durationMs: Date.now() - started,
  })

  if (response.stop_reason === 'refusal') throw new Error('The model declined to read this image.')
  if (response.stop_reason === 'max_tokens') throw new Error('Response was cut off (64k output tokens) — split the screenshot into two halves.')
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  const parsed = JSON.parse(text) as CellScanResult
  if (!Array.isArray(parsed.cells)) throw new Error('Unexpected response shape')
  // Treat the model's answer as untrusted data: keep only well-formed, size-capped fields.
  parsed.cells = parsed.cells.slice(0, 2000).map((c) => ({
    cell: Number.isInteger(c.cell) ? c.cell : -1,
    label: cleanText(c.label, 80),
    matched_item_id: cleanText(c.matched_item_id, 120),
    quantity: Number.isFinite(c.quantity) ? Math.max(0, Math.min(1e12, Math.round(c.quantity))) : 0,
    quantity_text: cleanText(c.quantity_text, 20),
    confidence: (['high', 'medium', 'low'] as const).includes(c.confidence) ? c.confidence : 'low',
  }))
  parsed.notes = cleanText(parsed.notes, 500)
  return parsed
}

const GRADE_FRAME = ['#9a9a9a', '#5fae3e', '#3b8fd6', '#d9a21e', '#e0662a']

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Draw every item icon (user-saved icon, else bundled bdocodex icon) into one numbered PNG grid,
 * so a scan sends a single reference image instead of ~200 small ones.
 */
export async function buildReferenceSheet(items: Item[]): Promise<{ data: string; url: string; legend: string } | null> {
  const list = items.filter((i) => i.category !== 'group' && (i.icon || i.defaultIcon))
  if (!list.length) return null
  const imgs = await Promise.all(list.map((i) => loadImage((i.icon || i.defaultIcon)!)))
  const COLS = 14
  const ICON = 44
  const CELL_W = 56
  const CELL_H = 66
  const canvas = document.createElement('canvas')
  canvas.width = COLS * CELL_W
  canvas.height = Math.ceil(list.length / COLS) * CELL_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#16181d'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  const legend: string[] = []
  list.forEach((it, n) => {
    const x = (n % COLS) * CELL_W + (CELL_W - ICON) / 2
    const y = Math.floor(n / COLS) * CELL_H + 4
    const img = imgs[n]
    if (img) ctx.drawImage(img, x, y, ICON, ICON)
    ctx.strokeStyle = GRADE_FRAME[it.grade ?? 0] ?? GRADE_FRAME[0]
    ctx.lineWidth = 2
    ctx.strokeRect(x - 1, y - 1, ICON + 2, ICON + 2)
    ctx.fillStyle = '#fff'
    ctx.fillText(String(n + 1), x + ICON / 2, y + ICON + 15)
    legend.push(`#${n + 1} = ${it.id} | ${it.name}${it.nameTh ? ` | ${it.nameTh}` : ''} | grade ${it.grade ?? 0}`)
  })
  const url = canvas.toDataURL('image/png')
  return { data: url.split(',')[1], url, legend: legend.join('\n') }
}

/** Crop a region of an image (natural pixel coords) into a small PNG data URL for use as a reference icon. */
export function cropIcon(img: HTMLImageElement, x: number, y: number, w: number, h: number, size = 64): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, x, y, w, h, 0, 0, size, size)
  return canvas.toDataURL('image/png')
}
