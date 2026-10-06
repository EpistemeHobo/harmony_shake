import { useEffect, useState } from 'react'
import InventoryPage from './components/InventoryPage'
import CalculatorPage from './components/CalculatorPage'
import ScanPage from './components/ScanPage'
import RecipesPage from './components/RecipesPage'
import SettingsPage from './components/SettingsPage'
import TokenLogPage from './components/TokenLogPage'
import { useT } from './i18n'
import Caustics from './components/Caustics'
import { useEffectiveTheme } from './theme'
import { updateSettings } from './store'

const TABS = [
  { id: 'calc', label: 'Calculator', el: <CalculatorPage /> },
  { id: 'stock', label: 'Stock', el: <InventoryPage /> },
  { id: 'scan', label: 'Scan screenshot', el: <ScanPage /> },
  { id: 'recipes', label: 'Recipes & items', el: <RecipesPage /> },
  { id: 'tokens', label: 'Token log', el: <TokenLogPage /> },
  { id: 'settings', label: 'Settings', el: <SettingsPage /> },
] as const

type TabId = (typeof TABS)[number]['id']

function readHash(): TabId {
  const h = location.hash.slice(1)
  return (TABS.find((t) => t.id === h)?.id ?? 'calc') as TabId
}

export default function App() {
  const t = useT()
  const [tab, setTab] = useState<TabId>(readHash)
  const theme = useEffectiveTheme()

  useEffect(() => {
    const onHash = () => setTab(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="app">
      <Caustics light={theme === 'light'} />
      <header>
        <h1>
          <span className="logo">⚗</span> Harmony Shake
          <small>{t('BDO Harmony Draught (Edania) planner')}</small>
        </h1>
        <nav>
          {TABS.map((tb) => (
            <a key={tb.id} href={`#${tb.id}`} className={tab === tb.id ? 'active' : ''}>
              {t(tb.label)}
            </a>
          ))}
          <button
            className="theme-toggle"
            title={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}
            aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}
            onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </nav>
      </header>
      <main>
        {/* All tabs stay mounted so switching away doesn't lose in-progress work (e.g. scanned screenshots). */}
        {TABS.map((tb) => (
          <div key={tb.id} hidden={tb.id !== tab}>
            {tb.el}
          </div>
        ))}
      </main>
    </div>
  )
}
