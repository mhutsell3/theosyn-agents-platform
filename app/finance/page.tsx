import { db } from '@/lib/db'
import { Invoice, Expense, Client } from '@/lib/types'
import InvoiceRow from '@/components/finance/InvoiceRow'
import AddInvoiceModal from '@/components/finance/AddInvoiceModal'
import AddExpenseModal from '@/components/finance/AddExpenseModal'
import LumenPanel from '@/components/LumenPanel'

export const revalidate = 0

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export default async function FinancePage() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [invoices, expenses, clients] = await Promise.all([
    db<Invoice[]>`SELECT * FROM invoices ORDER BY created_at DESC`,
    db<Expense[]>`SELECT * FROM expenses ORDER BY expense_date DESC`,
    db<Client[]>`SELECT id, name FROM clients ORDER BY name`,
  ])

  // KPIs
  const paid = invoices.filter(i => i.status === 'Paid')
  const outstanding = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue')
  const overdue = invoices.filter(i => i.status === 'Overdue')
  const collectedMTD = paid
    .filter(i => i.paid_date && new Date(i.paid_date) >= new Date(monthStart))
    .reduce((sum, i) => sum + Number(i.amount), 0)
  const outstandingTotal = outstanding.reduce((sum, i) => sum + Number(i.amount), 0)
  const expensesMTD = expenses
    .filter(e => new Date(e.expense_date) >= new Date(monthStart))
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const totalRevenue = paid.reduce((sum, i) => sum + Number(i.amount), 0)

  const unpaid = invoices.filter(i => i.status !== 'Paid')
  const paidInvoices = invoices.filter(i => i.status === 'Paid')

  // Monthly revenue for last 6 months
  const months: { label: string; revenue: number; expenses: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = d.toISOString()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
    const rev = paid.filter(inv => inv.paid_date && new Date(inv.paid_date) >= new Date(start) && new Date(inv.paid_date) < new Date(end)).reduce((s, inv) => s + Number(inv.amount), 0)
    const exp = expenses.filter(e => new Date(e.expense_date) >= new Date(start) && new Date(e.expense_date) < new Date(end)).reduce((s, e) => s + Number(e.amount), 0)
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), revenue: rev, expenses: exp })
  }
  const maxBar = Math.max(...months.map(m => Math.max(m.revenue, m.expenses)), 1)

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="text-zinc-500 text-sm mt-1">Invoices · Expenses · Revenue</p>
        </div>
        <div className="flex gap-2">
          <AddExpenseModal />
          <AddInvoiceModal clients={clients} />
        </div>
      </div>

      {/* Lumen panel */}
      <LumenPanel />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs mb-1">Collected (MTD)</p>
          <p className="text-emerald-400 text-2xl font-bold">{fmt(collectedMTD)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs mb-1">Outstanding</p>
          <p className="text-amber-400 text-2xl font-bold">{fmt(outstandingTotal)}</p>
          {overdue.length > 0 && <p className="text-rose-400 text-xs">{overdue.length} overdue</p>}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs mb-1">Expenses (MTD)</p>
          <p className="text-rose-400 text-2xl font-bold">{fmt(expensesMTD)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs mb-1">Total Revenue</p>
          <p className="text-white text-2xl font-bold">{fmt(totalRevenue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Invoices */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          {/* Unpaid */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Open Invoices</h2>
            {unpaid.length === 0 ? (
              <p className="text-zinc-600 text-sm">No open invoices.</p>
            ) : (
              unpaid.map(inv => <InvoiceRow key={inv.id} invoice={inv} />)
            )}
          </div>

          {/* Paid */}
          {paidInvoices.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Paid Invoices</h2>
              {paidInvoices.slice(0, 10).map(inv => <InvoiceRow key={inv.id} invoice={inv} />)}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Revenue chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Last 6 Months</h2>
            <div className="flex items-end gap-2 h-32">
              {months.map(m => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '100px' }}>
                    <div
                      className="w-full bg-emerald-700 rounded-sm"
                      style={{ height: `${(m.revenue / maxBar) * 100}%` }}
                      title={`Revenue: ${fmt(m.revenue)}`}
                    />
                    <div
                      className="w-full bg-rose-900 rounded-sm"
                      style={{ height: `${(m.expenses / maxBar) * 100}%` }}
                      title={`Expenses: ${fmt(m.expenses)}`}
                    />
                  </div>
                  <span className="text-zinc-600 text-xs">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-700" /><span className="text-zinc-500 text-xs">Revenue</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-900" /><span className="text-zinc-500 text-xs">Expenses</span></div>
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Expenses</h2>
            {expenses.length === 0 ? (
              <p className="text-zinc-600 text-sm">No expenses recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {expenses.slice(0, 10).map(e => (
                  <div key={e.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-zinc-300 text-sm">{e.name}</p>
                      <p className="text-zinc-600 text-xs">{e.category}{e.recurring ? ` · ${e.recurrence}` : ''}</p>
                    </div>
                    <p className="text-rose-400 text-sm font-medium">{fmt(Number(e.amount))}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
