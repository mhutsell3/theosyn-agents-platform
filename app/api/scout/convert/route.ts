import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Convert a scout lead into a Piper client (Discovery stage)
export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })

  const [lead] = await db`SELECT * FROM scout_leads WHERE id = ${id}`
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const [client] = await db`
    INSERT INTO clients (name, type, stage, contact_name, contact_email, notes)
    VALUES (
      ${(lead as { name: string }).name},
      'Small Business',
      'Discovery',
      ${(lead as { name: string }).name},
      null,
      ${'Scout lead — ' + (lead as { category: string }).category.replace(/_/g, ' ') + '\nAddress: ' + (lead as { address: string }).address + '\nPhone: ' + ((lead as { phone: string | null }).phone ?? 'N/A') + '\nWebsite: ' + ((lead as { website: string | null }).website ?? 'None') + '\nGrade: ' + (lead as { grade: string }).grade}
    )
    RETURNING *`

  await db`
    UPDATE scout_leads
    SET outreach_status = 'converted', client_id = ${(client as { id: string }).id}, updated_at = now()
    WHERE id = ${id}`

  // Notify Piper
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Scout → Piper Handoff\n**New Lead:** ' + (lead as { name: string }).name + '\nConverted from Scout prospect to Discovery pipeline.\n\n**Grade:** ' + (lead as { grade: string }).grade + '\n**Category:** ' + (lead as { category: string }).category.replace(/_/g, ' ')},
      ARRAY['scout', 'piper', 'lead', 'conversion']
    FROM agents WHERE name = 'Scout' LIMIT 1`

  return NextResponse.json({ client })
}
