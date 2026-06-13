'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Agent, agentStatus } from '@/lib/types'

const AGENT_ROUTES: Record<string, string> = {
  Theo:     '/agents',
  Piper:    '/clients',
  Atlas:    '/projects',
  Nova:     '/content',
  Lumen:    '/finance',
  Sage:     '/sage',
  Scout:    '/scout',
  Remi:     '/remi',
  Beacon:   '/beacon',
  Pulse:    '/pulse',
  Scribe:   '/scribe',
  Logos:    '/logos',
  Shepherd: '/agents',
  Steward:  '/agents',
  Herald:   '/agents',
  Serve:    '/agents',
  Welcome:  '/agents',
  Flock:    '/agents',
  Gather:   '/agents',
  Reach:    '/agents',
  Grant:    '/agents',
  Missions: '/agents',
}

const statusGlow: Record<string, string> = {
  online:  'shadow-[0_0_10px_rgba(52,211,153,0.7)] border-emerald-400',
  idle:    'shadow-[0_0_10px_rgba(251,191,36,0.5)] border-amber-400',
  offline: 'border-zinc-700',
}

const statusDot: Record<string, string> = {
  online:  'bg-emerald-400',
  idle:    'bg-amber-400',
  offline: 'bg-zinc-600',
}

function polarToXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad) * r, y: Math.sin(rad) * r }
}

const CX = 284
const CY = 297

export default function NeuralCore({ agents }: { agents: Agent[] }) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(t)
  }, [])

  const smbAgents    = agents.filter(a => a.category === 'smb'    && a.enabled)
  const churchAgents = agents.filter(a => a.category === 'church' && a.enabled)

  const smbStep    = smbAgents.length    > 0 ? 360 / smbAgents.length    : 0
  const churchStep = churchAgents.length > 0 ? 360 / churchAgents.length : 0

  const onlineCount = agents.filter(a => agentStatus(a) === 'online').length
  const idleCount   = agents.filter(a => agentStatus(a) === 'idle').length

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col items-center">
      <div className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-2">Neural Core — Agent Fleet</div>

      <div className="relative" style={{ width: 581, height: 608 }}>

        {/* Outer church ring */}
        {churchAgents.length > 0 && (
          <div className="absolute rounded-full border border-dashed border-indigo-900/50"
            style={{ top: CY - 250, left: CX - 250, width: 500, height: 500 }} />
        )}
        {/* Inner SMB ring */}
        <div className="absolute rounded-full border border-zinc-800/60"
          style={{ top: CY - 146, left: CX - 146, width: 292, height: 292 }} />
        {/* Innermost glow ring */}
        <div className="absolute rounded-full border border-zinc-800/30"
          style={{ top: CY - 182, left: CX - 182, width: 364, height: 364 }} />

        {/* Central orb */}
        <div className="absolute" style={{ left: CX - 52, top: CY - 52 }}>
          <div className={`w-[103px] h-[103px] rounded-full bg-indigo-900/60 border-2 border-indigo-500 flex items-center justify-center transition-all duration-1000 ${
            pulse ? 'shadow-[0_0_35px_rgba(99,102,241,0.9)]' : 'shadow-[0_0_18px_rgba(99,102,241,0.4)]'
          }`}>
            <span className="text-3xl">🧠</span>
            <div className={`absolute inset-0 rounded-full border border-indigo-400/30 transition-all duration-1000 ${pulse ? 'scale-125 opacity-0' : 'scale-100 opacity-100'}`} />
          </div>
        </div>

        {/* SMB agents — inner ring (radius 105) */}
        {smbAgents.map((agent, i) => {
          const angle  = -90 + i * smbStep
          const { x, y } = polarToXY(angle, 142)
          const status = agentStatus(agent)
          const href   = AGENT_ROUTES[agent.name] ?? '/agents'

          return (
            <Link
              key={agent.id}
              href={href}
              className="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: CX + x, top: CY + y }}
            >
              <div className={`w-10 h-10 rounded-full bg-zinc-900 border-2 flex items-center justify-center text-base transition-all duration-300 group-hover:scale-110 ${statusGlow[status]}`}>
                {agent.avatar_emoji}
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[status]}`} />
                <span className="text-zinc-400 text-[10px] font-mono group-hover:text-white transition-colors whitespace-nowrap">{agent.name}</span>
              </div>
            </Link>
          )
        })}

        {/* Church agents — outer ring (radius 185) */}
        {churchAgents.map((agent, i) => {
          const angle  = -90 + i * churchStep
          const { x, y } = polarToXY(angle, 250)
          const href   = AGENT_ROUTES[agent.name] ?? '/agents'

          return (
            <Link
              key={agent.id}
              href={href}
              className="absolute flex flex-col items-center gap-0.5 -translate-x-1/2 -translate-y-1/2 group opacity-40 hover:opacity-90 transition-all duration-200"
              style={{ left: CX + x, top: CY + y }}
            >
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-dashed border-indigo-800 flex items-center justify-center text-sm transition-all duration-300 group-hover:scale-115 group-hover:border-indigo-400 group-hover:shadow-[0_0_8px_rgba(99,102,241,0.5)]">
                {agent.avatar_emoji}
              </div>
              {/* Label only on hover */}
              <span className="text-indigo-500 text-[9px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {agent.name}
              </span>
            </Link>
          )
        })}

      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 flex-wrap justify-center">
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{onlineCount} Online
        </span>
        <span className="flex items-center gap-1.5 text-xs text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{idleCount} Idle
        </span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />{agents.length - onlineCount - idleCount} Offline
        </span>
        {churchAgents.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-indigo-700">
            <span className="w-1.5 h-1.5 rounded-full border border-dashed border-indigo-700" />
            {churchAgents.length} Coming Soon
          </span>
        )}
      </div>
    </div>
  )
}
