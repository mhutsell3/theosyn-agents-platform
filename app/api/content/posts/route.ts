import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const posts = await db`SELECT * FROM content_posts ORDER BY scheduled_date ASC NULLS LAST, created_at DESC`
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const { title, channel, status, scheduled_date, notes, url } = await req.json()
  if (!title || !channel || !status) {
    return NextResponse.json({ error: 'title, channel and status are required' }, { status: 400 })
  }
  const [post] = await db`
    INSERT INTO content_posts (title, channel, status, scheduled_date, notes, url)
    VALUES (${title}, ${channel}, ${status}, ${scheduled_date}, ${notes}, ${url})
    RETURNING *`
  return NextResponse.json(post, { status: 201 })
}
