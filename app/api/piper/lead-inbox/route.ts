import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json()
  await db`UPDATE piper_lead_inbox SET status = ${status} WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
