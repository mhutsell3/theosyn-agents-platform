import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { flagOverdueInvoices, generateFinancialSummary } from '@/lib/lumen'
import { isAgentEnabled } from '@/lib/agent-settings'

export async function POST() {
  if (!await isAgentEnabled('Lumen')) return NextResponse.json({ skipped: true, reason: 'Agent disabled' })
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [invoices, expenses] = await Promise.all([
    db`SELECT id, client_name, amount, status, due_date, invoice_number, paid_date FROM invoices`,
    db`SELECT amount, expense_date FROM expenses`,
  ])

  const inv = invoices as unknown as { id: string; client_name: string | null; amount: number; status: string; due_date: string | null; invoice_number: string | null; paid_date: string | null }[]
  const exp = expenses as unknown as { amount: number; expense_date: string }[]

  const overdue = flagOverdueInvoices(inv)
  const collectedMTD = inv.filter(i => i.status === 'Paid' && i.paid_date && new Date(i.paid_date) >= new Date(monthStart)).reduce((s, i) => s + Number(i.amount), 0)
  const outstandingTotal = inv.filter(i => i.status === 'Sent' || i.status === 'Overdue').reduce((s, i) => s + Number(i.amount), 0)
  const expensesMTD = exp.filter(e => new Date(e.expense_date) >= new Date(monthStart)).reduce((s, e) => s + Number(e.amount), 0)
  const totalRevenue = inv.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0)

  // Build monthly trend
  const monthlyTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = d.toISOString()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
    const rev = inv.filter(inv2 => inv2.status === 'Paid' && inv2.paid_date && new Date(inv2.paid_date) >= new Date(start) && new Date(inv2.paid_date) < new Date(end)).reduce((s, i2) => s + Number(i2.amount), 0)
    const exps = exp.filter(e => new Date(e.expense_date) >= new Date(start) && new Date(e.expense_date) < new Date(end)).reduce((s, e) => s + Number(e.amount), 0)
    monthlyTrend.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), revenue: rev, expenses: exps })
  }

  const report = await generateFinancialSummary({
    collectedMTD,
    outstandingTotal,
    overdueTotal: overdue.reduce((s, i) => s + i.amount, 0),
    overdueCount: overdue.length,
    expensesMTD,
    totalRevenue,
    overdueInvoices: overdue,
    monthlyTrend,
  })

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${report}, ARRAY['finance', 'lumen', 'heartbeat', 'weekly']
    FROM agents WHERE name = 'Lumen' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Lumen'`

  return NextResponse.json({ report, overdueCount: overdue.length })
}
