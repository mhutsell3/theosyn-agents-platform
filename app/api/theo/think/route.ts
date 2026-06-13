import { NextResponse } from 'next/server'
import { theoThink } from '@/lib/theo'

export const maxDuration = 300

export async function POST() {
  try {
    const summary = await theoThink('manual')
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('[Theo] think error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
