import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assessProjectRisks, generateHeartbeat } from '@/lib/atlas'
import { isAgentEnabled } from '@/lib/agent-settings'

export async function POST() {
  if (!await isAgentEnabled('Atlas')) return NextResponse.json({ skipped: true, reason: 'Agent disabled' })
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const [projects, delivered] = await Promise.all([
    db`
      SELECT p.id, p.name, p.phase, p.due_date, p.updated_at, p.notes, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.phase != 'Delivered'`,
    db`
      SELECT p.name, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.phase = 'Delivered' AND p.updated_at >= ${oneWeekAgo}`,
  ])

  const risks = assessProjectRisks(
    projects as unknown as { id: string; name: string; phase: string; client_name: string | null; due_date: string | null; updated_at: string; notes: string | null }[]
  )

  const report = await generateHeartbeat({
    totalProjects: risks.length,
    overdueProjects: risks.filter(r => r.risk === 'overdue'),
    atRiskProjects: risks.filter(r => r.risk === 'at_risk'),
    onTrackProjects: risks.filter(r => r.risk === 'on_track'),
    deliveredThisWeek: delivered as unknown as { name: string; client_name: string | null }[],
  })

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${report}, ARRAY['projects', 'atlas', 'heartbeat', 'weekly']
    FROM agents WHERE name = 'Atlas' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Atlas'`

  return NextResponse.json({ report, overdue: risks.filter(r => r.risk === 'overdue').length })
}
