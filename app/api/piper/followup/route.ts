import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateFollowUp } from '@/lib/piper'

export async function POST(req: NextRequest) {
  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const [client] = await db`SELECT * FROM clients WHERE id = ${clientId}`
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const c = client as unknown as {
    name: string; stage: string; contact_name: string | null
    notes: string | null; updated_at: string
  }

  const daysInStage = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000)
  const email = await generateFollowUp({ ...c, daysInStage })

  // Log to activity feed
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Piper — Follow-up Draft\n**Client:** ' + c.name + '\n**Stage:** ' + c.stage + '\n\n' + email.slice(0, 300) + '...'},
      ARRAY['piper', 'followup', 'email']
    FROM agents WHERE name = 'Piper' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Piper'`

  return NextResponse.json({ email })
}
