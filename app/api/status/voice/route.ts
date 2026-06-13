import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      `${process.env.VOICE_SERVICE_URL ?? 'http://localhost:8765'}/health`,
      { signal: AbortSignal.timeout(3000) }
    )
    const data = await res.json()
    if (data.status === 'ok') return NextResponse.json({ status: 'ok' })
    return NextResponse.json({ status: 'stale' })
  } catch {
    return NextResponse.json({ status: 'down' })
  }
}
