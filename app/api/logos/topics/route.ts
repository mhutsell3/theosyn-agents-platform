import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const topics = await db`SELECT * FROM logos_topics WHERE active = true ORDER BY category, title`
  return NextResponse.json({ topics })
}
