import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { estimateCost } from '@/lib/usage'

export async function GET() {
  const [byModel, byAgent, daily] = await Promise.all([
    db`
      SELECT
        model,
        provider,
        SUM(prompt_tokens)::int     AS prompt_tokens,
        SUM(completion_tokens)::int AS completion_tokens,
        SUM(total_tokens)::int      AS total_tokens,
        COUNT(*)::int               AS calls
      FROM token_usage
      GROUP BY model, provider
      ORDER BY total_tokens DESC`,

    db`
      SELECT
        agent,
        SUM(prompt_tokens)::int     AS prompt_tokens,
        SUM(completion_tokens)::int AS completion_tokens,
        SUM(total_tokens)::int      AS total_tokens,
        COUNT(*)::int               AS calls
      FROM token_usage
      GROUP BY agent
      ORDER BY total_tokens DESC`,

    db`
      SELECT
        DATE(created_at)            AS date,
        SUM(total_tokens)::int      AS total_tokens,
        COUNT(*)::int               AS calls,
        provider
      FROM token_usage
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at), provider
      ORDER BY date DESC`,
  ])

  // Add cost estimates to byModel
  const byModelWithCost = (byModel as any[]).map(row => ({
    ...row,
    estimated_cost: estimateCost(row.model, row.prompt_tokens, row.completion_tokens),
  }))

  const totalCost = byModelWithCost.reduce((sum, r) => sum + r.estimated_cost, 0)

  return NextResponse.json({ byModel: byModelWithCost, byAgent, daily, totalCost })
}
