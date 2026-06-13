import { NextResponse } from 'next/server'
import { getFlowStats } from '@/lib/flow'

export async function GET() {
  try {
    const stats = await getFlowStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[Flow] stats error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
