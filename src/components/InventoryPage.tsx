import { useMemo, useRef, useState } from 'react'
import type { Item, ItemCategory } from '../types'
import { applyStock, exportJson, importJson, upsertItem, slugify, useAppState } from '../store'
import { calculate, stockOf } from '../calc'
import { CATEGORY_LABEL, ItemLabel, displayName, fmt, useItemsById } from './common'
import { useT } from '../i18n'

const ORDER: ItemCategory[] = ['raw', 'intermediate', 'product']

export default function InventoryPage() {
  const t = useT()
  const state = useAppState()
  const { settings } = state
  const itemsById = useItemsById(state)
  const [query, setQuery] = useState('')
  const [onlyNeeded, setOnlyNeeded] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const required = useMemo(() => {
    const map = new Map<string, number>()
    if (!settings.targetItem || !itemsById.has(settings.targetItem)) return map
    const res = calculate(state, settings.targetItem, settings.targetQty, settings.useIntermediateStock)
    for (const m of res.materials) map.set(m.itemId, m.required)
    for (const s of res.steps) map.set(s.itemId, s.needed)
    return map
  }, [state, settings.targetItem, settings.targetQty, settings.useIntermediateStock, itemsById])

  const q = query.trim().toLowerCase()
  const visible = (i: Item) =>
    i.category !== 'group' &&
    (!q || i.name.toLowerCase().includes(q) || (i.nameTh ?? '').includes(q)) &&
    (!onlyNeeded || required.has(i.id))

  const dirty = Object.keys(drafts).length
  const saveDrafts = () => {
    const updates: Record<string, number> = {}
    for (const [id, v] of Object.entries(drafts)) {
      const n = Number(v.replace(/[,\s]/g, ''))
      if (v.trim() !== '' && Number.isFinite(n)) updates[id] = n
    }
    applyStock(updates, 'manual')
    setDrafts({})
  }

  const addItem = () => {
    const name = newName.trim()
    if (!name) return
    const id = slugify(name)
    if (!itemsById.has(id)) upsertItem({ id, name, nameTh: /[฀-๿]/.test(name) ? name : undefined, category: 'raw' })
    setNewName('')
  }

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `harmony-shake-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const upload = async (f: File | undefined) => {
    if (!f) return
    try {
      importJson(await f.text())
    } catch (e) {
      alert(t('Import failed: {msg}', { msg: (e as Error).message }))
    }
  }

  return (
    <section>
      <div className="toolbar">
        <input className="grow" placeholder={t('Search item (TH / EN)…')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={onlyNeeded} onChange={(e) => setOnlyNeeded(e.target.checked)} />
          {t('Only items used by current plan')}
        </label>
        <button className="primary" disabled={!dirty} onClick={saveDrafts}>
          {t('Save')} {dirty ? `(${dirty})` : ''}
        </button>
        {dirty > 0 && <button onClick={() => setDrafts({})}>{t('Discard')}</button>}
      </div>

      {ORDER.map((cat) => {
        const rows = state.items.filter((i) => i.category === cat && visible(i))
        if (!rows.length) return null
        rows.sort((a, b) => displayName(a, settings.lang).localeCompare(displayName(b, settings.lang)))
        return (
          <div key={cat} className="card">
            <h3>{t(CATEGORY_LABEL[cat])}</h3>
            <table className="grid">
              <thead>
                <tr>
                  <th>{t('Item')}</th>
                  <th className="num">{t('In stock')}</th>
                  <th className="num">{t('Needed ({qty} × target)', { qty: fmt(settings.targetQty) })}</th>
                  <th className="num">{t('Lacking')}</th>
                  <th>{t('Updated')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const own = state.stock[item.id]?.qty ?? 0
                  const eff = stockOf(state, item.id, itemsById)
                  const need = required.get(item.id)
                  const lacking = need !== undefined && cat === 'raw' ? Math.max(0, need - eff) : 0
                  const updated = state.stock[item.id]?.updatedAt
                  return (
                    <tr key={item.id} className={drafts[item.id] !== undefined ? 'dirty' : ''}>
                      <td>
                        <ItemLabel item={item} />
                      </td>
                      <td className="num">
                        <input
                          className="qty"
                          inputMode="numeric"
                          value={drafts[item.id] ?? String(own)}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && saveDrafts()}
                        />
                        {eff !== own && <div className="hint">{t('effective {n}', { n: fmt(eff) })}</div>}
                      </td>
                      <td className="num">{need !== undefined ? fmt(need) : <span className="muted">—</span>}</td>
                      <td className={`num ${lacking > 0 ? 'bad' : ''}`}>{need !== undefined && cat === 'raw' ? fmt(lacking) : ''}</td>
                      <td className="muted small">{updated ? new Date(updated).toLocaleString() : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      <div className="card row-wrap">
        <input placeholder={t('New item name (TH or EN)')} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
        <button onClick={addItem}>{t('Add item')}</button>
        <span className="spacer" />
        <button onClick={download}>{t('Export backup')}</button>
        <button onClick={() => fileRef.current?.click()}>{t('Import backup')}</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <button onClick={() => setShowHistory((s) => !s)}>{showHistory ? t('Hide history') : t('Show history')}</button>
      </div>

      {showHistory && (
        <div className="card">
          <h3>{t('Stock history')}</h3>
          {!state.history.length && <p className="muted">{t('No changes yet.')}</p>}
          {state.history.slice(0, 50).map((h, idx) => (
            <details key={idx}>
              <summary>
                {new Date(h.at).toLocaleString()} · {t(h.source)} · {t('{n} item(s)', { n: h.changes.length })}
              </summary>
              <ul className="changes">
                {h.changes.map((c) => (
                  <li key={c.itemId}>
                    {displayName(itemsById.get(c.itemId), settings.lang, c.itemId)}: {fmt(c.from)} → <b>{fmt(c.to)}</b>{' '}
                    <span className={c.to >= c.from ? 'good' : 'bad'}>
                      ({c.to >= c.from ? '+' : ''}
                      {fmt(c.to - c.from)})
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
