import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { flagStaleClients } from '@/lib/piper'

export async function GET() {
  const clients = await db`
    SELECT id, name, stage, contact_name, contact_email, notes, updated_at
    FROM clients
    WHERE stage != 'Completed'
    ORDER BY updated_at ASC`

  const stale = flagStaleClients(
    clients as unknown as { id: string; name: string; stage: string; contact_name: string | null; contact_email: string | null; notes: string | null; updated_at: string }[]
  )

  return NextResponse.json({ stale, total: (clients as unknown[]).length })
}
