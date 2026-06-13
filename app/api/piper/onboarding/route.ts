import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateOnboardingChecklist } from '@/lib/piper'

export async function POST(req: NextRequest) {
  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const [client] = await db`SELECT * FROM clients WHERE id = ${clientId}`
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const c = client as unknown as { name: string; type: string; notes: string | null }
  const checklist = await generateOnboardingChecklist(c)

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Piper — Onboarding Checklist\n**Client:** ' + c.name + '\n\n' + checklist},
      ARRAY['piper', 'onboarding', 'checklist']
    FROM agents WHERE name = 'Piper' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Piper'`

  return NextResponse.json({ checklist })
}
