import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createPaymentLink } from '@/lib/stripe'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [invoice] = await db`SELECT * FROM invoices WHERE id = ${id}`
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const paymentUrl = await createPaymentLink({
    id: invoice.id,
    client_name: invoice.client_name,
    amount: Number(invoice.amount),
    description: invoice.description,
    invoice_number: invoice.invoice_number,
  })

  await db`
    UPDATE invoices SET
      status = 'Sent',
      stripe_payment_url = ${paymentUrl}
    WHERE id = ${id}`

  return NextResponse.json({ payment_url: paymentUrl })
}
