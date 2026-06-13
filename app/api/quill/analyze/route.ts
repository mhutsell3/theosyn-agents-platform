import { NextResponse } from 'next/server'
import { pullInternalSamples, analyzeVoice } from '@/lib/quill'

export const maxDuration = 180

export async function POST() {
  try {
    // Pull internal samples (Scout outreach, Nova posts, Beacon emails)
    // Gmail/Outlook samples come in via n8n → POST /api/quill/samples
    const internalCount = await pullInternalSamples()

    // Run analysis across all samples (internal + anything n8n has already pushed)
    await analyzeVoice()

    return NextResponse.json({
      ok: true,
      internal: internalCount,
    })
  } catch (err) {
    console.error('[Quill] Analyze error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
