import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [profile] = await db`SELECT * FROM brand_voice_profile LIMIT 1`
  const count = await db`SELECT COUNT(*)::int AS count FROM brand_voice_samples` as unknown as [{ count: number }]
  return NextResponse.json({ profile, sampleCount: count[0].count })
}
