import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { agent_id, content, tags = [] } = body

  if (!agent_id || !content) {
    return NextResponse.json({ error: 'agent_id and content are required' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const [heartbeat] = await Promise.all([
    db`INSERT INTO heartbeats (agent_id, content, tags) VALUES (${agent_id}, ${content}, ${tags}) RETURNING *`,
    db`UPDATE agents SET last_heartbeat = ${now} WHERE id = ${agent_id}`,
  ])

  return NextResponse.json({ data: heartbeat[0] }, { status: 201 })
}
