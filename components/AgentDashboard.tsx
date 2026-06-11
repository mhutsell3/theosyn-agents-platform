'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { signOut } from 'next-auth/react'
import PixelOffice from './PixelOffice'
import type { AgentStatus } from '@/lib/agents'

export default function AgentDashboard({ initialAgents }: { initialAgents: AgentStatus[] }) {
  const [agents, setAgents] = useState(initialAgents)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [meetingActive, setMeetingActive] = useState(false)
  const callMeetingFnRef = useRef<(() => void) | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      if (data.agents) { setAgents(data.agents); setLastRefresh(new Date()) }
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
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300 text-sm font-medium">{online} / {total} online</span>
          </div>
          <button onClick={refresh} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
            ↻ {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </button>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
            Sign out
          </button>
        </div>
      </div>

      {/* Call Meeting button — completely outside canvas */}
      <div className="mb-4">
        <button
          onClick={() => callMeetingFnRef.current?.()}
          disabled={meetingActive}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: meetingActive ? '#1e293b' : 'rgba(99,102,241,0.2)',
            border: '1px solid rgba(99,102,241,0.5)',
            color: meetingActive ? '#6366f1' : '#a5b4fc',
          }}
        >
          <span className="text-base">{meetingActive ? '🔴' : '📢'}</span>
          {meetingActive ? 'Meeting in progress…' : 'Call Meeting'}
        </button>
      </div>

      {/* Canvas */}
      <PixelOffice
        agents={agents}
        onCallMeeting={(fn) => { callMeetingFnRef.current = fn }}
        onMeetingChange={setMeetingActive}
      />
    </div>
  )
}
