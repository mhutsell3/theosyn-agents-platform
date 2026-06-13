'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Agent } from '@/lib/types'

interface Stats {
  agentsOnline: number
  agentsTotal: number
  scoutLeads: number
  contentPosts: number
  students: number
  hoursSaved: number
  totalTokens: number
  sageBriefs: number
}

interface Task {
  id: string
  title: string
  due_date: string | null
  status: string
  agent?: string
}

interface Scripture {
  reference: string
  text: string
}

// Agent SVG icons
const AgentIcon = ({ name, size = 32 }: { name: string; size?: number }) => {
  const icons: Record<string, React.ReactElement> = {
    Theo: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke="#6366f1" strokeWidth="1.5"/>
        <path d="M16 8v8l5 3" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="16" cy="16" r="2" fill="#6366f1"/>
        <path d="M10 6l2 2M22 6l-2 2M6 12l2 1M26 12l-2 1" stroke="#818cf8" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    Piper: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M4 16h6l3-6 4 12 3-8 3 4 5-2" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="4" cy="16" r="2" fill="#10b981"/>
        <circle cx="28" cy="14" r="2" fill="#10b981"/>
      </svg>
    ),
    Atlas: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <polygon points="16,4 28,24 4,24" stroke="#f59e0b" strokeWidth="1.5" fill="none"/>
        <line x1="16" y1="4" x2="16" y2="24" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2,2"/>
        <line x1="4" y1="24" x2="28" y2="24" stroke="#f59e0b" strokeWidth="1"/>
        <circle cx="16" cy="15" r="2" fill="#f59e0b"/>
      </svg>
    ),
    Nova: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 4l2.5 7.5H26l-6.5 4.7 2.5 7.5L16 19.2l-6 4.5 2.5-7.5L6 11.5h7.5z" stroke="#ec4899" strokeWidth="1.5" fill="none"/>
        <circle cx="16" cy="16" r="3" fill="#ec4899" opacity="0.5"/>
      </svg>
    ),
    Lumen: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="13" r="6" stroke="#fbbf24" strokeWidth="1.5"/>
        <path d="M16 19v5M12 28h8M13 22l-2 4M19 22l2 4" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 10v2M11 11l1.5 1.5M21 11l-1.5 1.5" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    Sage: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="14" r="8" stroke="#8b5cf6" strokeWidth="1.5"/>
        <circle cx="13" cy="12" r="1.5" fill="#8b5cf6"/>
        <circle cx="19" cy="12" r="1.5" fill="#8b5cf6"/>
        <path d="M12 17c1 2 7 2 8 0" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M10 8l-2-2M22 8l2-2M16 6V4" stroke="#8b5cf6" strokeWidth="1" strokeLinecap="round"/>
        <path d="M12 22l-2 6h12l-2-6" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    Scout: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" stroke="#06b6d4" strokeWidth="1.5"/>
        <line x1="16" y1="4" x2="16" y2="28" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2,2"/>
        <line x1="4" y1="16" x2="28" y2="16" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2,2"/>
        <circle cx="16" cy="16" r="3" fill="#06b6d4"/>
        <path d="M16 4l1.5 4h-3zM16 28l1.5-4h-3zM4 16l4-1.5v3zM28 16l-4-1.5v3z" fill="#06b6d4"/>
      </svg>
    ),
    Remi: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="4" y="20" width="4" height="8" rx="1" fill="#f97316"/>
        <rect x="10" y="14" width="4" height="14" rx="1" fill="#f97316"/>
        <rect x="16" y="17" width="4" height="11" rx="1" fill="#f97316"/>
        <rect x="22" y="10" width="4" height="18" rx="1" fill="#f97316"/>
        <path d="M6 18l6-6 6 4 8-10" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    Beacon: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 28V12" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
        <path d="M10 18c1.5-3 9-3 12 0" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M7 22c2.5-6 15-6 18 0" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M4 26c3.5-9 21-9 24 0" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="16" cy="10" r="3" fill="#34d399"/>
      </svg>
    ),
    Pulse: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="6" y="6" width="9" height="9" rx="2" stroke="#e879f9" strokeWidth="1.5"/>
        <rect x="17" y="6" width="9" height="9" rx="2" stroke="#e879f9" strokeWidth="1.5"/>
        <rect x="6" y="17" width="9" height="9" rx="2" stroke="#e879f9" strokeWidth="1.5"/>
        <rect x="17" y="17" width="9" height="9" rx="2" stroke="#e879f9" strokeWidth="1.5"/>
        <circle cx="10.5" cy="10.5" r="2" fill="#e879f9"/>
        <circle cx="21.5" cy="10.5" r="2" fill="#e879f9"/>
        <path d="M19 21.5h5M21.5 19v5" stroke="#e879f9" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10.5" cy="21.5" r="2" fill="#e879f9"/>
      </svg>
    ),
    Scribe: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="6" y="4" width="16" height="22" rx="2" stroke="#60a5fa" strokeWidth="1.5"/>
        <path d="M10 10h8M10 14h8M10 18h5" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M20 20l6 6M23 20l3 3" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="25" cy="25" r="2" fill="#60a5fa"/>
      </svg>
    ),
    Logos: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 4l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" stroke="#a78bfa" strokeWidth="1.5" fill="none"/>
        <path d="M16 12v8M12 16h8" stroke="#a78bfa" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    Forge: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M6 26h20M8 26V18l8-4 8 4v8" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="12" y="18" width="8" height="8" rx="1" stroke="#fb7185" strokeWidth="1.5"/>
        <path d="M10 18V12a6 6 0 0112 0v6" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="16" cy="10" r="2" fill="#fb7185"/>
      </svg>
    ),
    Orion: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" stroke="#38bdf8" strokeWidth="1.5"/>
        <circle cx="16" cy="16" r="4" stroke="#38bdf8" strokeWidth="1.5"/>
        <circle cx="16" cy="4" r="2" fill="#38bdf8"/>
        <circle cx="28" cy="16" r="2" fill="#38bdf8"/>
        <circle cx="16" cy="28" r="2" fill="#38bdf8"/>
        <circle cx="4" cy="16" r="2" fill="#38bdf8"/>
        <path d="M16 8v4M24 16h-4M16 24v-4M8 16h4" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  }
  return icons[name] ?? (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12" stroke="#6366f1" strokeWidth="1.5"/>
      <circle cx="16" cy="16" r="4" fill="#6366f1"/>
    </svg>
  )
}

const agentColors: Record<string, string> = {
  Theo:   'border-indigo-800 bg-indigo-950/30',
  Piper:  'border-emerald-800 bg-emerald-950/30',
  Atlas:  'border-amber-800 bg-amber-950/30',
  Nova:   'border-pink-800 bg-pink-950/30',
  Lumen:  'border-yellow-800 bg-yellow-950/30',
  Sage:   'border-purple-800 bg-purple-950/30',
  Scout:  'border-cyan-800 bg-cyan-950/30',
  Remi:   'border-orange-800 bg-orange-950/30',
  Beacon: 'border-green-800 bg-green-950/30',
  Pulse:  'border-fuchsia-800 bg-fuchsia-950/30',
  Scribe: 'border-blue-800 bg-blue-950/30',
  Logos:  'border-violet-800 bg-violet-950/30',
  Orion:  'border-sky-800 bg-sky-950/30',
  Forge:  'border-rose-800 bg-rose-950/30',
}

const agentDescriptions: Record<string, string> = {
  Theo:   'Command & orchestration hub for all agents',
  Piper:  'Client relations, follow-ups & pipeline health',
  Atlas:  'Project risk scanning & status tracking',
  Nova:   'Content creation, ideas & repurposing',
  Lumen:  'Revenue, invoices & financial reporting',
  Sage:   'Research briefs & strategic intel',
  Scout:  'Lead prospecting, outreach & enrichment',
  Remi:   'Meta Ads intelligence & recommendations',
  Beacon: 'Student enrollment & community management',
  Pulse:  'Social media posting & comment monitoring',
  Scribe: 'Curriculum building & training materials',
  Logos:  'Church resources & biblical guidance',
  Orion:  'Product research, competitors & ad intelligence',
  Forge:  'Shopify store — products, customers & orders',
}

const agentRoutes: Record<string, string> = {
  Theo: '/', Piper: '/piper', Atlas: '/atlas', Nova: '/content',
  Lumen: '/lumen', Sage: '/sage', Scout: '/scout', Remi: '/remi',
  Beacon: '/beacon', Pulse: '/pulse', Scribe: '/scribe', Logos: '/logos', Orion: '/orion', Forge: '/forge',
}

export default function CommandCenter({ agents, stats, tasks }: {
  agents: Agent[]
  stats: Stats
  tasks: Task[]
}) {
  const [scripture, setScripture] = useState<Scripture | null>(null)

  useEffect(() => {
    const cached = sessionStorage.getItem('daily-scripture')
    if (cached) {
      setScripture(JSON.parse(cached))
      return
    }
    const verses = [
      'proverbs 16:3', 'jeremiah 29:11', 'philippians 4:13', 'psalm 23:1',
      'romans 8:28', 'isaiah 40:31', 'joshua 1:9', 'matthew 6:33',
      'colossians 3:23', 'proverbs 3:5-6', '2 timothy 1:7', 'ephesians 2:10',
    ]
    const verse = verses[new Date().getDate() % verses.length]
    fetch(`https://bible-api.com/${encodeURIComponent(verse)}`)
      .then(r => r.json())
      .then(data => {
        const s = { reference: data.reference, text: data.text?.replace(/\n/g, ' ').trim() }
        setScripture(s)
        sessionStorage.setItem('daily-scripture', JSON.stringify(s))
      })
      .catch(() => setScripture({ reference: 'Proverbs 16:3', text: 'Commit to the Lord whatever you do, and he will establish your plans.' }))
  }, [])

  const isAgentOnline = (agent: Agent) => {
    if (!agent.last_heartbeat) return false
    return Date.now() - new Date(agent.last_heartbeat).getTime() < 24 * 60 * 60 * 1000
  }

  const statCards = [
    { label: 'Agents Online',    value: `${stats.agentsOnline}/${stats.agentsTotal}`, sub: 'active today',        color: 'text-emerald-400', bg: 'border-emerald-900' },
    { label: 'Scout Leads',      value: stats.scoutLeads,                             sub: 'total prospects',      color: 'text-cyan-400',    bg: 'border-cyan-900'    },
    { label: 'Content Posts',    value: stats.contentPosts,                           sub: 'created',              color: 'text-pink-400',    bg: 'border-pink-900'    },
    { label: 'Students',         value: stats.students,                               sub: 'enrolled',             color: 'text-green-400',   bg: 'border-green-900'   },
    { label: 'Hours Saved',      value: stats.hoursSaved,                             sub: 'by your agents',       color: 'text-indigo-400',  bg: 'border-indigo-900'  },
    { label: 'Tokens Used',      value: stats.totalTokens.toLocaleString(),           sub: 'across all agents',    color: 'text-amber-400',   bg: 'border-amber-900'   },
    { label: 'Research Briefs',  value: stats.sageBriefs,                             sub: 'by Sage',              color: 'text-purple-400',  bg: 'border-purple-900'  },
  ]

  return (
    <div className="flex flex-col gap-6 p-6 overflow-auto">

      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-bold">Welcome back, Milford.</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Your AI agents are working for your ministry and business.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-7 gap-3">
        {statCards.map(s => (
          <div key={s.label} className={`bg-zinc-900 border ${s.bg} rounded-xl p-4`}>
            <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-zinc-600 text-xs mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Agent Cards Grid */}
      <div>
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">Your AI Agents</p>
        <div className="grid grid-cols-6 gap-3">
          {agents.filter(agent => agent.enabled).map(agent => {
            const online = isAgentOnline(agent)
            const color = agentColors[agent.name] ?? 'border-zinc-800 bg-zinc-900'
            const route = agentRoutes[agent.name] ?? '/'
            return (
              <Link key={agent.id} href={route} className={`border ${color} rounded-xl p-4 flex flex-col gap-2 hover:brightness-125 transition-all`}>
                <div className="flex items-start justify-between">
                  <AgentIcon name={agent.name} size={32} />
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${online ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    {online ? '● ACTIVE' : '○ IDLE'}
                  </span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{agent.name}</p>
                  <p className="text-zinc-500 text-xs leading-tight mt-0.5">{agentDescriptions[agent.name] ?? 'AI Agent'}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-4">

        {/* Upcoming Tasks */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">📋 Upcoming Tasks</p>
          {tasks.length === 0 ? (
            <p className="text-zinc-600 text-sm">No tasks due. All clear!</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-start gap-2 p-2 bg-zinc-800/50 rounded-lg">
                  <span className="text-indigo-400 mt-0.5">▸</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs truncate">{t.title}</p>
                    {t.due_date && (
                      <p className="text-zinc-500 text-xs">{new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    )}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    t.status === 'done' ? 'bg-emerald-950 text-emerald-400' :
                    t.status === 'in_progress' ? 'bg-amber-950 text-amber-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scripture of the Day */}
        <div className="bg-zinc-900 border border-indigo-900/50 rounded-xl p-4 flex flex-col justify-between">
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">✝ Scripture of the Day</p>
          {scripture ? (
            <div className="flex flex-col gap-3">
              <p className="text-zinc-300 text-sm italic leading-relaxed">"{scripture.text}"</p>
              <p className="text-indigo-400 text-xs font-semibold">— {scripture.reference}</p>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Loading verse...</p>
          )}
        </div>

        {/* Hours Saved Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">⏱ Time Saved Breakdown</p>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Research Briefs',  hours: stats.sageBriefs * 2,       color: 'bg-purple-500' },
              { label: 'Scout Leads',      hours: stats.scoutLeads * 0.5,     color: 'bg-cyan-500'   },
              { label: 'Content Posts',    hours: stats.contentPosts * 1,     color: 'bg-pink-500'   },
              { label: 'Agent Heartbeats', hours: stats.agentsOnline * 0.5,   color: 'bg-indigo-500' },
              { label: 'Students Managed', hours: stats.students * 0.25,      color: 'bg-green-500'  },
            ].map(row => {
              const pct = stats.hoursSaved > 0 ? Math.round((row.hours / stats.hoursSaved) * 100) : 0
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-zinc-400">{row.label}</span>
                    <span className="text-zinc-500">{row.hours.toFixed(1)}h</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-indigo-400 font-bold text-lg mt-3">{stats.hoursSaved.toFixed(1)} hrs total</p>
        </div>
      </div>
    </div>
  )
}
