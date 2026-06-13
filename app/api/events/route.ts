import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const events = await db`SELECT * FROM events ORDER BY event_date ASC`
  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  const { title, event_date, event_time, type, notes, color } = await req.json()
  if (!title || !event_date) {
    return NextResponse.json({ error: 'title and event_date are required' }, { status: 400 })
  }
  const [event] = await db`
    INSERT INTO events (title, event_date, event_time, type, notes, color)
    VALUES (${title}, ${event_date}, ${event_time}, ${type}, ${notes}, ${color})
    RETURNING *`
  return NextResponse.json(event, { status: 201 })
}
