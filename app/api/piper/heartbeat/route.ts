import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { flagStaleClients, generateHeartbeat } from '@/lib/piper'
import { isAgentEnabled } from '@/lib/agent-settings'

export async function POST() {
  if (!await isAgentEnabled('Piper')) return NextResponse.json({ skipped: true, reason: 'Agent disabled' })
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const [clients, recentMoves, newClients] = await Promise.all([
    db`SELECT id, name, stage, contact_name, contact_email, notes, updated_at FROM clients WHERE stage != 'Completed'`,
    db`SELECT name, stage FROM clients WHERE updated_at >= ${oneWeekAgo} AND stage != 'Completed' ORDER BY updated_at DESC LIMIT 10`,
    db`SELECT name, type FROM clients WHERE created_at >= ${oneWeekAgo} ORDER BY created_at DESC`,
  ])

  const allClients = clients as unknown as { id: string; name: string; stage: string; contact_name: string | null; contact_email: string | null; notes: string | null; updated_at: string }[]
  const stale = flagStaleClients(allClients)

  const report = await generateHeartbeat({
    totalClients: allClients.length,
    activeClients: allClients.filter(c => c.stage === 'Active').length,
    staleClients: stale,
    recentMoves: recentMoves as unknown as { name: string; stage: string }[],
    newClients: newClients as unknown as { name: string; type: string }[],
  })

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${report}, ARRAY['pipeline', 'clients', 'heartbeat', 'weekly']
    FROM agents WHERE name = 'Piper' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Piper'`

  return NextResponse.json({ report, staleCount: stale.length })
}
