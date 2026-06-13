import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateHeartbeat } from '@/lib/nova'
import { isAgentEnabled } from '@/lib/agent-settings'

export async function POST() {
  if (!await isAgentEnabled('Nova')) return NextResponse.json({ skipped: true, reason: 'Agent disabled' })
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [published, ideas, projects] = await Promise.all([
    db`SELECT channel, title FROM content_posts WHERE status = 'Published' AND created_at >= ${monthStart}`,
    db`SELECT title FROM content_ideas ORDER BY created_at DESC LIMIT 10`,
    db`SELECT name FROM projects WHERE phase != 'Delivered'`,
  ])

  const channelCounts: Record<string, number> = {}
  for (const p of published) {
    channelCounts[p.channel] = (channelCounts[p.channel] ?? 0) + 1
  }
  const topChannels = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).map(([c]) => c)

  const report = await generateHeartbeat({
    postsThisMonth: published.length,
    topChannels,
    recentIdeas: (ideas as unknown as { title: string }[]).map(i => i.title),
    activeProjects: (projects as unknown as { name: string }[]).map(p => p.name),
  })

  // Save as agent heartbeat
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${report}, ARRAY['content', 'heartbeat', 'weekly']
    FROM agents WHERE name = 'Nova' LIMIT 1`

  await db`
    INSERT INTO nova_runs (run_type, output)
    VALUES ('heartbeat', ${report})`

  return NextResponse.json({ report })
}
