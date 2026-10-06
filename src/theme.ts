import { useEffect, useState } from 'react'
import { useAppState } from './store'

export type EffectiveTheme = 'dark' | 'light'

/** The theme actually in use ('system' resolved), kept in sync with the OS setting and applied to <html data-theme>. */
export function useEffectiveTheme(): EffectiveTheme {
  const { settings } = useAppState()
  const pref = settings.theme ?? 'dark'
  const [systemLight, setSystemLight] = useState(() => window.matchMedia('(prefers-color-scheme: light)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setSystemLight(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme: EffectiveTheme = pref === 'system' ? (systemLight ? 'light' : 'dark') : pref
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return theme
}
