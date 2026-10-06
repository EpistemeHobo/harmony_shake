import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, Item } from '../types'
import { updateSettings, useAppState } from '../store'
import { useT } from '../i18n'
import { safeCodexId, safeImageSrc } from '../security'
export { safeCodexId }

export const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

export function useItemsById(state: AppState) {
  return useMemo(() => new Map(state.items.map((i) => [i.id, i])), [state.items])
}

export function displayName(item: Item | undefined, lang: 'th' | 'en', fallback = '?') {
  if (!item) return fallback
  return lang === 'th' ? item.nameTh || item.name : item.name
}

export function ItemLabel({ item, id }: { item?: Item; id?: string }) {
  const { settings } = useAppState()
  if (!item) return <span className="muted">{id ?? '?'}</span>
  const primary = displayName(item, settings.lang)
  const secondary = settings.lang === 'th' ? (item.nameTh ? item.name : '') : item.nameTh
  return (
    <span className="item-label">
      <ItemIcon item={item} />
      <span>
        <span className="item-primary">{primary}</span>
        {secondary && <span className="item-secondary">{secondary}</span>}
      </span>
    </span>
  )
}

const CATEGORY_HUE: Record<Item['category'], number> = { product: 45, intermediate: 200, raw: 120, group: 280 }

export const GRADE_COLOR = ['#9a9a9a', '#5fae3e', '#3b8fd6', '#d9a21e', '#e0662a']

export function ItemIcon({ item, size = 28 }: { item: Item; size?: number }) {
  // Only image data or bundled /icons/ files are ever used as an image source.
  const src = safeImageSrc(item.icon) ?? safeImageSrc(item.defaultIcon)
  if (src)
    return (
      <img
        className="item-icon"
        src={src}
        width={size}
        height={size}
        alt=""
        style={item.grade ? { borderColor: GRADE_COLOR[item.grade] } : undefined}
      />
    )
  const letter = (item.nameTh || item.name).trim().charAt(0)
  return (
    <span
      className="item-icon placeholder"
      style={{ width: size, height: size, background: `hsl(${CATEGORY_HUE[item.category]} 35% var(--placeholder-l))` }}
      aria-hidden
    >
      {letter}
    </span>
  )
}

/** Item picker with icons and type-to-search (a native <select> cannot show images). */
export function ItemSelect({
  items,
  value,
  onChange,
  filter,
  placeholder: placeholderProp,
  compare,
}: {
  items: Item[]
  value: string
  onChange: (id: string) => void
  filter?: (i: Item) => boolean
  placeholder?: string
  /** Image of the screenshot cell being identified, shown above the list for side-by-side comparison. */
  compare?: { src: string; caption?: string }
}) {
  const { settings } = useAppState()
  const t = useT()
  const placeholder = placeholderProp ?? t('— select item —')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number; above: boolean } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const list = useMemo(
    () => items.filter(filter ?? (() => true)).sort((a, b) => displayName(a, settings.lang).localeCompare(displayName(b, settings.lang))),
    [items, filter, settings.lang],
  )
  const q = query.trim().toLowerCase()
  const shown = q ? list.filter((i) => i.name.toLowerCase().includes(q) || (i.nameTh ?? '').includes(q) || i.id.includes(q)) : list
  const selected = items.find((i) => i.id === value)

  // Position the popup in viewport coordinates so tables and cards never clip it.
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 8
    const above = r.top - 8
    const showAbove = below < 260 && above > below
    setPos({
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, 340) - 8),
      top: showAbove ? r.top - 4 : r.bottom + 4,
      width: Math.max(r.width, 340),
      maxHeight: Math.min(420, showAbove ? above : below),
      above: showAbove,
    })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onMove = () => place()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openPicker = () => {
    setQuery('')
    setActive(Math.max(0, list.findIndex((i) => i.id === value)))
    setOpen(true)
  }
  const choose = (id: string) => {
    onChange(id)
    setOpen(false)
    btnRef.current?.focus()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(shown.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (shown[active]) choose(shown[active].id)
    } else if (e.key === 'Escape') {
      setOpen(false)
      btnRef.current?.focus()
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="picker-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            openPicker()
          }
        }}
      >
        {selected ? <PickerRow item={selected} lang={settings.lang} /> : <span className="muted">{placeholder}</span>}
        <span className="picker-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && pos && (
        <div
          ref={popRef}
          className="picker-pop"
          style={{
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
            ...(pos.above ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
          }}
        >
          {compare && (
            <div className="picker-compare">
              <img src={compare.src} alt={t('slot from your screenshot')} />
              <div className="small">
                <b>{t('Your slot')}</b>
                {compare.caption && <div className="muted">{compare.caption}</div>}
                <div className="muted">{t('Compare with the icons below.')}</div>
              </div>
            </div>
          )}
          <input
            autoFocus
            className="picker-search"
            placeholder={t('Search TH / EN…')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
          />
          <ul ref={listRef} role="listbox">
            <li
              role="option"
              aria-selected={!value}
              className={`picker-opt ${!value ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                choose('')
              }}
            >
              <span className="muted">{placeholder}</span>
            </li>
            {shown.map((i, idx) => (
              <li
                key={i.id}
                data-idx={idx}
                role="option"
                aria-selected={i.id === value}
                className={`picker-opt ${idx === active ? 'active' : ''} ${i.id === value ? 'selected' : ''}`}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(i.id)
                }}
              >
                <PickerRow item={i} lang={settings.lang} big />
              </li>
            ))}
            {!shown.length && <li className="picker-opt muted">{t('No match')}</li>}
          </ul>
        </div>
      )}
    </>
  )
}

function PickerRow({ item, lang, big }: { item: Item; lang: 'th' | 'en'; big?: boolean }) {
  const secondary = lang === 'th' ? (item.nameTh ? item.name : '') : item.nameTh
  return (
    <span className="item-label">
      <ItemIcon item={item} size={big ? 36 : 24} />
      <span className="picker-text">
        <span className="item-primary">{displayName(item, lang)}</span>
        {secondary && <span className="item-secondary">{secondary}</span>}
      </span>
    </span>
  )
}

export const CATEGORY_LABEL: Record<Item['category'], string> = {
  product: 'Products',
  intermediate: 'Intermediates (craftable)',
  raw: 'Raw materials',
  group: 'Ingredient groups (any of)',
}

/** Shared "average Alchemy yield" setting (applies to every normal Alchemy recipe). */
export function AlchemyYieldInput() {
  const { settings } = useAppState()
  const t = useT()
  const [draft, setDraft] = useState<string | null>(null)
  const commitDraft = () => {
    const v = Number((draft ?? '').replace(',', '.'))
    if (v > 0 && v <= 100) updateSettings({ alchemyYield: Math.round(v * 100) / 100 })
    setDraft(null)
  }
  return (
    <label className="alchemy-yield" title={t('Average elixirs/items you get from one normal Alchemy craft (procs included). Used for every Alchemy recipe; Simple Alchemy is not affected.')}>
      {t('Avg Alchemy yield per craft')}
      <input
        className="qty"
        inputMode="decimal"
        value={draft ?? String(settings.alchemyYield ?? 3)}
        onFocus={(e) => {
          setDraft(String(settings.alchemyYield ?? 3))
          e.target.select()
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  )
}
