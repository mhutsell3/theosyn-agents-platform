import { NextRequest, NextResponse } from 'next/server'

const VOICE_URL = process.env.VOICE_SERVICE_URL ?? 'http://localhost:8765'

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const res = await fetch(`${VOICE_URL}/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }

  return NextResponse.json(await res.json())
}
