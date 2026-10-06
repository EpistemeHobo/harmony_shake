import { useMemo, useState } from 'react'
import { calculate, effectiveYield, maxCraftable, recipeIndex } from '../calc'
import { updateSettings, useAppState } from '../store'
import { AlchemyYieldInput, ItemLabel, ItemSelect, displayName, fmt, useItemsById } from './common'
import { useT } from '../i18n'
import RecipeModal from './RecipeModal'

export default function CalculatorPage() {
  const t = useT()
  const [openItem, setOpenItem] = useState<string | null>(null)
  const state = useAppState()
  const { settings } = state
  const itemsById = useItemsById(state)
  const recipes = useMemo(() => recipeIndex(state.recipes), [state.recipes])
  const [copied, setCopied] = useState(false)

  const target = settings.targetItem
  const valid = !!target && recipes.has(target)
  const result = useMemo(
    () => (valid ? calculate(state, target, settings.targetQty, settings.useIntermediateStock) : null),
    [state, target, valid, settings.targetQty, settings.useIntermediateStock],
  )
  const maxN = useMemo(() => (valid ? maxCraftable(state, target, settings.useIntermediateStock) : 0), [state, target, valid, settings.useIntermediateStock])

  const lacking = result?.materials.filter((m) => m.lacking > 0) ?? []

  const copyShopping = async () => {
    const lines = lacking.map((m) => `${displayName(itemsById.get(m.itemId), settings.lang, m.itemId)}\t${m.lacking}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section>
      <div className="card toolbar">
        <label>
          {t('Target')}
          <ItemSelect items={state.items} value={target} onChange={(id) => updateSettings({ targetItem: id })} filter={(i) => recipes.has(i.id)} />
        </label>
        <label>
          {t('Quantity (N)')}
          <input
            className="qty"
            type="number"
            min={1}
            value={settings.targetQty}
            onChange={(e) => updateSettings({ targetQty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
          />
        </label>
        <label className="check" title={t('Elixirs / draughts / reagents already in storage reduce what you need to craft')}>
          <input type="checkbox" checked={settings.useIntermediateStock} onChange={(e) => updateSettings({ useIntermediateStock: e.target.checked })} />
          {t('Use crafted intermediates already in stock')}
        </label>
        <AlchemyYieldInput />
        <span className="spacer" />
        <div className={`badge ${maxN >= settings.targetQty ? 'good' : ''}`}>
          {t('Can craft now:')} <b>{fmt(maxN)}</b>
        </div>
      </div>

      {!valid && <p className="card muted">{t('Pick a craftable target item.')}</p>}

      {result && (
        <>
          <div className={`card status ${result.complete ? 'ok' : 'warn'}`}>
            {result.complete
              ? '✔ ' + t('You have everything for {qty} × {item}.', { qty: fmt(settings.targetQty), item: displayName(itemsById.get(target), settings.lang) })
              : '✘ ' +
                t('Missing {n} material type(s) for {qty} × {item}.', {
                  n: lacking.length,
                  qty: fmt(settings.targetQty),
                  item: displayName(itemsById.get(target), settings.lang),
                })}
          </div>

          <div className="cols">
            <div className="card">
              <div className="card-head">
                <h3>{t('Raw materials')}</h3>
                {lacking.length > 0 && <button onClick={copyShopping}>{copied ? t('Copied!') : t('Copy shopping list')}</button>}
              </div>
              <table className="grid">
                <thead>
                  <tr>
                    <th>{t('Item')}</th>
                    <th className="num">{t('Required')}</th>
                    <th className="num">{t('In stock')}</th>
                    <th className="num">{t('Lacking')}</th>
                    <th className="bar-col"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.materials.map((m) => {
                    const pct = m.required ? Math.min(100, (m.inStock / m.required) * 100) : 100
                    return (
                      <tr key={m.itemId} className="clickable" onClick={() => setOpenItem(m.itemId)} title={t('Click to see the recipe')}>
                        <td>
                          <ItemLabel item={itemsById.get(m.itemId)} id={m.itemId} />
                        </td>
                        <td className="num">{fmt(m.required)}</td>
                        <td className="num">
                          {fmt(m.inStock)}
                          {m.crafted && <div className="hint">{t('+{n} crafted', { n: fmt(m.crafted) })}</div>}
                        </td>
                        <td className={`num ${m.lacking ? 'bad' : 'good'}`}>{m.lacking ? fmt(m.lacking) : '✔'}</td>
                        <td className="bar-col">
                          <div className="bar">
                            <div style={{ width: `${pct}%` }} className={m.lacking ? 'bad' : 'good'} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>{t('Crafting steps')}</h3>
              <p className="muted small">{t('Top-down. Crafts = ceil(units to make ÷ avg yield per craft).')}</p>
              <table className="grid">
                <thead>
                  <tr>
                    <th>{t('Item')}</th>
                    <th>{t('Method')}</th>
                    <th className="num">{t('Needed')}</th>
                    <th className="num">{t('From stock')}</th>
                    <th className="num">{t('Crafts')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.steps.map((s) => (
                    <tr key={s.itemId} className="clickable" onClick={() => setOpenItem(s.itemId)} title={t('Click to see the recipe')}>
                      <td style={{ paddingLeft: 8 + s.depth * 14 }}>
                        <ItemLabel item={itemsById.get(s.itemId)} id={s.itemId} />
                      </td>
                      <td className="small muted">
                        {recipes.get(s.itemId)?.method && t(recipes.get(s.itemId)!.method)}
                        {(() => {
                          const r = recipes.get(s.itemId)
                          const y = r ? effectiveYield(r, settings.alchemyYield) : 1
                          return y !== 1 ? ` ×${y}` : ''
                        })()}
                      </td>
                      <td className="num">{fmt(s.needed)}</td>
                      <td className="num">{s.fromStock ? fmt(s.fromStock) : ''}</td>
                      <td className="num">
                        <b>{fmt(s.crafts)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {openItem && (
        <RecipeModal
          key={openItem}
          itemId={openItem}
          step={result?.steps.find((s) => s.itemId === openItem)}
          onOpen={setOpenItem}
          onClose={() => setOpenItem(null)}
        />
      )}
    </section>
  )
}
