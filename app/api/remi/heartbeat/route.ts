import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdAccounts, fetchAccountInsights, saveSnapshots, buildRecommendations, saveRecommendations, generateHeartbeat } from '@/lib/remi'
import { isAgentEnabled } from '@/lib/agent-settings'

export async function POST() {
  if (!await isAgentEnabled('Remi')) return NextResponse.json({ skipped: true, reason: 'Agent disabled' })

  const accounts = await getAdAccounts()
  const allMetrics = []

  for (const account of accounts) {
    try {
      const metrics = await fetchAccountInsights(account, 'yesterday')
      await saveSnapshots(metrics)
      allMetrics.push(...metrics)
    } catch { /* skip failing accounts */ }
  }

  const recs = buildRecommendations(allMetrics)
  if (recs.length > 0) await saveRecommendations(recs)

  const report = await generateHeartbeat(allMetrics, recs)

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${report}, ARRAY['meta-ads', 'roas', 'performance', 'heartbeat']
    FROM agents WHERE name = 'Remi' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Remi'`

  return NextResponse.json({ report, campaigns: allMetrics.length, recommendations: recs.length })
}
