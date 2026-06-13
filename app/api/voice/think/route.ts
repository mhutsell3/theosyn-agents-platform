import { NextRequest, NextResponse } from 'next/server'

const VOICE_URL = process.env.VOICE_SERVICE_URL ?? 'http://localhost:8765'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const res = await fetch(`${VOICE_URL}/think`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Think failed' }, { status: 500 })
  }

  return NextResponse.json(await res.json())
}
