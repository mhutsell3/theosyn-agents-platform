import { db } from '@/lib/db'
import ApprovalsPage from '@/components/ApprovalsPage'

export const metadata = { title: 'Approvals | TheoSYN' }
export const revalidate = 0

export default async function Approvals() {
  const approvals = await db`
    SELECT
      pa.*,
      c.name as client_name,
      sl.name as lead_name
    FROM piper_approvals pa
    LEFT JOIN clients c ON c.id = pa.client_id
    LEFT JOIN scout_leads sl ON sl.id = pa.lead_id
    WHERE pa.status = 'pending'
    ORDER BY pa.created_at DESC`

  const inbox = await db`
    SELECT * FROM piper_lead_inbox
    WHERE status = 'pending'
    ORDER BY received_at DESC`

  return (
    <ApprovalsPage
      approvals={approvals as any[]}
      inbox={inbox as any[]}
    />
  )
}
