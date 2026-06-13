import { NextResponse } from 'next/server'
import { analyzeProductMargins, generateMarginRecommendations } from '@/lib/forge'

export const maxDuration = 120

export async function GET() {
  try {
    const margins = await analyzeProductMargins()
    return NextResponse.json({ margins })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const margins = await analyzeProductMargins()
    const recommendations = await generateMarginRecommendations(margins)
    return NextResponse.json({ margins, recommendations })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
