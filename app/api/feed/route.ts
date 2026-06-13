import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Heartbeat } from '@/lib/types'

export async function GET() {
  const beats = await db<Heartbeat[]>`
    SELECT h.*, row_to_json(a) AS agent
    FROM heartbeats h
    LEFT JOIN agents a ON a.id = h.agent_id
    ORDER BY h.created_at DESC
    LIMIT 50`

  return NextResponse.json(beats)
}
