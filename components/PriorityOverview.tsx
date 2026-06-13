import { db } from '@/lib/db'
import Link from 'next/link'

export default async function PriorityOverview() {
  const [projects, invoices, clients] = await Promise.all([
    db`
      SELECT p.name, p.phase, p.due_date, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.phase != 'Delivered'
      ORDER BY p.due_date ASC NULLS LAST
      LIMIT 10`,
    db`
      SELECT client_name, amount, status, due_date
      FROM invoices
      WHERE status IN ('Overdue', 'Sent')
      ORDER BY status DESC, due_date ASC NULLS LAST
      LIMIT 5`,
    db`
      SELECT name, stage, updated_at
      FROM clients
      WHERE stage IN ('Discovery', 'Proposal')
      ORDER BY updated_at ASC
      LIMIT 5`,
  ])

  const today = new Date()

  const categorize = (due_date: string | null) => {
    if (!due_date) return 'low'
    const diff = Math.floor((new Date(due_date).getTime() - today.getTime()) / 86400000)
    if (diff < 0) return 'urgent'
    if (diff <= 3) return 'urgent'
    if (diff <= 7) return 'high'
    return 'low'
  }

  const urgent = (projects as unknown as { name: string; phase: string; due_date: string | null; client_name: string | null }[])
    .filter(p => categorize(p.due_date) === 'urgent')
  const high = (projects as unknown as { name: string; phase: string; due_date: string | null; client_name: string | null }[])
    .filter(p => categorize(p.due_date) === 'high')
  const low = (projects as unknown as { name: string; phase: string; due_date: string | null; client_name: string | null }[])
    .filter(p => categorize(p.due_date) === 'low')

  const overdueInvoices = (invoices as unknown as { client_name: string | null; amount: number; status: string; due_date: string | null }[])
    .filter(i => i.status === 'Overdue')
  const coldLeads = (clients as unknown as { name: string; stage: string; updated_at: string }[])
    .filter(c => {
      const daysSince = Math.floor((today.getTime() - new Date(c.updated_at).getTime()) / 86400000)
      return daysSince > 5
    })

  const totalItems = urgent.length + high.length + low.length + overdueInvoices.length + coldLeads.length
  const onTrack = totalItems > 0 ? Math.round(((totalItems - urgent.length - overdueInvoices.length) / totalItems) * 100) : 100

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Agency Tasks</span>
        <span className={`text-xs font-mono ${onTrack >= 80 ? 'text-emerald-400' : onTrack >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
          {onTrack}% ON TRACK
        </span>
      </div>

      {/* Priority rows */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'URGENT', count: urgent.length + overdueInvoices.length, color: 'text-rose-400' },
          { label: 'HIGH',   count: high.length + coldLeads.length,         color: 'text-amber-400' },
          { label: 'LOW',    count: low.length,                             color: 'text-zinc-400' },
        ].map(row => (
          <div key={row.label} className="bg-zinc-900 rounded-lg py-2">
            <p className={`text-lg font-bold font-mono ${row.color}`}>{row.count}</p>
            <p className="text-zinc-600 text-xs">{row.label}</p>
          </div>
        ))}
      </div>

      {/* Urgent items */}
      {(urgent.length > 0 || overdueInvoices.length > 0) && (
        <div className="flex flex-col gap-1">
          <span className="text-rose-400 text-xs font-mono">⚠ NEEDS ATTENTION</span>
          {urgent.slice(0, 2).map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
              <span className="text-zinc-300 text-xs truncate flex-1">{p.name}</span>
              <Link href="/projects" className="text-zinc-600 text-xs hover:text-indigo-400">→</Link>
            </div>
          ))}
          {overdueInvoices.slice(0, 2).map((inv, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
              <span className="text-zinc-300 text-xs truncate flex-1">
                Invoice: {inv.client_name} ${Number(inv.amount).toLocaleString()}
              </span>
              <Link href="/finance" className="text-zinc-600 text-xs hover:text-indigo-400">→</Link>
            </div>
          ))}
        </div>
      )}

      {/* Cold leads */}
      {coldLeads.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-amber-400 text-xs font-mono">⏳ FOLLOW UP</span>
          {coldLeads.slice(0, 2).map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-zinc-300 text-xs truncate flex-1">{c.name} — {c.stage}</span>
              <Link href="/clients" className="text-zinc-600 text-xs hover:text-indigo-400">→</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
