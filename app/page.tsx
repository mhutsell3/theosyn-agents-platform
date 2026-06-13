import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { Agent, Heartbeat } from '@/lib/types'
import StatusBar from '@/components/StatusBar'
import StandupButton from '@/components/StandupButton'
import DashboardTabs from '@/components/DashboardTabs'
import PipelineOverview from '@/components/PipelineOverview'
import PriorityOverview from '@/components/PriorityOverview'
import ScheduledTasks from '@/components/ScheduledTasks'
import { Suspense } from 'react'

export const revalidate = 30

async function getData() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    agents, beats, todayRows, projects, scheduledPosts,
    scoutLeads, contentPosts, students, tokenUsage, sageBriefs, tasks,
  ] = await Promise.all([
    db<Agent[]>`SELECT * FROM agents ORDER BY category, name`,
    db<Heartbeat[]>`
      SELECT h.*, row_to_json(a) AS agent
      FROM heartbeats h
      LEFT JOIN agents a ON a.id = h.agent_id
      ORDER BY h.created_at DESC
      LIMIT 50`,
    db`SELECT COUNT(*) FROM heartbeats WHERE created_at >= ${today.toISOString()}`,
    db`SELECT phase, COUNT(*) as count FROM projects GROUP BY phase`,
    db`SELECT COUNT(*) FROM content_posts WHERE status = 'Scheduled'`,
    db`SELECT COUNT(*) FROM scout_leads`,
    db`SELECT COUNT(*) FROM content_posts`,
    db`SELECT COUNT(*) FROM students`,
    db`SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total FROM token_usage`,
    db`SELECT COUNT(*) FROM sage_briefs`,
    db`SELECT id, request as title, null as due_date, status FROM piper_tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 5`,
  ])

  const todayCount = Number(todayRows[0].count)
  const scheduledCount = Number(scheduledPosts[0].count)
  const onlineCount = (agents as Agent[]).filter(a => {
    if (!a.last_heartbeat) return false
    return Date.now() - new Date(a.last_heartbeat).getTime() < 24 * 60 * 60 * 1000
  }).length

  const phaseMap = Object.fromEntries(
    (projects as unknown as { phase: string; count: string }[]).map(r => [r.phase, Number(r.count)])
  )
  const activeProjects = (phaseMap['Building'] ?? 0) + (phaseMap['Planning'] ?? 0) + (phaseMap['Review'] ?? 0)

  const scoutCount = Number((scoutLeads as unknown as { count: string }[])[0].count)
  const postsCount = Number((contentPosts as unknown as { count: string }[])[0].count)
  const studentsCount = Number((students as unknown as { count: string }[])[0].count)
  const totalTokens = Number((tokenUsage as unknown as { total: string }[])[0].total)
  const sageBriefCount = Number((sageBriefs as unknown as { count: string }[])[0].count)

  const hoursSaved = Number((
    sageBriefCount * 2 +
    scoutCount * 0.5 +
    postsCount * 1 +
    onlineCount * 0.5 +
    studentsCount * 0.25
  ).toFixed(1))

  const stats = {
    agentsOnline: onlineCount,
    agentsTotal: (agents as Agent[]).length,
    scoutLeads: scoutCount,
    contentPosts: postsCount,
    students: studentsCount,
    hoursSaved,
    totalTokens,
    sageBriefs: sageBriefCount,
  }

  return {
    agents: agents as Agent[],
    beats: beats as Heartbeat[],
    todayCount,
    onlineCount,
    activeProjects,
    scheduledCount,
    stats,
    tasks: tasks as unknown as { id: string; title: string; due_date: string | null; status: string }[],
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { agents, beats, todayCount, onlineCount, activeProjects, scheduledCount, stats, tasks } = await getData()

  return (
    <div className="flex flex-col h-screen pb-8">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight font-mono">COMMAND BRIDGE</h1>
          <p className="text-zinc-600 text-xs font-mono">THEOSYN LABS — SECTOR ALPHA</p>
        </div>
        <div className="flex items-center gap-4">
          <StandupButton />
          <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </span>
          <span className="flex items-center gap-1.5 text-xs font-mono text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            SECURE
          </span>
        </div>
      </div>

      <Suspense fallback={null}>
        <DashboardTabs
          agents={agents}
          beats={beats}
          onlineCount={onlineCount}
          todayCount={todayCount}
          activeProjects={activeProjects}
          scheduledCount={scheduledCount}
          stats={stats}
          tasks={tasks}
        >
          <PriorityOverview />
          <PipelineOverview />
          <ScheduledTasks />
        </DashboardTabs>
      </Suspense>

      <StatusBar />
    </div>
  )
}
