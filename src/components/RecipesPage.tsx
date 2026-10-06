import { useEffect, useState } from 'react'
import type { CraftMethod, Item, ItemCategory, Recipe } from '../types'
import { clearSamples, deleteItem, deleteRecipe, resetRecipes, upsertItem, upsertRecipe, useAppState } from '../store'
import { recipeIndex } from '../calc'
import { AlchemyYieldInput, CATEGORY_LABEL, ItemIcon, ItemLabel, ItemSelect, displayName, safeCodexId } from './common'
import { useT } from '../i18n'

const METHODS: CraftMethod[] = ['Alchemy', 'Simple Alchemy', 'Cooking', 'Simple Cooking', 'Processing', 'Other']
const CATS: ItemCategory[] = ['product', 'intermediate', 'raw', 'group']

export default function RecipesPage() {
  const t = useT()
  const state = useAppState()
  const { settings } = state
  const [selected, setSelected] = useState<string>(settings.targetItem)
  useEffect(() => {
    const onOpen = (e: Event) => setSelected((e as CustomEvent<string>).detail)
    window.addEventListener('harmony:open-item', onOpen)
    return () => window.removeEventListener('harmony:open-item', onOpen)
  }, [])
  const [query, setQuery] = useState('')
  const recipes = recipeIndex(state.recipes)

  const q = query.trim().toLowerCase()
  const list = state.items
    .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.nameTh ?? '').includes(q))
    .sort((a, b) => CATS.indexOf(a.category) - CATS.indexOf(b.category) || displayName(a, settings.lang).localeCompare(displayName(b, settings.lang)))

  const item = state.items.find((i) => i.id === selected)

  return (
    <section className="split">
      <aside className="card list">
        <input placeholder={t('Filter…')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul>
          {list.map((i, idx) => (
            <li key={i.id}>
              {(idx === 0 || list[idx - 1].category !== i.category) && <div className="list-head">{t(CATEGORY_LABEL[i.category])}</div>}
              <button className={`list-item ${selected === i.id ? 'active' : ''}`} onClick={() => setSelected(i.id)}>
                <ItemLabel item={i} />
                {recipes.has(i.id) && <span className="pill">{t('recipe')}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="list-foot">
          <AlchemyYieldInput />
          <button
            onClick={() => {
              if (confirm(t('Restore default items & recipes? Your stock, history and icons are kept; custom recipe edits are lost.'))) resetRecipes()
            }}
          >
            {t('Restore default recipes')}
          </button>
        </div>
      </aside>

      <div className="detail">
        {item ? <ItemEditor key={item.id} item={item} recipe={state.recipes.find((r) => r.output === item.id)} onDeleted={() => setSelected('')} /> : <p className="card muted">{t('Select an item.')}</p>}
      </div>
    </section>
  )
}

function ItemEditor({ item, recipe, onDeleted }: { item: Item; recipe?: Recipe; onDeleted: () => void }) {
  const t = useT()
  const state = useAppState()
  const itemsById = new Map(state.items.map((i) => [i.id, i]))
  const usedIn = state.recipes.filter((r) => r.ingredients.some((g) => g.itemId === item.id))
  const [newIng, setNewIng] = useState('')
  const [newAlias, setNewAlias] = useState('')
  const [newMember, setNewMember] = useState('')

  const patchItem = (patch: Partial<Item>) => upsertItem({ ...item, ...patch })
  const patchRecipe = (patch: Partial<Recipe>) => recipe && upsertRecipe({ ...recipe, ...patch })

  const uploadIcon = (f?: File) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = 64
        c.getContext('2d')!.drawImage(img, 0, 0, 64, 64)
        patchItem({ icon: c.toDataURL('image/png') })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(f)
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h3 className="row-wrap">
            <ItemIcon item={item} size={40} /> {item.nameTh || item.name}
          </h3>
          <button
            className="danger"
            onClick={() => {
              if (confirm(t('Delete "{name}" and its recipe?', { name: item.name }))) {
                deleteItem(item.id)
                onDeleted()
              }
            }}
          >
            {t('Delete item')}
          </button>
        </div>
        <div className="form">
          <label>
            {t('English name')}
            <input value={item.name} onChange={(e) => patchItem({ name: e.target.value })} />
          </label>
          <label>
            {t('Thai name')}
            <input value={item.nameTh ?? ''} onChange={(e) => patchItem({ nameTh: e.target.value || undefined })} />
          </label>
          <label>
            {t('Category')}
            <select value={item.category} onChange={(e) => patchItem({ category: e.target.value as ItemCategory })}>
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {t(CATEGORY_LABEL[c])}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Reference icon')}
            <span className="row-wrap">
              <input type="file" accept="image/*" onChange={(e) => uploadIcon(e.target.files?.[0])} />
              {item.icon && <button onClick={() => patchItem({ icon: undefined })}>{item.defaultIcon ? t('Use bdocodex icon') : t('Remove')}</button>}
            </span>
          </label>
          {safeCodexId(item.codexId) && (
            <label>
              {t('Database')}
              <a className="link" href={`https://bdocodex.com/th/item/${item.codexId}/`} target="_blank" rel="noreferrer">
                bdocodex #{item.codexId}
              </a>
            </label>
          )}
          <label className="full">
            {t('Note')}
            <input value={item.note ?? ''} onChange={(e) => patchItem({ note: e.target.value || undefined })} />
          </label>
        </div>

        {item.category === 'group' && (
          <div className="sub">
            <h4>{t('Group members (stock of any of these counts)')}</h4>
            <ul className="chips">
              {(item.members ?? []).map((m) => (
                <li key={m}>
                  <ItemLabel item={itemsById.get(m)} id={m} />
                  <button onClick={() => patchItem({ members: item.members!.filter((x) => x !== m) })}>✕</button>
                </li>
              ))}
            </ul>
            <div className="row-wrap">
              <ItemSelect items={state.items} value={newMember} onChange={setNewMember} filter={(i) => i.id !== item.id && i.category !== 'group'} />
              <button
                disabled={!newMember}
                onClick={() => {
                  patchItem({ members: [...new Set([...(item.members ?? []), newMember])] })
                  setNewMember('')
                }}
              >
                {t('Add member')}
              </button>
            </div>
          </div>
        )}

        <div className="sub">
          <h4>{t('Counts as this item in stock (e.g. blue-grade elixir = 3 green)')}</h4>
          <ul className="chips">
            {(item.stockAliases ?? []).map((a) => (
              <li key={a.itemId}>
                <ItemLabel item={itemsById.get(a.itemId)} id={a.itemId} /> ×
                <input
                  className="qty tiny"
                  type="number"
                  value={a.factor}
                  onChange={(e) => patchItem({ stockAliases: item.stockAliases!.map((x) => (x.itemId === a.itemId ? { ...x, factor: Number(e.target.value) || 0 } : x)) })}
                />
                <button onClick={() => patchItem({ stockAliases: item.stockAliases!.filter((x) => x.itemId !== a.itemId) })}>✕</button>
              </li>
            ))}
          </ul>
          <div className="row-wrap">
            <ItemSelect items={state.items} value={newAlias} onChange={setNewAlias} filter={(i) => i.id !== item.id && i.category !== 'group'} />
            <button
              disabled={!newAlias}
              onClick={() => {
                patchItem({ stockAliases: [...(item.stockAliases ?? []).filter((a) => a.itemId !== newAlias), { itemId: newAlias, factor: 1 }] })
                setNewAlias('')
              }}
            >
              {t('Add')}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{t('Recipe')}</h3>
          {recipe ? (
            <button className="danger" onClick={() => deleteRecipe(recipe.id)}>
              {t('Remove recipe')}
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => {
                upsertRecipe({ id: `r-${item.id}`, output: item.id, method: 'Alchemy', yield: 1, ingredients: [] })
                if (item.category === 'raw') patchItem({ category: 'intermediate' })
              }}
            >
              {t('Add recipe')}
            </button>
          )}
        </div>
        {!recipe && <p className="muted">{t('No recipe — treated as a raw material (bought / gathered / dropped).')}</p>}
        {recipe && (
          <>
            <div className="form">
              <label>
                {t('Method')}
                <select value={recipe.method} onChange={(e) => patchRecipe({ method: e.target.value as CraftMethod })}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(m)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field wide" title={t('Average units you get per craft, including procs. E.g. 3 if one alchemy craft gives ~3 elixirs on average.')}>
                <span>{t('Avg yield per craft')}</span>
                {recipe.method === 'Alchemy' && !recipe.fixedYield ? (
                  <>
                    <div className="row-wrap">
                      <input className="qty" value={state.settings.alchemyYield ?? 3} disabled />
                      <span className="muted small">{t('Shared Alchemy average (change it in the box on the left or on the Calculator)')}</span>
                    </div>
                    <label className="check small">
                      <input type="checkbox" checked={false} onChange={() => patchRecipe({ fixedYield: true, yield: state.settings.alchemyYield ?? 3 })} />
                      {t('Use its own fixed yield instead')}
                    </label>
                  </>
                ) : (
                  <>
                    <div className="row-wrap">
                      <input className="qty" type="number" step="0.01" min="0.01" value={recipe.yield} onChange={(e) => patchRecipe({ yield: Number(e.target.value) || 1 })} />
                    </div>
                    {recipe.method === 'Alchemy' && (
                      <label className="check small">
                        <input type="checkbox" checked={false} onChange={() => patchRecipe({ fixedYield: false })} />
                        {t('Use the shared Alchemy average')}
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>
            <table className="grid">
              <thead>
                <tr>
                  <th>{t('Ingredient')}</th>
                  <th className="num">{t('Qty per craft')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((g, idx) => (
                  <tr key={g.itemId + idx}>
                    <td>
                      <ItemLabel item={itemsById.get(g.itemId)} id={g.itemId} />
                    </td>
                    <td className="num">
                      <input
                        className="qty"
                        type="number"
                        min={0}
                        value={g.qty}
                        onChange={(e) => patchRecipe({ ingredients: recipe.ingredients.map((x, j) => (j === idx ? { ...x, qty: Number(e.target.value) || 0 } : x)) })}
                      />
                    </td>
                    <td>
                      <button onClick={() => patchRecipe({ ingredients: recipe.ingredients.filter((_, j) => j !== idx) })}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row-wrap">
              <ItemSelect items={state.items} value={newIng} onChange={setNewIng} filter={(i) => i.id !== item.id} />
              <button
                disabled={!newIng}
                onClick={() => {
                  patchRecipe({ ingredients: [...recipe.ingredients, { itemId: newIng, qty: 1 }] })
                  setNewIng('')
                }}
              >
                {t('Add ingredient')}
              </button>
            </div>
          </>
        )}
      </div>

      {(state.samples ?? []).some((s) => s.itemId === item.id) && (
        <div className="card row-wrap small">
          {(() => {
            const [before, after = ''] = t('Learned from your scans: {n} slot picture(s).').split('{n}')
            return (
              <span>
                {before}
                <b>{(state.samples ?? []).filter((s) => s.itemId === item.id).length}</b>
                {after}
              </span>
            )
          })()}
          <button onClick={() => clearSamples(item.id)}>{t('Forget (if it was learned wrong)')}</button>
        </div>
      )}

      {usedIn.length > 0 && (
        <div className="card">
          <h3>{t('Used in')}</h3>
          <ul className="chips">
            {usedIn.map((r) => (
              <li key={r.id}>
                <ItemLabel item={itemsById.get(r.output)} id={r.output} /> ×{r.ingredients.find((g) => g.itemId === item.id)?.qty}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
