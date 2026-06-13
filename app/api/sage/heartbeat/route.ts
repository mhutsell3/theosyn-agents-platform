import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateHeartbeat } from '@/lib/sage'
import { isAgentEnabled } from '@/lib/agent-settings'

export async function POST() {
  if (!await isAgentEnabled('Sage')) return NextResponse.json({ skipped: true, reason: 'Agent disabled' })
  const [clients, projects, briefs] = await Promise.all([
    db`SELECT name FROM clients WHERE stage = 'Active' LIMIT 10`,
    db`SELECT name FROM projects WHERE phase != 'Delivered' LIMIT 10`,
    db`SELECT topic FROM sage_briefs ORDER BY created_at DESC LIMIT 5`,
  ])

  const activeClients = (clients as unknown as { name: string }[]).map(c => c.name)
  const activeProjects = (projects as unknown as { name: string }[]).map(p => p.name)
  const recentBriefTopics = (briefs as unknown as { topic: string }[]).map(b => b.topic)

  const report = await generateHeartbeat({ activeClients, activeProjects, recentBriefTopics })

  await db`INSERT INTO sage_briefs (topic, content) VALUES ('Weekly Heartbeat', ${report})`

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${report}, ARRAY['research', 'strategy', 'heartbeat', 'weekly']
    FROM agents WHERE name = 'Sage' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Sage'`

  return NextResponse.json({ report })
}
