import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addSamples, applyStock, setFileIcons, setIcons, upsertItem, useAppState } from '../store'
import { buildReferenceSheet, fileToImageBlock, scanCells } from '../vision'
import type { Grid } from '../grid'
import { defaultGrid, detectGrid, loadTemplate, saveTemplate } from '../grid'
import type { Cell } from '../cells'
import { buildCellSheets, extractCells, matchLearned, toIcon } from '../cells'
import type { Item } from '../types'
import { ItemIcon, ItemLabel, ItemSelect, fmt, useItemsById } from './common'
import GridEditor from './GridEditor'
import { tNow, useT } from '../i18n'

interface Shot {
  id: number
  name: string
  url: string
  width: number
  height: number
  status: 'ready' | 'scanning' | 'done' | 'error'
  error?: string
  notes?: string
  grid: Grid
  gridSource: string
  /** User overrides: "r,c" -> true (has item) / false (empty). */
  overrides: Record<string, boolean>
  cells: Cell[]
}

interface Row {
  key: string
  shotId: number
  /** Cell number within its screenshot (0 for rows added by hand). */
  n: number
  r: number
  c: number
  crop?: string
  vec?: number[]
  label: string
  matched_item_id: string
  quantity: number
  quantity_text: string
  confidence: 'high' | 'medium' | 'low'
  include: boolean
  manual?: boolean
  /** Pre-identified from a cell the user confirmed before. */
  learned?: boolean
  /** Not a recipe item; hidden unless expanded. */
  unrelated?: boolean
}

let nextId = 1
const images = new Map<number, HTMLImageElement>()

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function ScanPage() {
  const t = useT()
  const state = useAppState()
  const { settings } = state
  const itemsById = useItemsById(state)
  const [shots, setShots] = useState<Shot[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [mode, setMode] = useState<'set' | 'add'>('set')
  const [showUnrelated, setShowUnrelated] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [zoomKey, setZoomKey] = useState<string | null>(null)
  const [iconsFromScan, setIconsFromScan] = useState(false)
  // The icon writer only exists under `npm run dev` (see vite.config.ts).
  const [canWriteIcons, setCanWriteIcons] = useState(false)
  useEffect(() => {
    fetch('/__api/icons')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCanWriteIcons(!!j?.ok))
      .catch(() => setCanWriteIcons(false))
  }, [])
  const recompute = useRef(new Map<number, number>())

  const patchShot = (id: number, patch: Partial<Shot>) => setShots((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  /** Re-cut cells after the grid changes (debounced while dragging). */
  const scheduleCells = (id: number, grid: Grid, overrides: Record<string, boolean>) => {
    clearTimeout(recompute.current.get(id))
    recompute.current.set(
      id,
      window.setTimeout(() => {
        const img = images.get(id)
        if (img) patchShot(id, { cells: extractCells(img, grid, overrides) })
      }, 120),
    )
  }

  const addFiles = useCallback(async (files: Iterable<File>) => {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      const block = await fileToImageBlock(f)
      const img = await loadImg(block.url)
      const id = nextId++
      images.set(id, img)
      const W = img.naturalWidth
      const H = img.naturalHeight
      const remembered = loadTemplate(W, H)
      const detected = remembered ? null : detectGrid(img)
      const grid = remembered ?? detected ?? defaultGrid(img)
      const gridSource = remembered ? 'remembered from last time' : detected ? 'auto-detected' : 'not found — please fit it'
      const shot: Shot = {
        id,
        name: f.name || tNow('pasted image'),
        url: block.url,
        width: W,
        height: H,
        status: 'ready',
        grid,
        gridSource,
        overrides: {},
        cells: extractCells(img, grid),
      }
      setShots((s) => [...s, shot])
      setActive(id)
    }
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
        e.preventDefault()
        addFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles])

  const setGrid = (shot: Shot, grid: Grid, gridSource = 'adjusted') => {
    patchShot(shot.id, { grid, gridSource })
    scheduleCells(shot.id, grid, shot.overrides)
  }

  const toggleCell = (shot: Shot, r: number, c: number) => {
    const cell = shot.cells.find((x) => x.r === r && x.c === c)
    const overrides = { ...shot.overrides, [`${r},${c}`]: !!cell?.empty }
    patchShot(shot.id, { overrides })
    scheduleCells(shot.id, shot.grid, overrides)
  }

  const autoDetect = (shot: Shot) => {
    const img = images.get(shot.id)
    if (!img) return
    const g = detectGrid(img)
    if (g) setGrid(shot, g, 'auto-detected')
    else setMessage(t('No regular grid found — fit it with the handles.'))
  }

  const scan = async (shot: Shot) => {
    if (!settings.apiKey) {
      setMessage(t('Add your Anthropic API key in Settings first.'))
      return
    }
    const occupied = shot.cells.filter((c) => !c.empty)
    if (!occupied.length) {
      setMessage(t('No occupied slots in this grid — check the grid first.'))
      return
    }
    saveTemplate(shot.width, shot.height, shot.grid) // same-size screenshots line up next time
    patchShot(shot.id, { status: 'scanning', error: undefined })
    try {
      const samples = state.samples ?? []
      const learned = new Map(occupied.map((c) => [c.n, matchLearned(c.vec, samples)]))
      const hints = new Map<number, string>()
      for (const [n, m] of learned) if (m?.sure) hints.set(n, m.itemId)
      const sheets = await buildCellSheets(occupied)
      const res = await scanCells({
        apiKey: settings.apiKey,
        model: settings.model,
        items: state.items,
        sheets,
        cellNumbers: occupied.map((c) => c.n),
        hints,
      })
      const byCell = new Map(res.cells.map((x) => [x.cell, x]))
      const newRows: Row[] = occupied.map((cell) => {
        const ai = byCell.get(cell.n)
        const lm = learned.get(cell.n)
        const aiId = ai && itemsById.has(ai.matched_item_id) ? ai.matched_item_id : ''
        // A sure learned match is the user's own confirmed pixels: it wins over the model's guess.
        const id = lm?.sure ? lm.itemId : aiId
        const disagree = lm?.sure && aiId && aiId !== lm.itemId
        return {
          key: `${shot.id}-${cell.n}`,
          shotId: shot.id,
          n: cell.n,
          r: cell.r,
          c: cell.c,
          crop: cell.crop,
          vec: cell.vec,
          label: (ai?.label ?? t('not read')) + (disagree ? ' ' + t('(reader said {name})', { name: itemsById.get(aiId)?.name ?? aiId }) : ''),
          matched_item_id: id,
          quantity: ai?.quantity ?? 0,
          quantity_text: ai?.quantity_text ?? '',
          confidence: !ai ? 'low' : disagree ? 'medium' : lm?.sure ? 'high' : ai.confidence,
          include: !!id,
          learned: !!lm?.sure,
          unrelated: !id,
        }
      })
      setRows((r) => [...r.filter((x) => x.shotId !== shot.id), ...newRows])
      patchShot(shot.id, { status: 'done', notes: res.notes })
    } catch (e) {
      patchShot(shot.id, { status: 'error', error: (e as Error).message })
    }
  }

  const removeShot = (id: number) => {
    setShots((s) => s.filter((x) => x.id !== id))
    setRows((r) => r.filter((x) => x.shotId !== id))
    images.delete(id)
    if (active === id) setActive(null)
  }

  // Dropdown choices: every item in the recipe database, group members, and items that count toward them.
  const auditItems = useMemo(() => {
    const ids = new Set<string>()
    for (const r of state.recipes) {
      ids.add(r.output)
      for (const g of r.ingredients) ids.add(g.itemId)
    }
    for (const i of state.items) if (i.category === 'group' && ids.has(i.id)) i.members?.forEach((m) => ids.add(m))
    for (const i of state.items) if (ids.has(i.id)) i.stockAliases?.forEach((a) => ids.add(a.itemId))
    return state.items.filter((i) => ids.has(i.id) && i.category !== 'group')
  }, [state.items, state.recipes])

  const patchRow = (key: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const pickItem = (row: Row, id: string) => patchRow(row.key, { matched_item_id: id, include: !!id || row.include, unrelated: row.unrelated && !id, learned: false })

  const totals = new Map<string, number>()
  for (const r of rows) if (r.include && r.matched_item_id) totals.set(r.matched_item_id, (totals.get(r.matched_item_id) ?? 0) + r.quantity)

  const invalidCount = rows.filter((r) => r.include && !r.matched_item_id).length
  const hiddenCount = rows.filter((r) => r.unrelated).length
  const visibleRows = showUnrelated ? rows : rows.filter((r) => !r.unrelated)
  const learnedCount = rows.filter((r) => r.learned).length

  const apply = async () => {
    const confirmed = rows.filter((r) => r.include && r.matched_item_id && !r.manual)
    // Optionally use each confirmed slot picture (first one per item) as that item's icon.
    let iconNote = ''
    if (iconsFromScan) {
      const icons: Record<string, string> = {}
      for (const r of confirmed) if (r.crop && !icons[r.matched_item_id]) icons[r.matched_item_id] = await toIcon(r.crop)
      if (canWriteIcons) {
        // Write straight into public/icons/ (project files); the in-browser icon is cleared so the file is shown.
        try {
          const res = await fetch('/__api/icons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ icons }) })
          const j = (await res.json()) as { written?: string[]; seed?: string; error?: string }
          if (!res.ok) throw new Error(j.error ?? res.statusText)
          const v = Date.now()
          setFileIcons(Object.fromEntries((j.written ?? []).map((id) => [id, `/icons/${id}.png?v=${v}`])))
          iconNote =
            ' ' +
            t('Replaced {n} icon(s) in public/icons/.', { n: j.written?.length ?? 0 }) +
            (j.seed === 'failed' ? ' ' + t('(Seed not regenerated: run python scripts/build_seed.py.)') : '')
        } catch (e) {
          iconNote = ' ' + t('Could not write icons: {error}', { error: (e as Error).message })
        }
      } else {
        setIcons(icons)
        iconNote = ' ' + t('Updated {n} item icon(s) in this browser.', { n: Object.keys(icons).length })
      }
    }
    const n = applyStock(Object.fromEntries(totals), 'scan', mode)
    // Remember every confirmed slot picture so the same item is recognised next time.
    const learnedNow = addSamples(
      confirmed.filter((r) => r.vec).map((r) => ({ itemId: r.matched_item_id, vec: r.vec!, at: Date.now() })),
    )
    setMessage(
      t('Saved. Updated {n} item(s) in stock. Learned {m} new slot picture(s) for next time.', { n, m: learnedNow }) + iconNote,
    )
    setRows([])
  }

  const addManualRow = () =>
    setRows((r) => [
      ...r,
      {
        key: `m-${nextId++}`,
        shotId: -1,
        n: 0,
        r: 0,
        c: 0,
        label: t('added by hand'),
        matched_item_id: '',
        quantity: 0,
        quantity_text: '',
        confidence: 'high',
        include: true,
        manual: true,
      },
    ])

  const activeShot = shots.find((s) => s.id === active)
  const zoomRow = rows.find((r) => r.key === zoomKey)
  const readyShots = shots.filter((s) => s.status === 'ready' || s.status === 'error')

  return (
    <section>
      <div
        className="card dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          addFiles(e.dataTransfer.files)
        }}
      >
        <p>
          <b>{t('Step 1 · Paste (Ctrl+V)')}</b> {t('screenshots of your storage, drop them here, or')}{' '}
          <label className="link">
            {t('choose files')}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </label>
          {t('. You can add several pages.')}
        </p>
        <p className="muted small">
          {t(
            'Crop to just the slot grid. The app finds the grid, cuts out every slot, and only sends slots with items to the reader. Slots you confirm are remembered ({n} learned so far).',
            { n: (state.samples ?? []).length },
          )}
        </p>
      </div>

      {message && (
        <div className="card status ok" onClick={() => setMessage('')}>
          {message}
        </div>
      )}

      {shots.length > 0 && (
        <div className="shots">
          {shots.map((s) => (
            <div key={s.id} className={`shot ${active === s.id ? 'active' : ''}`} onClick={() => setActive(s.id)}>
              <img src={s.url} alt="" />
              <div className="shot-meta">
                <span className={`pill ${s.status}`}>{s.status === 'scanning' ? t('reading…') : t(s.status)}</span>
                <button disabled={s.status === 'scanning'} onClick={(e) => (e.stopPropagation(), scan(s))}>
                  {s.status === 'done' ? t('Re-scan') : t('Scan')}
                </button>
                <button title={t('Remove screenshot')} onClick={(e) => (e.stopPropagation(), removeShot(s.id))}>✕</button>
              </div>
              <div className="muted small">{t('{n} slots with items', { n: s.cells.filter((c) => !c.empty).length })}</div>
              {s.error && <div className="bad small">{t(s.error)}</div>}
            </div>
          ))}
          {readyShots.length > 1 && (
            <button className="primary" onClick={() => readyShots.forEach(scan)}>
              {t('Scan all new')}
            </button>
          )}
        </div>
      )}

      {activeShot && (
        <GridEditor
          key={activeShot.id}
          url={activeShot.url}
          width={activeShot.width}
          height={activeShot.height}
          grid={activeShot.grid}
          cells={activeShot.cells}
          source={activeShot.gridSource}
          onChange={(g) => setGrid(activeShot, g)}
          onToggleCell={(r, c) => toggleCell(activeShot, r, c)}
          onAutoDetect={() => autoDetect(activeShot)}
        />
      )}

      <ReferenceSheetPreview />

      {(rows.length > 0 || shots.some((s) => s.status === 'done')) && (
        <div className="card">
          <div className="card-head">
            <h3>{t('Step 3 · Audit the reading')}</h3>
            <span className="muted small">
              {learnedCount > 0 && <>{t('{n} slot(s) recognised from your earlier confirmations', { n: learnedCount })} · </>}
              {t('Nothing is saved until you confirm in step 4.')}
            </span>
          </div>
          <table className="grid audit">
            <thead>
              <tr>
                <th>{t('Use')}</th>
                <th>{t('Slot')}</th>
                <th>{t('Ingredient')}</th>
                <th className="num">{t('Amount')}</th>
                <th>{t('Reader saw')}</th>
                <th>{t('Confidence')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const missingItem = r.include && !r.matched_item_id
                return (
                  <tr key={r.key} className={`${r.include ? '' : 'excluded'} ${r.confidence === 'low' ? 'lowconf' : ''}`}>
                    <td>
                      <input type="checkbox" checked={r.include} onChange={(e) => patchRow(r.key, { include: e.target.checked })} />
                    </td>
                    <td>
                      {r.crop ? (
                        <img className="slot-thumb" src={r.crop} alt={t('slot #{n}', { n: r.n })} title={t('Click to enlarge')} onClick={() => setZoomKey(r.key)} />
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td className={missingItem ? 'invalid' : ''}>
                      <ItemSelect
                        items={auditItems}
                        compare={r.crop ? { src: r.crop, caption: `${r.quantity_text || r.quantity} · #${r.n}` } : undefined}
                        value={r.matched_item_id}
                        onChange={(id) => pickItem(r, id)}
                        placeholder={t('— choose ingredient —')}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="qty"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={r.quantity}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '')
                          patchRow(r.key, { quantity: digits === '' ? 0 : parseInt(digits, 10) })
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    </td>
                    <td className="small">
                      {r.label} {r.n > 0 && <span className="muted">#{r.n}</span>}
                      {/[kKmM]/.test(r.quantity_text ?? '') && (
                        <div className="warn-text" title={t('The game shows rounded numbers for big stacks. Hover the item in game for the exact count.')}>
                          {t('shown as “{q}” — rounded', { q: r.quantity_text })}
                        </div>
                      )}
                    </td>
                    <td>
                      {r.manual ? (
                        <span className="pill">{t('added manually')}</span>
                      ) : (
                        <>
                          <span className={`pill conf-${r.confidence}`}>{t(r.confidence)}</span>
                          {r.learned && (
                            <span className="pill learned" title={t('Matched a slot picture you confirmed before')}>
                              {t('learned')}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <button title={t('Delete row')} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="row-wrap" style={{ marginTop: 8 }}>
            <button onClick={addManualRow}>+ {t('Add missed item')}</button>
            <label className="check" title={t('Slots the reader could not match to a recipe ingredient (gear, food, other items)')}>
              <input type="checkbox" checked={showUnrelated} onChange={(e) => setShowUnrelated(e.target.checked)} /> {t('Show skipped items ({n})', { n: hiddenCount })}
            </label>
            <label
              className="check"
              title={
                canWriteIcons
                  ? t('On Confirm & save, each confirmed slot picture replaces that item’s icon file in public/icons/ (backup: icons_first_version.bak/)')
                  : t('Writing files needs the local dev server (npm run dev). Here the icons are only updated in this browser.')
              }
            >
              <input type="checkbox" checked={iconsFromScan} onChange={(e) => setIconsFromScan(e.target.checked)} />{' '}
              {canWriteIcons ? t('Update icons in public/icons/') : t('Update icons (this browser only)')}
            </label>
            {invalidCount > 0 && <span className="bad small">{t('{n} row(s) need an ingredient (or untick "Use").', { n: invalidCount })}</span>}
          </div>
          {shots
            .filter((s) => s.notes)
            .map((s) => (
              <p key={s.id} className="muted small">
                {t('Reader note ({name}):', { name: s.name })} {s.notes}
              </p>
            ))}
        </div>
      )}

      {zoomRow && (
        <SlotModal
          row={zoomRow}
          shot={shots.find((x) => x.id === zoomRow.shotId)}
          items={auditItems}
          onPick={(id) => pickItem(zoomRow, id)}
          onClose={() => setZoomKey(null)}
        />
      )}

      {totals.size > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>{t('Step 4 · Confirm changes to stock')}</h3>
            <div className="row-wrap">
              <label className="check">
                <input type="radio" checked={mode === 'set'} onChange={() => setMode('set')} /> {t('Replace with these amounts')}
              </label>
              <label className="check">
                <input type="radio" checked={mode === 'add'} onChange={() => setMode('add')} /> {t('Add to current stock')}
              </label>
              <button className="primary" disabled={invalidCount > 0} onClick={apply}>
                {t('Confirm & save {n} item(s)', { n: totals.size })}
              </button>
            </div>
          </div>
          <p className="muted small">
            {t('Rows with the same ingredient are summed (one item split over several slots or pages). Confirming also teaches the app these slot pictures.')}
          </p>
          <table className="grid">
            <thead>
              <tr>
                <th>{t('Ingredient')}</th>
                <th className="num">{t('Current')}</th>
                <th className="num">{t('New')}</th>
                <th className="num">{t('Change')}</th>
              </tr>
            </thead>
            <tbody>
              {[...totals].map(([id, q]) => {
                const cur = state.stock[id]?.qty ?? 0
                const next = mode === 'add' ? cur + q : q
                const d = next - cur
                return (
                  <tr key={id}>
                    <td>
                      <ItemLabel item={itemsById.get(id)} id={id} />
                    </td>
                    <td className="num">{fmt(cur)}</td>
                    <td className="num">
                      <b>{fmt(next)}</b>
                    </td>
                    <td className={`num ${d > 0 ? 'good' : d < 0 ? 'bad' : 'muted'}`}>
                      {d > 0 ? '+' : ''}
                      {fmt(d)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Large view of one slot, where it sits in the screenshot, and a picker to compare against. */
function SlotModal({ row, shot, items, onPick, onClose }: { row: Row; shot?: Shot; items: Item[]; onPick: (id: string) => void; onClose: () => void }) {
  const t = useT()
  const state = useAppState()
  const picked = state.items.find((i) => i.id === row.matched_item_id)
  const [iconSaved, setIconSaved] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const cell = shot?.cells.find((c) => c.n === row.n)
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={t('Slot detail')}>
        <div className="card-head">
          <h3>
            {t('Slot #{n}', { n: row.n })} · {row.quantity_text || fmt(row.quantity)}
          </h3>
          <button onClick={onClose}>{t('Close')}</button>
        </div>
        <div className="modal-body">
          <div>
            <div className="muted small">{t('Your screenshot')}</div>
            {row.crop && <img className="cell-big" src={row.crop} alt={t('cell')} />}
          </div>
          <div>
            <div className="muted small">{t('Matched item')}</div>
            {picked ? (
              <ItemIcon item={picked} size={192} />
            ) : (
              <div className="cell-big" style={{ display: 'grid', placeItems: 'center', color: '#fff8' }}>
                {t('none')}
              </div>
            )}
          </div>
          {shot && cell && (
            <div>
              <div className="muted small">{t('Where it is')}</div>
              <div className="where">
                <img src={shot.url} alt={t('screenshot')} />
                <div
                  className="mark"
                  style={{
                    left: `${(cell.x / shot.width) * 100}%`,
                    top: `${(cell.y / shot.height) * 100}%`,
                    width: `${(cell.w / shot.width) * 100}%`,
                    height: `${(cell.h / shot.height) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="row-wrap" style={{ marginTop: 12 }}>
          <span className="small muted">{t('Ingredient:')}</span>
          <ItemSelect items={items} value={row.matched_item_id} onChange={onPick} compare={row.crop ? { src: row.crop } : undefined} placeholder={t('— choose ingredient —')} />
          {picked && row.crop && (
            <button
              title={t("Use this exact slot picture as the item's icon everywhere (and in the reader's reference sheet)")}
              onClick={async () => {
                upsertItem({ ...picked, icon: await toIcon(row.crop!) })
                setIconSaved(true)
              }}
            >
              {iconSaved ? t('Saved as icon ✓') : t('Use as item icon')}
            </button>
          )}
          <span className="muted small">{t('Reader saw: {label}', { label: row.label })}</span>
        </div>
      </div>
    </div>
  )
}

/** Shows the numbered icon sheet that is sent with every scan. */
function ReferenceSheetPreview() {
  const t = useT()
  const state = useAppState()
  const [url, setUrl] = useState('')
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    buildReferenceSheet(state.items).then((sheet) => {
      if (!alive || !sheet) return
      setUrl(sheet.url)
      setCount(sheet.legend.split('\n').length)
    })
    return () => {
      alive = false
    }
  }, [open, state.items])

  return (
    <details className="card" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <b>{t('Reference sheet')}</b> <span className="muted small">— {t('icons from bdocodex (or your saved ones) that the reader compares against')}</span>
      </summary>
      {url ? (
        <>
          <p className="muted small">{t('{n} items. Frame color = item grade.', { n: count })}</p>
          <img className="ref-sheet" src={url} alt={t('reference sheet')} />
        </>
      ) : (
        <p className="muted small">{t('Building…')}</p>
      )}
    </details>
  )
}
