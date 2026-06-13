import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateInvoiceReminder } from '@/lib/lumen'

export async function POST(req: NextRequest) {
  const { invoiceId } = await req.json()
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })

  const [invoice] = await db`SELECT * FROM invoices WHERE id = ${invoiceId}`
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const i = invoice as unknown as { client_name: string | null; amount: number; invoice_number: string | null; due_date: string | null; description: string | null; status: string }
  const daysOverdue = i.due_date
    ? Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000)
    : null

  const email = await generateInvoiceReminder({ ...i, amount: Number(i.amount), daysOverdue })

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Lumen — Invoice Reminder Draft\n**Client:** ' + (i.client_name ?? 'Unknown') + '\n**Amount:** $' + Number(i.amount).toFixed(2) + '\n\n' + email.slice(0, 300) + '...'},
      ARRAY['lumen', 'invoice', 'reminder']
    FROM agents WHERE name = 'Lumen' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Lumen'`

  return NextResponse.json({ email })
}
