import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      `${process.env.N8N_URL ?? 'http://localhost:5678'}/healthz`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (res.ok) return NextResponse.json({ status: 'ok' })
    return NextResponse.json({ status: 'stale' })
  } catch {
    return NextResponse.json({ status: 'down' })
  }
}
