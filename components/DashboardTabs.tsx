'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Agent, Heartbeat } from '@/lib/types'
import NeuralCore from '@/components/NeuralCore'
import AutomationStream from '@/components/AutomationStream'
import CommandCenter from '@/components/CommandCenter'

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
}

interface Props {
  agents: Agent[]
  beats: Heartbeat[]
  onlineCount: number
  todayCount: number
  activeProjects: number
  scheduledCount: number
  stats: Stats
  tasks: Task[]
  children: React.ReactNode
}

const TABS = ['Command Center', 'Overview', 'Automation Stream'] as const

export default function DashboardTabs({ agents, beats, onlineCount, todayCount, activeProjects, scheduledCount, stats, tasks, children }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'Command Center') as typeof TABS[number]

  function setTab(t: typeof TABS[number]) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    router.replace(`/?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3 border-b border-zinc-800">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-mono tracking-wider transition-colors ${
              tab === t
                ? 'text-white border-b-2 border-indigo-500 -mb-px'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Command Center tab */}
      {tab === 'Command Center' && (
        <div className="flex-1 overflow-auto">
          <CommandCenter agents={agents} stats={stats} tasks={tasks} />
        </div>
      )}

      {/* Overview tab */}
      {tab === 'Overview' && (
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          <div className="flex gap-4 h-full">
            {/* Col 1 — KPIs stacked (20%) */}
            <div className="flex flex-col gap-3 w-[20%] shrink-0">
              {[
                { label: 'AGENTS ONLINE',   value: onlineCount,    sub: `/ ${agents.length} total`, color: 'text-emerald-400' },
                { label: 'HEARTBEATS',      value: todayCount,     sub: 'today',                    color: 'text-indigo-400'  },
                { label: 'ACTIVE PROJECTS', value: activeProjects, sub: 'in progress',              color: 'text-amber-400'   },
                { label: 'SCHEDULED',       value: scheduledCount, sub: 'posts queued',             color: 'text-pink-400'    },
              ].map(k => (
                <div key={k.label} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                  <p className="text-zinc-600 text-xs font-mono">{k.label}</p>
                  <p className={`text-3xl font-bold font-mono ${k.color}`}>{k.value}</p>
                  <p className="text-zinc-700 text-xs mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Col 2 — Neural Core */}
            <div className="flex-1 flex items-center justify-center overflow-auto">
              <NeuralCore agents={agents} />
            </div>

            {/* Col 3 — Priority, Pipeline, Scheduled */}
            <div className="flex flex-col gap-3 w-[20%] shrink-0 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      )}

      {/* Automation Stream tab */}
      {tab === 'Automation Stream' && (
        <div className="flex-1 overflow-hidden p-4">
          <AutomationStream initial={beats} />
        </div>
      )}
    </div>
  )
}
