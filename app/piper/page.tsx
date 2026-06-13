import { db } from '@/lib/db'
import { flagStaleClients } from '@/lib/piper'
import PiperDashboard from '@/components/PiperDashboard'

export const metadata = { title: 'Piper — Client Relations | TheoSYN' }
export const revalidate = 0

// Health score: 0-100 based on days in stage and recent contact log activity
function healthScore(client: { stage: string; updated_at: string }, logCount: number): 'green' | 'yellow' | 'red' {
  const days = Math.floor((Date.now() - new Date(client.updated_at).getTime()) / 86400000)
  const thresholds: Record<string, number> = { Discovery: 5, Proposal: 4, Onboarding: 7, Active: 14 }
  const threshold = thresholds[client.stage] ?? 7

  if (logCount > 0 && days < threshold) return 'green'
  if (days >= threshold * 2) return 'red'
  if (days >= threshold) return 'yellow'
  return 'green'
}

export default async function PiperPage() {
  const clients = await db`
    SELECT id, name, stage, contact_name, contact_email, notes, updated_at, type
    FROM clients
    WHERE stage != 'Completed'
    ORDER BY updated_at ASC`

  const allClients = clients as unknown as {
    id: string; name: string; stage: string; type: string
    contact_name: string | null; contact_email: string | null
    notes: string | null; updated_at: string
  }[]

  // Get recent contact log counts per client
  const logCounts = await db`
    SELECT client_id, COUNT(*) as count
    FROM contact_log
    WHERE client_id = ANY(${allClients.map(c => c.id)}::uuid[])
      AND created_at >= now() - interval '14 days'
    GROUP BY client_id`

  const logCountMap = Object.fromEntries(
    (logCounts as unknown as { client_id: string; count: string }[]).map(r => [r.client_id, Number(r.count)])
  )

  const clientsWithHealth = allClients.map(c => ({
    ...c,
    health: healthScore(c, logCountMap[c.id] ?? 0),
  }))

  const stale = flagStaleClients(clientsWithHealth)

  const stageCounts = {
    Discovery:  allClients.filter(c => c.stage === 'Discovery').length,
    Proposal:   allClients.filter(c => c.stage === 'Proposal').length,
    Onboarding: allClients.filter(c => c.stage === 'Onboarding').length,
    Active:     allClients.filter(c => c.stage === 'Active').length,
  }

  const lastHeartbeat = await db`
    SELECT content, created_at FROM heartbeats
    WHERE agent_id = (SELECT id FROM agents WHERE name = 'Piper' LIMIT 1)
      AND 'weekly' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1`

  const lastReport = lastHeartbeat[0] as unknown as { content: string; created_at: string } | undefined

  const pendingApprovals = await db`SELECT COUNT(*) as count FROM piper_approvals WHERE status = 'pending'`
  const pendingCount = Number((pendingApprovals[0] as unknown as { count: string }).count)

  const pendingInbox = await db`SELECT COUNT(*) as count FROM piper_lead_inbox WHERE status = 'pending'`
  const inboxCount = Number((pendingInbox[0] as unknown as { count: string }).count)

  return (
    <PiperDashboard
      stale={stale}
      allClients={clientsWithHealth}
      stageCounts={stageCounts}
      lastReport={lastReport ?? null}
      pendingApprovals={pendingCount}
      pendingInbox={inboxCount}
    />
  )
}
