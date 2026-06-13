import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const start = Date.now()
    const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    const ms = Date.now() - start
    if (res.ok) return NextResponse.json({ status: 'ok', ms })
    return NextResponse.json({ status: 'stale' })
  } catch {
    return NextResponse.json({ status: 'down' })
  }
}
