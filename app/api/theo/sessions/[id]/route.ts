import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function cleanTags(s: unknown): unknown {
  if (typeof s !== 'string') return s
  return s.replace(/<execute_tools>[\s\S]*?<\/execute_tools>/g, '').trim()
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const rows = await db`SELECT * FROM theo_sessions WHERE id = ${id}` as unknown as Record<string, unknown>[]

    if (rows.length) {
      const session = { ...rows[0], thinking: cleanTags(rows[0].thinking), summary: cleanTags(rows[0].summary) }
      return NextResponse.json({ session })
    }

    // Fall back to heartbeats (standup reports)
    const hRows = await db`
      SELECT h.id, h.content, h.created_at
      FROM heartbeats h
      JOIN agents a ON a.id = h.agent_id
      WHERE h.id = ${id} AND a.name = 'Theo'
    ` as unknown as { id: string; content: string; created_at: string }[]

    if (!hRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const h = hRows[0]
    return NextResponse.json({
      session: {
        id: h.id, trigger: 'standup', mode: 'report', model: 'theo',
        thinking: cleanTags(h.content),
        actions: [], summary: null, status: 'completed',
        rounds: 0, created_at: h.created_at, completed_at: h.created_at,
      }
    })
  } catch (err) {
    console.error('[Theo] session detail error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
