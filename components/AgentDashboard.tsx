'use client'

import { useState, useEffect, useCallback } from 'react'
import { signOut } from 'next-auth/react'
import PixelOffice from './PixelOffice'
import type { AgentStatus } from '@/lib/agents'

export default function AgentDashboard({ initialAgents }: { initialAgents: AgentStatus[] }) {
  const [agents, setAgents] = useState(initialAgents)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      if (data.agents) {
        setAgents(data.agents)
        setLastRefresh(new Date())
      }
    } catch {}
  }, [])

  useEffect(() => {
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  const online = agents.filter(a => a.isOnline).length
  const total = agents.length

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏢</span>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">TheoSYN Agents</h1>
            <p className="text-zinc-500 text-xs mt-0.5">Live Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Online status */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300 text-sm font-medium">{online} / {total} online</span>
          </div>

          {/* Refresh */}
          <button
            onClick={refresh}
            className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            ↻ {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </button>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Pixel Office */}
      <div className="mb-6">
        <PixelOffice agents={agents} />
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {agents.map(a => (
          <div
            key={a.id}
            className={`bg-zinc-900 border rounded-xl p-3 transition-colors ${
              a.isOnline ? 'border-zinc-700' : 'border-zinc-800/50'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xl">{a.avatar_emoji}</span>
              <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${a.isOnline ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
            </div>
            <p className={`font-semibold text-sm ${a.isOnline ? 'text-white' : 'text-zinc-500'}`}>{a.name}</p>
            <p className="text-zinc-600 text-xs truncate">{a.role}</p>
            {a.lastAction && (
              <p className="text-zinc-500 text-xs mt-2 leading-relaxed line-clamp-2">{a.lastAction}</p>
            )}
            {a.minutesAgo !== null && (
              <p className="text-zinc-700 text-xs mt-1">
                {a.minutesAgo < 1 ? 'just now' : `${a.minutesAgo}m ago`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
