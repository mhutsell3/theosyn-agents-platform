'use client'

import { useState } from 'react'
import type { AgentStatus } from '@/lib/agents'

const AGENT_COLORS: Record<string, string> = {
  Theo:   '#6366f1', Scout:  '#10b981', Nova:   '#f59e0b',
  Quill:  '#8b5cf6', Beacon: '#06b6d4', Flow:   '#3b82f6',
  Piper:  '#ec4899', Remi:   '#ef4444', Sage:   '#84cc16',
  Lumen:  '#f97316', Atlas:  '#64748b', Scribe: '#a78bfa',
}

function AgentCard({ agent, onClick, selected }: {
  agent: AgentStatus
  onClick: () => void
  selected: boolean
}) {
  const color = AGENT_COLORS[agent.name] ?? '#6366f1'
  const online = agent.isOnline

  return (
    <button
      onClick={onClick}
      className="relative text-left w-full group transition-all duration-200"
      style={{ outline: selected ? `2px solid ${color}` : 'none', borderRadius: 16 }}
    >
      <div
        className={`relative rounded-2xl p-4 border transition-all duration-200 ${
          online
            ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
            : 'bg-zinc-950 border-zinc-800/50 opacity-60 hover:opacity-80'
        }`}
      >
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="relative">
            <span className="text-3xl leading-none">{agent.avatar_emoji}</span>
            {/* Online pulse */}
            {online && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
                <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: color }} />
              </span>
            )}
          </div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: online ? `${color}22` : '#1f2937',
              color: online ? color : '#6b7280',
            }}
          >
            {online ? 'Online' : 'Idle'}
          </span>
        </div>

        {/* Name + role */}
        <p className="font-bold text-sm text-white leading-none mb-0.5">{agent.name}</p>
        <p className="text-zinc-500 text-xs leading-tight truncate">{agent.role}</p>

        {/* Activity bar */}
        {online && agent.lastAction && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">{agent.lastAction}</p>
          </div>
        )}

        {/* Time ago */}
        {agent.minutesAgo !== null && (
          <p className="text-zinc-700 text-xs mt-2">
            {agent.minutesAgo < 1 ? 'Active just now' : `Active ${agent.minutesAgo}m ago`}
          </p>
        )}

        {/* Color accent bar at bottom */}
        <div
          className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full transition-opacity duration-200"
          style={{ backgroundColor: color, opacity: online ? 0.6 : 0.15 }}
        />
      </div>
    </button>
  )
}

export default function PixelOffice({ agents }: { agents: AgentStatus[] }) {
  const [selected, setSelected] = useState<AgentStatus | null>(null)

  // Sort: online first
  const sorted = [...agents].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1
    if (!a.isOnline && b.isOnline) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-4">
      {/* Agent grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {sorted.map(a => (
          <AgentCard
            key={a.id}
            agent={a}
            selected={selected?.id === a.id}
            onClick={() => setSelected(s => s?.id === a.id ? null : a)}
          />
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <div
          className="rounded-2xl border p-5 bg-zinc-900 transition-all"
          style={{ borderColor: `${AGENT_COLORS[selected.name] ?? '#6366f1'}44` }}
        >
          <div className="flex items-center gap-4">
            <span className="text-5xl">{selected.avatar_emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-white font-bold text-lg">{selected.name}</h3>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: selected.isOnline ? `${AGENT_COLORS[selected.name] ?? '#6366f1'}22` : '#1f2937',
                    color: selected.isOnline ? (AGENT_COLORS[selected.name] ?? '#6366f1') : '#6b7280',
                  }}
                >
                  {selected.isOnline ? 'Online' : 'Idle'}
                </span>
              </div>
              <p className="text-zinc-400 text-sm">{selected.role}</p>
              {selected.ollama_model && (
                <p className="text-zinc-600 text-xs font-mono mt-1">{selected.ollama_model}</p>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-zinc-600 hover:text-zinc-400 text-lg leading-none self-start"
            >
              ✕
            </button>
          </div>

          {selected.lastAction && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Last Activity</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{selected.lastAction}</p>
            </div>
          )}

          {selected.minutesAgo !== null && (
            <p className="text-zinc-600 text-xs mt-3">
              {selected.minutesAgo < 1 ? 'Active just now' : `Active ${selected.minutesAgo} minute${selected.minutesAgo !== 1 ? 's' : ''} ago`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
