'use client'

import { useState } from 'react'
import type { AdminAgent } from '@/lib/agents'

export default function AdminAgentList({ initialAgents }: { initialAgents: AdminAgent[] }) {
  const [agents, setAgents] = useState(initialAgents)
  const [pending, setPending] = useState<Set<string>>(new Set())

  async function toggle(agentId: string, current: boolean) {
    setPending(p => new Set(p).add(agentId))
    const res = await fetch('/api/admin/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, system_enabled: !current }),
    })
    if (res.ok) {
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, system_enabled: !current } : a))
    }
    setPending(p => { const n = new Set(p); n.delete(agentId); return n })
  }

  const grouped = agents.reduce<Record<string, AdminAgent[]>>((acc, a) => {
    const key = a.org_name ?? 'Unassigned'
    ;(acc[key] ??= []).push(a)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([orgName, orgAgents]) => (
        <div key={orgName} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">{orgName}</span>
            <span className="text-zinc-600 text-xs">· {orgAgents.length} agent{orgAgents.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {orgAgents.map(a => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{a.avatar_emoji}</span>
                  <div>
                    <p className={`text-sm font-medium ${a.system_enabled ? 'text-white' : 'text-zinc-500 line-through'}`}>
                      {a.name}
                    </p>
                    <p className="text-zinc-500 text-xs">{a.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!a.system_enabled && (
                    <span className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
                      Globally disabled
                    </span>
                  )}
                  <button
                    onClick={() => toggle(a.id, a.system_enabled)}
                    disabled={pending.has(a.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                      a.system_enabled ? 'bg-indigo-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      a.system_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {agents.length === 0 && (
        <p className="text-zinc-600 text-sm text-center py-12">No agents in the system yet.</p>
      )}
    </div>
  )
}
