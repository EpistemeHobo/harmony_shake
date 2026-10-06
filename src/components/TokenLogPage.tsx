import { useMemo } from 'react'
import { clearTokenLog, useAppState } from '../store'
import type { TokenLogEntry } from '../types'
import { fmt } from './common'
import { useT } from '../i18n'

/** USD per million tokens (Anthropic API list prices). Cache writes (5-min TTL) bill at 1.25× input. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1 },
}

function priceFor(model: string) {
  return PRICES[model] ?? Object.entries(PRICES).find(([id]) => model.startsWith(id))?.[1]
}

/** Estimated cost in USD, or null when the model's price is unknown. */
function estimateCost(e: TokenLogEntry): number | null {
  const p = priceFor(e.servedBy || e.model)
  if (!p) return null
  return (e.inputTokens * p.input + e.outputTokens * p.output + e.cacheReadTokens * p.cacheRead + e.cacheWriteTokens * p.input * 1.25) / 1e6
}

const usd = (n: number | null) => (n == null ? '?' : `$${n.toFixed(n < 0.01 ? 4 : 3)}`)

function dayKey(at: number) {
  return new Date(at).toLocaleDateString()
}

export default function TokenLogPage() {
  const t = useT()
  const { tokenLog = [] } = useAppState()

  const totals = useMemo(() => {
    const sum = { calls: 0, input: 0, output: 0, cache: 0, cost: 0 }
    const byDay = new Map<string, { calls: number; tokens: number; cost: number }>()
    for (const e of tokenLog) {
      const cost = estimateCost(e) ?? 0
      sum.calls++
      sum.input += e.inputTokens
      sum.output += e.outputTokens
      sum.cache += e.cacheReadTokens + e.cacheWriteTokens
      sum.cost += cost
      const d = byDay.get(dayKey(e.at)) ?? { calls: 0, tokens: 0, cost: 0 }
      d.calls++
      d.tokens += e.inputTokens + e.outputTokens + e.cacheReadTokens + e.cacheWriteTokens
      d.cost += cost
      byDay.set(dayKey(e.at), d)
    }
    return { sum, byDay: [...byDay.entries()] }
  }, [tokenLog])

  const download = () => {
    const header = 'time,kind,model,served_by,input,output,cache_read,cache_write,stop_reason,duration_ms,est_cost_usd'
    const lines = tokenLog.map((e) =>
      [
        new Date(e.at).toISOString(),
        e.kind,
        e.model,
        e.servedBy,
        e.inputTokens,
        e.outputTokens,
        e.cacheReadTokens,
        e.cacheWriteTokens,
        e.stopReason,
        e.durationMs,
        estimateCost(e)?.toFixed(6) ?? '',
      ].join(','),
    )
    const url = URL.createObjectURL(new Blob([[header, ...lines].join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `harmony-shake-tokens-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clear = () => {
    if (confirm(t('Clear the whole token log?'))) clearTokenLog()
  }

  return (
    <section>
      <div className="card">
        <h3>{t('Token usage')}</h3>
        <p className="muted small">
          {t('Every Claude API call made by the screenshot reader is logged here (stored in this browser only). Cost is an estimate from list prices.')}
        </p>
        <p>
          {t('{calls} call(s) · input {input} · output {output} · cache {cache} · est. {cost}')
            .split(/(\{\w+\})/)
            .map((part, i) => {
              const v: Record<string, string> = {
                '{calls}': fmt(totals.sum.calls),
                '{input}': fmt(totals.sum.input),
                '{output}': fmt(totals.sum.output),
                '{cache}': fmt(totals.sum.cache),
                '{cost}': usd(totals.sum.cost),
              }
              return part in v ? <b key={i}>{v[part]}</b> : part
            })}
        </p>
        <div className="row-wrap">
          <button onClick={download} disabled={!tokenLog.length}>
            {t('Export CSV')}
          </button>
          <button onClick={clear} disabled={!tokenLog.length}>
            {t('Clear log')}
          </button>
        </div>
      </div>

      {totals.byDay.length > 0 && (
        <div className="card">
          <h3>{t('Per day')}</h3>
          <table className="grid">
            <thead>
              <tr>
                <th>{t('Day')}</th>
                <th className="num">{t('Calls')}</th>
                <th className="num">{t('Tokens')}</th>
                <th className="num">{t('Est. cost')}</th>
              </tr>
            </thead>
            <tbody>
              {totals.byDay.map(([day, d]) => (
                <tr key={day}>
                  <td>{day}</td>
                  <td className="num">{fmt(d.calls)}</td>
                  <td className="num">{fmt(d.tokens)}</td>
                  <td className="num">{usd(d.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>{t('Calls')}</h3>
        {!tokenLog.length && <p className="muted">{t('No API calls yet. Scan a screenshot to see usage here.')}</p>}
        {tokenLog.length > 0 && (
          <table className="grid">
            <thead>
              <tr>
                <th>{t('When')}</th>
                <th>{t('Kind')}</th>
                <th>{t('Model')}</th>
                <th className="num">{t('Input')}</th>
                <th className="num">{t('Output')}</th>
                <th className="num">{t('Cache read / write')}</th>
                <th className="num">{t('Total')}</th>
                <th className="num">{t('Time')}</th>
                <th className="num">{t('Est. cost')}</th>
              </tr>
            </thead>
            <tbody>
              {tokenLog.map((e, i) => (
                <tr key={`${e.at}-${i}`}>
                  <td>{new Date(e.at).toLocaleString()}</td>
                  <td>
                    {e.kind}
                    {e.stopReason && e.stopReason !== 'end_turn' && <span className="bad small"> ({e.stopReason})</span>}
                  </td>
                  <td>
                    {e.servedBy || e.model}
                    {e.servedBy && e.servedBy !== e.model && <span className="muted small"> {t('(asked {model})', { model: e.model })}</span>}
                  </td>
                  <td className="num">{fmt(e.inputTokens)}</td>
                  <td className="num">{fmt(e.outputTokens)}</td>
                  <td className="num">
                    {fmt(e.cacheReadTokens)} / {fmt(e.cacheWriteTokens)}
                  </td>
                  <td className="num">
                    <b>{fmt(e.inputTokens + e.outputTokens + e.cacheReadTokens + e.cacheWriteTokens)}</b>
                  </td>
                  <td className="num">{(e.durationMs / 1000).toFixed(1)}s</td>
                  <td className="num">{usd(estimateCost(e))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
