'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface StaleClient {
  id: string
  name: string
  stage: string
  daysInStage: number
  contact_name: string | null
  contact_email: string | null
}

const stageColor: Record<string, string> = {
  Discovery:  'text-zinc-400',
  Proposal:   'text-blue-400',
  Onboarding: 'text-amber-400',
  Active:     'text-emerald-400',
}

export default function PiperPanel() {
  const [stale, setStale] = useState<StaleClient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<StaleClient | null>(null)
  const [followUp, setFollowUp] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<string | null>(null)
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false)
  const [generatingChecklist, setGeneratingChecklist] = useState(false)
  const [runningHeartbeat, setRunningHeartbeat] = useState(false)
  const [heartbeatResult, setHeartbeatResult] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => { scanPipeline() }, [])

  async function scanPipeline() {
    setLoading(true)
    const res = await fetch('/api/piper/scan')
    if (res.ok) {
      const data = await res.json()
      setStale(data.stale ?? [])
    }
    setLoading(false)
  }

  async function handleFollowUp(client: StaleClient) {
    setSelectedClient(client)
    setFollowUp(null)
    setChecklist(null)
    setGeneratingFollowUp(true)
    const res = await fetch('/api/piper/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id }),
    })
    const data = await res.json()
    setFollowUp(data.email)
    setGeneratingFollowUp(false)
  }

  async function handleOnboarding(client: StaleClient) {
    setSelectedClient(client)
    setFollowUp(null)
    setChecklist(null)
    setGeneratingChecklist(true)
    const res = await fetch('/api/piper/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id }),
    })
    const data = await res.json()
    setChecklist(data.checklist)
    setGeneratingChecklist(false)
  }

  async function handleHeartbeat() {
    setRunningHeartbeat(true)
    setHeartbeatResult(null)
    const res = await fetch('/api/piper/heartbeat', { method: 'POST' })
    const data = await res.json()
    setHeartbeatResult(`💓 Piper wrote her weekly pipeline report. ${data.staleCount} clients flagged.`)
    setRunningHeartbeat(false)
    router.refresh()
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤝</span>
          <div>
            <h3 className="text-white font-semibold text-sm">Piper — Client Relations</h3>
            <p className="text-zinc-500 text-xs">Pipeline health, follow-ups, onboarding</p>
          </div>
        </div>
        <button
          onClick={handleHeartbeat}
          disabled={runningHeartbeat}
          className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
        >
          {runningHeartbeat ? '💓 Running...' : '💓 Weekly Report'}
        </button>
      </div>

      {heartbeatResult && (
        <p className="text-emerald-400 text-xs">{heartbeatResult}</p>
      )}

      {/* Flagged clients */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">
            Needs Attention
          </span>
          <button onClick={scanPipeline} className="text-zinc-600 hover:text-zinc-400 text-xs">
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-zinc-600 text-xs">Scanning pipeline...</p>
        ) : stale.length === 0 ? (
          <p className="text-emerald-400 text-xs">✓ All clients are on track</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stale.map(client => (
              <div
                key={client.id}
                className={`bg-zinc-800 rounded-lg p-3 flex items-start gap-3 border ${selectedClient?.id === client.id ? 'border-indigo-700' : 'border-transparent'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{client.name}</p>
                    <span className={`text-xs ${stageColor[client.stage] ?? 'text-zinc-400'}`}>
                      {client.stage}
                    </span>
                  </div>
                  {client.contact_name && (
                    <p className="text-zinc-500 text-xs">{client.contact_name}</p>
                  )}
                  <p className="text-amber-400 text-xs mt-0.5">
                    ⏰ {client.daysInStage}d without contact
                  </p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleFollowUp(client)}
                    disabled={generatingFollowUp && selectedClient?.id === client.id}
                    className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
                  >
                    ✉️ Follow-up
                  </button>
                  {client.stage === 'Onboarding' && (
                    <button
                      onClick={() => handleOnboarding(client)}
                      disabled={generatingChecklist && selectedClient?.id === client.id}
                      className="text-xs bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
                    >
                      📋 Checklist
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generated content */}
      {(generatingFollowUp || generatingChecklist) && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <span className="animate-spin">⏳</span>
          {generatingFollowUp ? 'Piper is writing a follow-up...' : 'Generating onboarding checklist...'}
        </div>
      )}

      {followUp && selectedClient && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">
              Follow-up for {selectedClient.name}
            </span>
            <button
              onClick={() => copyToClipboard(followUp)}
              className="text-zinc-600 hover:text-indigo-400 text-xs transition-colors"
            >
              Copy ↗
            </button>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 max-h-56 overflow-y-auto">
            <p className="text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed">{followUp}</p>
          </div>
        </div>
      )}

      {checklist && selectedClient && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">
              Onboarding — {selectedClient.name}
            </span>
            <button
              onClick={() => copyToClipboard(checklist)}
              className="text-zinc-600 hover:text-indigo-400 text-xs transition-colors"
            >
              Copy ↗
            </button>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 max-h-56 overflow-y-auto">
            {checklist.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <p key={i} className="text-white text-xs font-semibold mt-2 mb-1">{line.slice(3)}</p>
              if (line.startsWith('- [ ]')) return <p key={i} className="text-zinc-300 text-xs flex gap-2">☐ <span>{line.slice(5)}</span></p>
              if (line.startsWith('- ')) return <p key={i} className="text-zinc-300 text-xs">• {line.slice(2)}</p>
              if (line.trim() === '') return <div key={i} className="h-1" />
              return <p key={i} className="text-zinc-400 text-xs">{line}</p>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
