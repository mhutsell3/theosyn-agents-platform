import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_CURRICULUM } from '@/lib/scribe'

export async function GET() {
  const topics = await db`
    SELECT t.*,
      COUNT(m.id) FILTER (WHERE m.status = 'draft') as drafts,
      COUNT(m.id) FILTER (WHERE m.status = 'approved') as approved,
      COUNT(m.id) FILTER (WHERE m.status = 'published') as published,
      COUNT(r.id) as research_count
    FROM scribe_topics t
    LEFT JOIN scribe_materials m ON m.topic_id = t.id
    LEFT JOIN scribe_research r ON r.topic_id = t.id
    GROUP BY t.id
    ORDER BY t.track, t.order_index`
  return NextResponse.json({ topics })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Seed default curriculum
  if (body.seed) {
    let inserted = 0
    for (const track of DEFAULT_CURRICULUM) {
      for (let i = 0; i < track.topics.length; i++) {
        const topic = track.topics[i]
        await db`
          INSERT INTO scribe_topics (track, title, description, prerequisites, order_index)
          VALUES (${track.track}, ${topic.title}, ${topic.description}, ${topic.prerequisites}, ${i})
          ON CONFLICT DO NOTHING`
        inserted++
      }
    }
    return NextResponse.json({ seeded: inserted })
  }

  const { track, title, description, prerequisites, order_index } = body
  if (!track || !title) return NextResponse.json({ error: 'track and title required' }, { status: 400 })

  const [topic] = await db`
    INSERT INTO scribe_topics (track, title, description, prerequisites, order_index)
    VALUES (${track}, ${title}, ${description ?? null}, ${prerequisites ?? []}, ${order_index ?? 0})
    RETURNING *`

  return NextResponse.json({ topic }, { status: 201 })
}
