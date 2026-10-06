import { useAppState, getState } from '../store'
import { TH_CORE } from './th-core'
import { TH_SCAN } from './th-scan'
import { TH_RECIPES } from './th-recipes'
import { TH_SETTINGS } from './th-settings'

export type Lang = 'th' | 'en'

/** Thai translations keyed by the English source text. Missing keys fall back to English. */
const TH: Record<string, string> = { ...TH_CORE, ...TH_SCAN, ...TH_RECIPES, ...TH_SETTINGS }

/**
 * Translate an English UI string. `{name}` placeholders are filled from `vars`.
 *   t('Updated {n} item(s)', { n: 3 })
 */
export function translate(lang: Lang, en: string, vars?: Record<string, string | number>): string {
  let s = lang === 'th' ? (TH[en] ?? en) : en
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

export type TFunc = (en: string, vars?: Record<string, string | number>) => string

/** Hook for components: re-renders when the language setting changes. */
export function useT(): TFunc {
  const { settings } = useAppState()
  return (en, vars) => translate(settings.lang, en, vars)
}

export function useLang(): Lang {
  return useAppState().settings.lang
}

/** For non-component code (alerts, confirms) that runs outside render. */
export function tNow(en: string, vars?: Record<string, string | number>): string {
  return translate(getState().settings.lang, en, vars)
}
