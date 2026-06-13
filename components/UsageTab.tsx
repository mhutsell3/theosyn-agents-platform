'use client'

import { useEffect, useState } from 'react'

interface ModelRow {
  model: string
  provider: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  calls: number
  estimated_cost: number
}

interface AgentRow {
  agent: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  calls: number
}

interface DailyRow {
  date: string
  total_tokens: number
  calls: number
  provider: string
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function fmtCost(n: number) {
  if (n === 0) return '—'
  if (n < 0.001) return '<$0.001'
  return '$' + n.toFixed(4)
}

const PROVIDER_BADGE: Record<string, string> = {
  gemini: 'bg-blue-900 text-blue-300 border border-blue-700',
  ollama: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
}

const AGENT_COLORS: Record<string, string> = {
  Nova:   'text-purple-400',
  Sage:   'text-emerald-400',
  Scout:  'text-amber-400',
  Piper:  'text-pink-400',
  Atlas:  'text-blue-400',
  Lumen:  'text-yellow-400',
  Theo:   'text-indigo-400',
}

export default function UsageTab() {
  const [data, setData] = useState<{ byModel: ModelRow[]; byAgent: AgentRow[]; daily: DailyRow[]; totalCost: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/usage')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Loading usage data...</div>
  if (!data) return <div className="text-red-400 text-sm py-8 text-center">Failed to load usage data.</div>

  const totalTokens = data.byModel.reduce((s, r) => s + r.total_tokens, 0)
  const totalCalls  = data.byModel.reduce((s, r) => s + r.calls, 0)
  const geminiTokens = data.byModel.filter(r => r.provider === 'gemini').reduce((s, r) => s + r.total_tokens, 0)

  // Group daily by date (merge providers)
  const dailyMap: Record<string, number> = {}
  for (const row of data.daily) {
    dailyMap[row.date] = (dailyMap[row.date] ?? 0) + row.total_tokens
  }
  const dailyRows = Object.entries(dailyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14)

  return (
    <div className="flex flex-col gap-8">

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tokens', value: fmt(totalTokens) },
          { label: 'Total API Calls', value: totalCalls.toLocaleString() },
          { label: 'Gemini Tokens', value: fmt(geminiTokens) },
          { label: 'Gemini Est. Cost', value: data.totalCost > 0 ? '$' + data.totalCost.toFixed(4) : '$0.00' },
        ].map(c => (
          <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-500 text-xs mb-1">{c.label}</div>
            <div className="text-white text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      {/* By Model */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Usage by Model</h2>
        {data.byModel.length === 0 ? (
          <p className="text-zinc-500 text-sm">No usage recorded yet. Agent activity will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                  <th className="text-left pb-2 pr-4">Model</th>
                  <th className="text-left pb-2 pr-4">Provider</th>
                  <th className="text-right pb-2 pr-4">Calls</th>
                  <th className="text-right pb-2 pr-4">Input</th>
                  <th className="text-right pb-2 pr-4">Output</th>
                  <th className="text-right pb-2 pr-4">Total</th>
                  <th className="text-right pb-2">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.byModel.map(row => (
                  <tr key={row.model} className="text-zinc-300">
                    <td className="py-2 pr-4 font-mono text-xs text-white">{row.model}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PROVIDER_BADGE[row.provider] ?? 'bg-zinc-800 text-zinc-400'}`}>
                        {row.provider}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">{row.calls.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{fmt(row.prompt_tokens)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(row.completion_tokens)}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{fmt(row.total_tokens)}</td>
                    <td className="py-2 text-right text-emerald-400">{fmtCost(row.estimated_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By Agent */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Usage by Agent</h2>
        {data.byAgent.length === 0 ? (
          <p className="text-zinc-500 text-sm">No agent usage recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.byAgent.map(row => {
              const pct = totalTokens > 0 ? (row.total_tokens / totalTokens) * 100 : 0
              return (
                <div key={row.agent}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`font-semibold ${AGENT_COLORS[row.agent] ?? 'text-white'}`}>{row.agent}</span>
                    <span className="text-zinc-400">{fmt(row.total_tokens)} tokens · {row.calls} calls</span>
                  </div>
                  <div className="bg-zinc-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Daily (last 14 days) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Daily Tokens — Last 14 Days</h2>
        {dailyRows.length === 0 ? (
          <p className="text-zinc-500 text-sm">No daily data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                  <th className="text-left pb-2 pr-4">Date</th>
                  <th className="text-right pb-2">Total Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {dailyRows.map(([date, tokens]) => (
                  <tr key={date} className="text-zinc-300">
                    <td className="py-2 pr-4">{date}</td>
                    <td className="py-2 text-right font-semibold">{fmt(tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-zinc-600 text-xs mt-3">Ollama runs locally — tokens are tracked for volume visibility but have no cost.</p>
      </div>
    </div>
  )
}
