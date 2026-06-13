import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateMonthEndReport } from '@/lib/lumen'

export async function POST() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const [invoices, expenses, newClients, activeProjects] = await Promise.all([
    db`SELECT amount, status, paid_date FROM invoices WHERE paid_date >= ${monthStart} AND status = 'Paid'`,
    db`SELECT amount FROM expenses WHERE expense_date >= ${monthStart}`,
    db`SELECT COUNT(*) as count FROM clients WHERE created_at >= ${monthStart}`,
    db`SELECT COUNT(*) as count FROM projects WHERE phase != 'Delivered'`,
  ])

  const revenue = (invoices as unknown as { amount: number }[]).reduce((s, i) => s + Number(i.amount), 0)
  const expensesTotal = (expenses as unknown as { amount: number }[]).reduce((s, e) => s + Number(e.amount), 0)

  const report = await generateMonthEndReport({
    month: monthName,
    revenue,
    expenses: expensesTotal,
    invoicesPaid: (invoices as unknown[]).length,
    newClients: Number((newClients as unknown as { count: string }[])[0]?.count ?? 0),
    activeProjects: Number((activeProjects as unknown as { count: string }[])[0]?.count ?? 0),
  })

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${report}, ARRAY['lumen', 'finance', 'month-end', 'report']
    FROM agents WHERE name = 'Lumen' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Lumen'`

  return NextResponse.json({ report })
}
