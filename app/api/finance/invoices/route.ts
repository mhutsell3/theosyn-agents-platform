import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const invoices = await db`SELECT * FROM invoices ORDER BY created_at DESC`
  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const { client_id, client_name, amount, status, description, issue_date, due_date, invoice_number } = await req.json()
  if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 })
  const [invoice] = await db`
    INSERT INTO invoices (client_id, client_name, amount, status, description, issue_date, due_date, invoice_number)
    VALUES (${client_id}, ${client_name}, ${amount}, ${status ?? 'Draft'}, ${description}, ${issue_date}, ${due_date}, ${invoice_number})
    RETURNING *`
  return NextResponse.json(invoice, { status: 201 })
}
