import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { flagOverdueInvoices } from '@/lib/lumen'

export async function GET() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [invoices, expenses] = await Promise.all([
    db`SELECT id, client_name, amount, status, due_date, invoice_number, description FROM invoices`,
    db`SELECT amount FROM expenses WHERE expense_date >= ${monthStart}`,
  ])

  const inv = invoices as unknown as { id: string; client_name: string | null; amount: number; status: string; due_date: string | null; invoice_number: string | null; description: string | null }[]

  const overdue = flagOverdueInvoices(inv)
  const collectedMTD = inv.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0)
  const outstandingTotal = inv.filter(i => i.status === 'Sent' || i.status === 'Overdue').reduce((s, i) => s + Number(i.amount), 0)
  const expensesMTD = (expenses as unknown as { amount: number }[]).reduce((s, e) => s + Number(e.amount), 0)

  return NextResponse.json({
    overdue,
    collectedMTD,
    outstandingTotal,
    overdueTotal: overdue.reduce((s, i) => s + i.amount, 0),
    expensesMTD,
  })
}
