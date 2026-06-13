import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const topicId = req.nextUrl.searchParams.get('topicId')
  const status = req.nextUrl.searchParams.get('status')

  const materials = await db`
    SELECT m.*, t.title as topic_title, t.track
    FROM scribe_materials m
    LEFT JOIN scribe_topics t ON t.id = m.topic_id
    WHERE true
      ${topicId ? db`AND m.topic_id = ${topicId}` : db``}
      ${status ? db`AND m.status = ${status}` : db``}
    ORDER BY m.created_at DESC`

  return NextResponse.json({ materials })
}

export async function PATCH(req: NextRequest) {
  const { id, status, body, script } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const [material] = await db`
    UPDATE scribe_materials SET
      status     = COALESCE(${status ?? null}, status),
      body       = COALESCE(${body ?? null}, body),
      script     = COALESCE(${script ?? null}, script),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`

  // If all materials for a topic are approved/published, mark topic complete
  if (status === 'approved' || status === 'published') {
    const [mat] = await db`SELECT topic_id FROM scribe_materials WHERE id = ${id}`
    const topicId = (mat as unknown as { topic_id: string }).topic_id
    if (topicId) {
      const pending = await db`
        SELECT COUNT(*) as count FROM scribe_materials
        WHERE topic_id = ${topicId} AND status = 'draft'`
      if (Number((pending[0] as unknown as { count: string }).count) === 0) {
        await db`UPDATE scribe_topics SET status = 'complete', updated_at = now() WHERE id = ${topicId}`
      }
    }
  }

  return NextResponse.json({ material })
}
