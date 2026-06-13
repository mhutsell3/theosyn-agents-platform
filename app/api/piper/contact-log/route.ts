import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const leadId = req.nextUrl.searchParams.get('leadId')

  if (!clientId && !leadId) {
    return NextResponse.json({ error: 'clientId or leadId required' }, { status: 400 })
  }

  const entries = clientId
    ? await db`SELECT * FROM contact_log WHERE client_id = ${clientId} ORDER BY created_at DESC`
    : await db`SELECT * FROM contact_log WHERE lead_id = ${leadId} ORDER BY created_at DESC`

  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const { clientId, leadId, entry_type, content, created_by } = await req.json()

  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })
  if (!clientId && !leadId) return NextResponse.json({ error: 'clientId or leadId required' }, { status: 400 })

  const [entry] = await db`
    INSERT INTO contact_log (client_id, lead_id, entry_type, content, created_by)
    VALUES (
      ${clientId ?? null},
      ${leadId ?? null},
      ${entry_type ?? 'note'},
      ${content},
      ${created_by ?? 'manual'}
    )
    RETURNING *`

  return NextResponse.json({ entry }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await db`DELETE FROM contact_log WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
