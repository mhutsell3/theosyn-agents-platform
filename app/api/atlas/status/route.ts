import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assessProjectRisks, generateStatusReport } from '@/lib/atlas'

export async function POST(req: NextRequest) {
  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const [project] = await db`
    SELECT p.*, c.name as client_name
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${projectId}`

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const p = project as unknown as { id: string; name: string; phase: string; client_name: string | null; due_date: string | null; updated_at: string; notes: string | null }
  const [risk] = assessProjectRisks([p])

  const update = await generateStatusReport(risk)

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Atlas — Project Status\n**' + p.name + '**\n\n' + update},
      ARRAY['atlas', 'projects', 'status']
    FROM agents WHERE name = 'Atlas' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Atlas'`

  return NextResponse.json({ update, risk: risk.risk })
}
