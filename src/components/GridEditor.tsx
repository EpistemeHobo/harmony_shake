import { useRef, useState } from 'react'
import type { Grid } from '../grid'
import type { Cell } from '../cells'
import { useT } from '../i18n'

const ZOOMS = [1, 1.5, 2, 3, 4, 6]
const ZOOM_KEY = 'harmony-shake:crop-zoom'

function loadZoom(): number {
  try {
    return Number(localStorage.getItem(ZOOM_KEY)) || 0
  } catch {
    return 0
  }
}
function saveZoom(z: number) {
  try {
    localStorage.setItem(ZOOM_KEY, String(z))
  } catch {
    /* storage unavailable: zoom just won't persist */
  }
}

/**
 * Shows the detected slot grid over the screenshot. Drag the two corner handles to fit it,
 * change the column/row count, and click a cell to mark it empty / occupied.
 */
export default function GridEditor({
  url,
  width,
  height,
  grid,
  cells,
  source,
  onChange,
  onToggleCell,
  onAutoDetect,
}: {
  url: string
  width: number
  height: number
  grid: Grid
  cells: Cell[]
  source: string
  onChange: (g: Grid) => void
  onToggleCell: (r: number, c: number) => void
  onAutoDetect: () => void
}) {
  const t = useT()
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<null | 'tl' | 'br'>(null)
  const [zoom, setZoom] = useState(() => loadZoom() || (width < 500 ? 3 : width < 900 ? 2 : 1))
  const changeZoom = (z: number) => {
    setZoom(z)
    saveZoom(z)
  }

  const right = grid.left + grid.cols * grid.pitchX
  const bottom = grid.top + grid.rows * grid.pitchY
  const occupied = cells.filter((c) => !c.empty).length

  const toImage = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height }
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    const p = toImage(e)
    if (drag === 'tl') {
      // Move the top-left corner; the bottom-right corner stays put, slot size follows.
      const pitchX = Math.max(4, (right - p.x) / grid.cols)
      const pitchY = Math.max(4, (bottom - p.y) / grid.rows)
      onChange({ ...grid, left: right - pitchX * grid.cols, top: bottom - pitchY * grid.rows, pitchX, pitchY })
    } else {
      onChange({ ...grid, pitchX: Math.max(4, (p.x - grid.left) / grid.cols), pitchY: Math.max(4, (p.y - grid.top) / grid.rows) })
    }
  }

  const count = (key: 'cols' | 'rows', delta: number) => onChange({ ...grid, [key]: Math.max(1, grid[key] + delta) })
  const nudge = (dx: number, dy: number) => onChange({ ...grid, left: grid.left + dx, top: grid.top + dy })

  const handle = Math.max(4, Math.min(grid.pitchX, grid.pitchY) * 0.22)
  const stroke = Math.max(0.6, width / 900)

  return (
    <div className="card">
      <div className="card-head">
        <h3>{t('Step 2 · Check the grid')}</h3>
        <span className="muted small">
          {t('{cols}×{rows} slots · {n} with items · grid {source}', { cols: grid.cols, rows: grid.rows, n: occupied, source: t(source) })}
        </span>
      </div>
      <p className="muted small">
        {t('Every slot should sit inside one box.')} {t('Drag the')} <b className="handle-tl">●</b> {t('top-left and')} <b className="handle-br">●</b>{' '}
        {t('bottom-right handles to fit, adjust the column/row count, and click a slot to mark it empty / occupied (dimmed = empty, skipped).')}
      </p>
      <div className="row-wrap small grid-tools">
        <span>{t('Columns')}</span>
        <button onClick={() => count('cols', -1)}>−</button>
        <b>{grid.cols}</b>
        <button onClick={() => count('cols', 1)}>+</button>
        <span>{t('Rows')}</span>
        <button onClick={() => count('rows', -1)}>−</button>
        <b>{grid.rows}</b>
        <button onClick={() => count('rows', 1)}>+</button>
        <span className="muted">{t('Move')}</span>
        <button onClick={() => nudge(-1, 0)}>←</button>
        <button onClick={() => nudge(1, 0)}>→</button>
        <button onClick={() => nudge(0, -1)}>↑</button>
        <button onClick={() => nudge(0, 1)}>↓</button>
        <button onClick={onAutoDetect}>{t('Auto-detect')}</button>
        <span className="spacer" />
        {t('Zoom')}
        <button disabled={zoom <= ZOOMS[0]} onClick={() => changeZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}>
          −
        </button>
        <b>{Math.round(zoom * 100)}%</b>
        <button disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onClick={() => changeZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}>
          +
        </button>
      </div>
      <div className="cropper-wrap">
        <div className="grid-stage" style={{ width: width * zoom, height: height * zoom }}>
          <img src={url} alt={t('screenshot')} draggable={false} style={{ width: width * zoom, height: height * zoom }} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width={width * zoom}
            height={height * zoom}
            onPointerMove={onMove}
            onPointerUp={() => setDrag(null)}
          >
            {cells.map((c) => (
              <rect
                key={c.n}
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                className={c.empty ? 'cell empty' : 'cell'}
                strokeWidth={stroke}
                onClick={() => onToggleCell(c.r, c.c)}
              >
                <title>
                  #{c.n} · {t('row {r}, col {c}', { r: c.r + 1, c: c.c + 1 })} — {c.empty ? t('empty (click to include)') : t('has item (click to skip)')}
                </title>
              </rect>
            ))}
            <circle
              className="grid-handle tl"
              cx={grid.left}
              cy={grid.top}
              r={handle}
              onPointerDown={(e) => {
                ;(e.target as Element).setPointerCapture(e.pointerId)
                setDrag('tl')
              }}
            />
            <circle
              className="grid-handle br"
              cx={right}
              cy={bottom}
              r={handle}
              onPointerDown={(e) => {
                ;(e.target as Element).setPointerCapture(e.pointerId)
                setDrag('br')
              }}
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
