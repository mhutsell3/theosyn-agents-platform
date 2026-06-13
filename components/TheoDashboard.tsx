'use client'

import { useState, useEffect } from 'react'

interface Session {
  id: string
  trigger: string
  mode: string
  model: string
  summary: string | null
  status: string
  rounds: number
  action_count: number
  created_at: string
  completed_at: string | null
}

interface SessionDetail {
  id: string
  trigger: string
  mode: string
  model: string
  thinking: string | null
  actions: { tool: string; params: Record<string, unknown> | null; result: unknown; ok: boolean }[]
  summary: string | null
  status: string
  rounds: number
  created_at: string
  completed_at: string | null
}

interface Props {
  autonomous: boolean
  model: string
}

export default function TheoDashboard({ autonomous, model }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [selected, setSelected] = useState<SessionDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [thinkResult, setThinkResult] = useState<string | null>(null)

  async function loadSessions() {
    const res = await fetch('/api/theo/sessions')
    const data = await res.json()
    setSessions(data.sessions ?? [])
    setLoading(false)
  }

  async function loadDetail(id: string) {
    if (selected?.id === id) { setSelected(null); return }
    setLoadingDetail(true)
    const res = await fetch(`/api/theo/sessions/${id}`)
    const data = await res.json()
    const session = data.session
    if (session && typeof session.actions === 'string') {
      try { session.actions = JSON.parse(session.actions) } catch { session.actions = [] }
    }
    setSelected(session)
    setLoadingDetail(false)
  }

  async function triggerThink() {
    setThinking(true)
    setThinkResult(null)
    const res = await fetch('/api/theo/think', { method: 'POST' })
    const data = await res.json()
    setThinkResult(data.summary ?? data.error ?? 'Done')
    setThinking(false)
    await loadSessions()
  }

  useEffect(() => { loadSessions() }, [])

  const statusColor = (s: string) =>
    s === 'completed' ? 'text-emerald-400' :
    s === 'running'   ? 'text-amber-400' :
    s === 'failed'    ? 'text-red-400' : 'text-zinc-400'

  const modeColor = (m: string) =>
    m === 'autonomous' ? 'bg-rose-900 text-rose-300' :
    m === 'report' ? 'bg-blue-900 text-blue-300' :
    'bg-zinc-800 text-zinc-400'

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧠</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Theo</h1>
            <p className="text-zinc-500 text-sm">Autonomous Business Operator — orchestrates all agents using {model}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${autonomous ? 'bg-rose-900 text-rose-300' : 'bg-zinc-800 text-zinc-400'}`}>
            {autonomous ? '⚡ Autonomous' : '👁 Observe Only'}
          </span>
          <button
            onClick={triggerThink}
            disabled={thinking}
            className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-colors font-medium"
          >
            {thinking ? '⏳ Thinking...' : '🧠 Think Now'}
          </button>
        </div>
      </div>

      {/* Mode explanation */}
      <div className={`rounded-xl p-4 border text-sm ${autonomous ? 'bg-rose-950/30 border-rose-800 text-rose-200' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
        {autonomous
          ? '⚡ Theo is in AUTONOMOUS mode. He can read all agent data AND take action — trigger Scout searches, approve leads, generate content, run analyses.'
          : '👁 Theo is in OBSERVE mode. He reads all agent data and produces recommendations but takes no action. Set THEO_AUTONOMOUS=true in .env.local to enable full autonomy.'}
      </div>

      {/* Think result */}
      {thinkResult && (
        <div className="bg-indigo-950/40 border border-indigo-700 rounded-xl p-4">
          <p className="text-indigo-300 text-xs font-semibold mb-2">LATEST SUMMARY</p>
          <p className="text-white text-sm whitespace-pre-wrap">{thinkResult}</p>
        </div>
      )}

      {/* Sessions list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Recent Sessions</h2>
          <button onClick={loadSessions} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">↻ Refresh</button>
        </div>

        {loading && <p className="text-zinc-500 text-sm text-center py-6">Loading...</p>}
        {!loading && sessions.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-6">No sessions yet — click "Think Now" to run Theo's first review.</p>
        )}

        {sessions.map(s => (
          <div key={s.id}>
            <button
              onClick={() => loadDetail(s.id)}
              className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 flex items-start justify-between gap-4 transition-colors"
            >
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${statusColor(s.status)}`}>{s.status.toUpperCase()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${modeColor(s.mode)}`}>{s.mode}</span>
                  <span className="text-zinc-600 text-xs">{s.trigger}</span>
                  <span className="text-zinc-700 text-xs">{s.rounds} rounds · {s.action_count} actions</span>
                </div>
                <p className="text-zinc-300 text-sm line-clamp-2">{s.summary ?? 'Running...'}</p>
                <p className="text-zinc-600 text-xs">{new Date(s.created_at).toLocaleString()}</p>
              </div>
              <span className="text-zinc-600 text-xs flex-shrink-0">{selected?.id === s.id ? '▲' : '▼'}</span>
            </button>

            {selected?.id === s.id && (
              <div className="bg-zinc-950 border border-zinc-800 border-t-0 rounded-b-xl p-5 flex flex-col gap-4">
                {loadingDetail ? (
                  <p className="text-zinc-500 text-sm">Loading detail...</p>
                ) : (
                  <>
                    {selected.thinking && (
                      <div>
                        <p className="text-zinc-500 text-xs font-semibold uppercase mb-2">Theo's Reasoning</p>
                        <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{selected.thinking}</p>
                      </div>
                    )}
                    {selected.actions.length > 0 && (
                      <div>
                        <p className="text-zinc-500 text-xs font-semibold uppercase mb-2">Tools Called ({selected.actions.length})</p>
                        <div className="flex flex-col gap-2">
                          {selected.actions.map((a, i) => (
                            <div key={i} className={`rounded-lg p-3 text-xs font-mono border ${a.ok ? 'bg-zinc-900 border-zinc-800' : 'bg-red-950/30 border-red-800'}`}>
                              <span className={`font-semibold ${a.ok ? 'text-indigo-400' : 'text-red-400'}`}>{a.tool}</span>
                              {a.params && Object.keys(a.params as object).length > 0 && (
                                <span className="text-zinc-500 ml-2">{JSON.stringify(a.params)}</span>
                              )}
                              <div className="text-zinc-400 mt-1 truncate">{JSON.stringify(a.result).slice(0, 200)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
