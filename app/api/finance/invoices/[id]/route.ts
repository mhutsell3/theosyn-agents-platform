import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { status, paid_date, due_date, description } = await req.json()
  const [invoice] = await db`
    UPDATE invoices SET
      status      = coalesce(${status}, status),
      paid_date   = coalesce(${paid_date}, paid_date),
      due_date    = coalesce(${due_date}, due_date),
      description = coalesce(${description}, description)
    WHERE id = ${id} RETURNING *`
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db`DELETE FROM invoices WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
