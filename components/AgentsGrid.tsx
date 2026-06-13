'use client'

import { useState } from 'react'
import { Agent, agentStatus } from '@/lib/types'

const AGENT_COLORS: Record<string, string> = {
  Nova:     'text-purple-400',
  Sage:     'text-emerald-400',
  Scout:    'text-amber-400',
  Piper:    'text-pink-400',
  Atlas:    'text-blue-400',
  Lumen:    'text-yellow-400',
  Theo:     'text-indigo-400',
  Remi:     'text-rose-400',
  Shepherd: 'text-sky-400',
  Steward:  'text-green-400',
  Herald:   'text-orange-400',
  Serve:    'text-teal-400',
  Welcome:  'text-cyan-400',
  Flock:    'text-violet-400',
  Gather:   'text-lime-400',
  Reach:    'text-red-400',
  Grant:    'text-fuchsia-400',
  Missions: 'text-blue-300',
}

export default function AgentsGrid({ agents }: { agents: Agent[] }) {
  const [tab, setTab] = useState<'smb' | 'church'>('smb')

  const smbAgents    = agents.filter(a => a.category === 'smb')
  const churchAgents = agents.filter(a => a.category === 'church')
  const activeAgents = tab === 'smb' ? smbAgents : churchAgents

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        <button
          onClick={() => setTab('smb')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'smb' ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          💼 SMB Agents <span className="ml-1 text-zinc-600 text-xs">({smbAgents.length})</span>
        </button>
        <button
          onClick={() => setTab('church')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'church' ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          🏛️ Church Agents <span className="ml-1 text-zinc-600 text-xs">({churchAgents.length})</span>
        </button>
      </div>

      {tab === 'church' && (
        <div className="bg-indigo-950 border border-indigo-800 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
          <div>
            <p className="text-indigo-300 text-sm font-medium">Church agents are coming soon</p>
            <p className="text-indigo-500 text-xs mt-0.5">These agents are in development. Enable them in Settings → Agents when ready.</p>
          </div>
          <span className="text-2xl">🏛️</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeAgents.map(agent => {
          const status = agentStatus(agent)
          const isChurch = agent.category === 'church'

          return (
            <div
              key={agent.id}
              className={`bg-zinc-900 border rounded-xl p-5 transition-opacity ${
                isChurch && !agent.enabled ? 'border-zinc-900 opacity-60' : 'border-zinc-800'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl w-12 h-12 flex items-center justify-center bg-zinc-800 rounded-full shrink-0">
                  {agent.avatar_emoji}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold ${AGENT_COLORS[agent.name] ?? 'text-white'}`}>{agent.name}</h3>
                    {isChurch && (
                      <span className="text-xs bg-indigo-950 border border-indigo-800 text-indigo-400 px-2 py-0.5 rounded-full shrink-0">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">{agent.role}</p>
                </div>
              </div>

              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{agent.persona}</p>

              <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                {isChurch ? (
                  <span className={`text-xs flex items-center gap-1.5 ${agent.enabled ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${agent.enabled ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                    {agent.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                ) : (
                  <span className={`text-xs capitalize flex items-center gap-1.5 ${
                    status === 'online' ? 'text-emerald-400' : status === 'idle' ? 'text-amber-400' : 'text-zinc-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      status === 'online' ? 'bg-emerald-400' : status === 'idle' ? 'bg-amber-400' : 'bg-zinc-600'
                    }`} />
                    {status}
                  </span>
                )}
                <span className="text-zinc-600 text-xs">
                  {isChurch
                    ? 'No heartbeat'
                    : agent.last_heartbeat
                      ? `Last: ${new Date(agent.last_heartbeat).toLocaleTimeString()}`
                      : 'No heartbeat'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
