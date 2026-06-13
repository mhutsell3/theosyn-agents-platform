import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
  const [sessions, heartbeats] = await Promise.all([
    db`
      SELECT id, trigger, mode, model, summary, status, rounds,
             CASE WHEN jsonb_typeof(actions) = 'array' THEN jsonb_array_length(actions) ELSE 0 END AS action_count,
             created_at, completed_at
      FROM theo_sessions
      ORDER BY created_at DESC
      LIMIT 50` as unknown as {
      id: string; trigger: string; mode: string; model: string
      summary: string | null; status: string; rounds: number
      action_count: number; created_at: string; completed_at: string | null
    }[],
    db`
      SELECT h.id, h.content, h.created_at
      FROM heartbeats h
      JOIN agents a ON a.id = h.agent_id
      WHERE a.name = 'Theo'
        AND 'standup' = ANY(h.tags)
      ORDER BY h.created_at DESC
      LIMIT 30` as unknown as { id: string; content: string; created_at: string }[],
  ])

  // Merge: standup heartbeats as synthetic session entries
  const standupSessions = heartbeats.map(h => ({
    id: h.id,
    trigger: 'standup',
    mode: 'report',
    model: 'theo',
    summary: h.content.slice(0, 300).replace(/<execute_tools>[\s\S]*?<\/execute_tools>/g, '').trim(),
    status: 'completed',
    rounds: 0,
    action_count: 0,
    created_at: h.created_at,
    completed_at: h.created_at,
    _full_content: h.content,
  }))

  // Clean execute_tools tags from think session summaries
  const cleanSessions = sessions.map(s => ({
    ...s,
    summary: s.summary?.replace(/<execute_tools>[\s\S]*?<\/execute_tools>/g, '').trim() ?? null,
  }))

  // Merge and sort by date
  const all = [...cleanSessions, ...standupSessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return NextResponse.json({ sessions: all })
  } catch (err) {
    console.error('[Theo] sessions error:', err)
    return NextResponse.json({ error: String(err), sessions: [] }, { status: 500 })
  }
}
