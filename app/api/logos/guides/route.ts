import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const guides = await db`
    SELECT g.*, t.title as topic_title, t.category
    FROM logos_guides g
    LEFT JOIN logos_topics t ON t.id = g.topic_id
    ORDER BY g.created_at DESC
    LIMIT 50`
  return NextResponse.json({ guides })
}
