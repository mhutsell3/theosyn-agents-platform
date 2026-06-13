import { NextResponse } from 'next/server'
import { getPipelines, getOpportunitiesByPipeline } from '@/lib/flow'

export async function GET() {
  try {
    const pipelines = await getPipelines()
    const withOpps = await Promise.all(
      pipelines.map(async p => ({
        ...p,
        opportunities: await getOpportunitiesByPipeline(p.id),
      }))
    )
    return NextResponse.json({ pipelines: withOpps })
  } catch (err) {
    console.error('[Flow] pipelines error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
