import { useEffect, useMemo } from 'react'
import { effectiveYield, recipeIndex, stockOf } from '../calc'
import { useAppState } from '../store'
import { useT } from '../i18n'
import type { CraftStep } from '../calc'
import { ItemIcon, ItemLabel, displayName, fmt, safeCodexId, useItemsById } from './common'

/** Ask the Recipes page to open an item (used by "Edit recipe"). */
export function openInRecipes(itemId: string) {
  location.hash = '#recipes'
  window.dispatchEvent(new CustomEvent('harmony:open-item', { detail: itemId }))
}

/**
 * Card showing how an item is made: method, yield, ingredients (per craft and for the current plan),
 * what it's used in, and ways to obtain it if it's a raw material.
 */
export default function RecipeModal({ itemId, step, onOpen, onClose }: { itemId: string; step?: CraftStep; onOpen: (id: string) => void; onClose: () => void }) {
  const state = useAppState()
  const { settings } = state
  const t = useT()
  const itemsById = useItemsById(state)
  const recipes = useMemo(() => recipeIndex(state.recipes), [state.recipes])
  const item = itemsById.get(itemId)
  const recipe = recipes.get(itemId)
  const usedIn = state.recipes.filter((r) => r.ingredients.some((g) => g.itemId === itemId))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!item) return null
  const y = recipe ? effectiveYield(recipe, settings.alchemyYield) : 1
  const crafts = step?.crafts ?? 0
  const shared = recipe?.method === 'Alchemy' && !recipe.fixedYield

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal recipe-modal" role="dialog" aria-label={displayName(item, settings.lang)}>
        <div className="card-head">
          <h3 className="row-wrap">
            <ItemIcon item={item} size={44} />
            <span>
              {displayName(item, settings.lang)}
              <span className="item-secondary">{settings.lang === 'th' ? item.name : item.nameTh}</span>
            </span>
          </h3>
          <button onClick={onClose}>{t('Close')}</button>
        </div>

        {item.category === 'group' && (
          <p className="small">
            {t('Any of these can be used:')} {(item.stockAliases ?? []).map((a) => `${displayName(itemsById.get(a.itemId), settings.lang, a.itemId)} ×${a.factor}`).join(', ')}
          </p>
        )}

        {recipe ? (
          <>
            <div className="recipe-facts">
              <span className="pill">{t(recipe.method)}</span>
              <span>{t('Gives {y} per craft', { y })}</span>
              {shared && <span className="muted small">{t('(shared Alchemy average)')}</span>}
              {step && (
                <span>
                  {t('This plan: {crafts} craft(s) for {needed}', { crafts: fmt(crafts), needed: fmt(step.needed) })}
                  {step.fromStock > 0 && ` · ${t('{n} from stock', { n: fmt(step.fromStock) })}`}
                </span>
              )}
            </div>
            <table className="grid">
              <thead>
                <tr>
                  <th>{t('Ingredient')}</th>
                  <th className="num">{t('Per craft')}</th>
                  {step && <th className="num">{t('For this plan')}</th>}
                  <th className="num">{t('In stock')}</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((g) => (
                  <tr key={g.itemId} className="clickable" onClick={() => onOpen(g.itemId)} title={t('Show this ingredient')}>
                    <td>
                      <ItemLabel item={itemsById.get(g.itemId)} id={g.itemId} />
                    </td>
                    <td className="num">{fmt(g.qty)}</td>
                    {step && <td className="num">{fmt(g.qty * crafts)}</td>}
                    <td className="num">{fmt(stockOf(state, g.itemId, itemsById))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {step && step.produced > step.needed - step.fromStock && (
              <p className="muted small">{t('Expected output: {n} (a little extra because crafts are whole numbers).', { n: fmt(step.produced) })}</p>
            )}
          </>
        ) : (
          item.category !== 'group' && (
            <p className="small">
              <b>{t('Raw material')}</b> — {t('not crafted in this plan; buy, gather or drop it.')}
              {item.note && <span className="muted"> {item.note}</span>}
            </p>
          )
        )}

        {usedIn.length > 0 && (
          <>
            <h4>{t('Used in')}</h4>
            <ul className="chips">
              {usedIn.map((r) => (
                <li key={r.id} className="clickable" onClick={() => onOpen(r.output)} title={t('Show this recipe')}>
                  <ItemLabel item={itemsById.get(r.output)} id={r.output} /> ×{r.ingredients.find((g) => g.itemId === itemId)?.qty}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="row-wrap" style={{ marginTop: 12 }}>
          <span className="muted small">{t('In stock: {n}', { n: fmt(stockOf(state, itemId, itemsById)) })}</span>
          <span className="spacer" />
          {safeCodexId(item.codexId) && (
            <a className="link small" href={`https://bdocodex.com/${settings.lang === 'th' ? 'th' : 'us'}/item/${item.codexId}/`} target="_blank" rel="noreferrer">
              bdocodex
            </a>
          )}
          <button
            onClick={() => {
              onClose()
              openInRecipes(itemId)
            }}
          >
            {t('Edit recipe')}
          </button>
        </div>
      </div>
    </div>
  )
}
