import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db`UPDATE remi_recommendations SET status = 'rejected' WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
