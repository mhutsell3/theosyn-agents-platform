'use client'

import { useEffect, useState } from 'react'

interface Agent {
  id: string
  name: string
  persona: string
  role: string
  avatar_emoji: string
  category: 'smb' | 'church'
  enabled: boolean
  ollama_model: string | null
  gemini_model: string | null
  last_heartbeat: string | null
}

const GEMINI_MODELS = [
  'gemini-2.0-flash-001',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]

// Which agents support Gemini
const GEMINI_AGENTS = ['Nova']

const AGENT_COLORS: Record<string, string> = {
  Nova:   'text-purple-400',
  Sage:   'text-emerald-400',
  Scout:  'text-amber-400',
  Piper:  'text-pink-400',
  Atlas:  'text-blue-400',
  Lumen:  'text-yellow-400',
  Theo:   'text-indigo-400',
  Remi:   'text-rose-400',
}

const ENV_DEFAULTS: Record<string, string> = {
  Nova:   'llama3.2:1b (env: OLLAMA_MODEL)',
  Sage:   'llama3.1:8b (env: OLLAMA_MODEL_RESEARCH)',
  Scout:  'llama3.1:8b (env: OLLAMA_MODEL)',
  Piper:  'llama3.1:8b (env: OLLAMA_MODEL)',
  Atlas:  'llama3.1:8b (env: OLLAMA_MODEL)',
  Lumen:  'llama3.1:8b (env: OLLAMA_MODEL)',
  Theo:   'llama3.1:8b (env: OLLAMA_MODEL)',
}

export default function AgentsTab() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [tab, setTab] = useState<'smb' | 'church'>('smb')

  useEffect(() => {
    fetch('/api/settings/agents')
      .then(r => r.json())
      .then(d => { setAgents(d.agents ?? []); setOllamaModels(d.ollamaModels ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function update(id: string, patch: Partial<Agent>) {
    setSaving(id)
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    await fetch('/api/settings/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    setSaving(null)
  }

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Loading agent settings...</div>

  const smbAgents    = agents.filter(a => a.category === 'smb')
  const churchAgents = agents.filter(a => a.category === 'church')
  const activeAgents = tab === 'smb' ? smbAgents : churchAgents

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        <button
          onClick={() => setTab('smb')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'smb' ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          💼 SMB ({smbAgents.length})
        </button>
        <button
          onClick={() => setTab('church')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'church' ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          🏛️ Church ({churchAgents.length})
        </button>
      </div>

      <p className="text-zinc-500 text-sm">
        {tab === 'smb'
          ? 'Enable or disable agents and choose which AI model each one uses. Disabled agents skip their scheduled tasks.'
          : 'Church agents are coming soon. You can preview them here — toggle on when ready to activate.'}
      </p>

      {activeAgents.map(agent => {
        const isChurch = agent.category === 'church'
        return (
        <div
          key={agent.id}
          className={`bg-zinc-900 border rounded-xl p-5 transition-opacity ${
            agent.enabled ? 'border-zinc-800' : 'border-zinc-900 opacity-50'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Left — agent info */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">{agent.avatar_emoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${AGENT_COLORS[agent.name] ?? 'text-white'}`}>
                    {agent.name}
                  </span>
                  {isChurch && (
                    <span className="text-xs bg-indigo-950 border border-indigo-800 text-indigo-400 px-2 py-0.5 rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>
                <div className="text-zinc-500 text-xs mt-0.5">{agent.role}</div>
                {isChurch && (
                  <div className="text-zinc-600 text-xs mt-1 max-w-md leading-relaxed">{agent.persona}</div>
                )}
              </div>
            </div>

            {/* Right — enabled toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {saving === agent.id && (
                <span className="text-zinc-600 text-xs">Saving...</span>
              )}
              <button
                onClick={() => update(agent.id, { enabled: !agent.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  agent.enabled ? 'bg-indigo-600' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    agent.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs w-14 ${agent.enabled ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {agent.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Model selectors — SMB only, church agents show placeholder */}
          {isChurch && agent.enabled && (
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <p className="text-zinc-600 text-xs">Model configuration will be available when this agent is built.</p>
            </div>
          )}
          {!isChurch && agent.enabled && (
            <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4">
              {/* Ollama model */}
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-xs w-24 shrink-0">Ollama Model</span>
                <select
                  value={agent.ollama_model ?? ''}
                  onChange={e => update(agent.id, { ollama_model: e.target.value || null })}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— use env default ({ENV_DEFAULTS[agent.name] ?? 'OLLAMA_MODEL'}) —</option>
                  {ollamaModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Gemini model — Nova only */}
              {GEMINI_AGENTS.includes(agent.name) && (
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-xs w-24 shrink-0">Gemini Model</span>
                  <select
                    value={agent.gemini_model ?? ''}
                    onChange={e => update(agent.id, { gemini_model: e.target.value || null })}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— use env default (GEMINI_MODEL) —</option>
                    {GEMINI_MODELS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
        )
      })}

      {activeAgents.length === 0 && (
        <div className="text-zinc-500 text-sm text-center py-8">
          No agents found. Make sure the agents table is seeded.
        </div>
      )}
    </div>
  )
}
