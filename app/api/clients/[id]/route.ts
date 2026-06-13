import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { stage, notes, contact_name, contact_email } = body

  const [client] = await db`
    UPDATE clients SET
      stage = coalesce(${stage}, stage),
      notes = coalesce(${notes}, notes),
      contact_name = coalesce(${contact_name}, contact_name),
      contact_email = coalesce(${contact_email}, contact_email)
    WHERE id = ${id}
    RETURNING *`

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(client)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db`DELETE FROM clients WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
