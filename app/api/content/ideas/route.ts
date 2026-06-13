import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const ideas = await db`SELECT * FROM content_ideas ORDER BY created_at DESC`
  return NextResponse.json(ideas)
}

export async function POST(req: NextRequest) {
  const { title, channel, notes } = await req.json()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  const [idea] = await db`
    INSERT INTO content_ideas (title, channel, notes)
    VALUES (${title}, ${channel}, ${notes})
    RETURNING *`
  return NextResponse.json(idea, { status: 201 })
}
