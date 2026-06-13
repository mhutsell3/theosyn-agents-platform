import { db } from '@/lib/db'
import BeaconDashboard from '@/components/BeaconDashboard'

export const metadata = { title: 'Beacon — Community | TheoSYN' }
export const revalidate = 0

export default async function BeaconPage() {
  const students = await db`SELECT * FROM students ORDER BY enrolled_at DESC`

  const s = students as unknown as {
    id: string; name: string; email: string; phone: string | null
    purchase_level: string; ghl_contact_id: string | null
    status: string; welcome_sent: boolean; notes: string | null
    enrolled_at: string; updated_at: string
  }[]

  const counts = {
    total:     s.length,
    active:    s.filter(x => x.status === 'active').length,
    community: s.filter(x => x.purchase_level === 'Community').length,
    free:      s.filter(x => x.purchase_level === 'Free').length,
    core:      s.filter(x => x.purchase_level === 'Core').length,
    premium:   s.filter(x => x.purchase_level === 'Premium').length,
  }

  return <BeaconDashboard students={s} counts={counts} />
}
