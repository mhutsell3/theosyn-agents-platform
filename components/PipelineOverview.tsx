import { db } from '@/lib/db'
import Link from 'next/link'

export default async function PipelineOverview() {
  const [clients, invoices] = await Promise.all([
    db`SELECT stage, COUNT(*) as count FROM clients GROUP BY stage`,
    db`SELECT status, SUM(amount) as total FROM invoices GROUP BY status`,
  ])

  const stageMap = Object.fromEntries(
    (clients as unknown as { stage: string; count: string }[]).map(r => [r.stage, Number(r.count)])
  )
  const invoiceMap = Object.fromEntries(
    (invoices as unknown as { status: string; total: string }[]).map(r => [r.status, Number(r.total)])
  )

  const totalClients = Object.values(stageMap).reduce((a, b) => a + b, 0)
  const activeClients = stageMap['Active'] ?? 0
  const pipelineValue = (invoiceMap['Sent'] ?? 0) + (invoiceMap['Draft'] ?? 0)
  const wonValue = invoiceMap['Paid'] ?? 0
  const overdueValue = invoiceMap['Overdue'] ?? 0

  const stages = [
    { label: 'Discovery',  count: stageMap['Discovery']  ?? 0, color: 'bg-zinc-600' },
    { label: 'Proposal',   count: stageMap['Proposal']   ?? 0, color: 'bg-blue-600' },
    { label: 'Onboarding', count: stageMap['Onboarding'] ?? 0, color: 'bg-amber-600' },
    { label: 'Active',     count: stageMap['Active']     ?? 0, color: 'bg-emerald-600' },
    { label: 'Completed',  count: stageMap['Completed']  ?? 0, color: 'bg-indigo-600' },
  ]

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Pipeline</span>
        <Link href="/clients" className="text-indigo-400 text-xs hover:text-indigo-300">View →</Link>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-900 rounded-lg p-2.5 text-center">
          <p className="text-white font-bold text-lg">${(wonValue / 1000).toFixed(1)}k</p>
          <p className="text-zinc-500 text-xs">Collected</p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-2.5 text-center">
          <p className="text-amber-400 font-bold text-lg">${(pipelineValue / 1000).toFixed(1)}k</p>
          <p className="text-zinc-500 text-xs">Pipeline</p>
        </div>
        <div className="bg-zinc-900 rounded-lg p-2.5 text-center">
          <p className="text-rose-400 font-bold text-lg">${(overdueValue / 1000).toFixed(1)}k</p>
          <p className="text-zinc-500 text-xs">Overdue</p>
        </div>
      </div>

      {/* Client stages */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-500 text-xs">{totalClients} clients</span>
          <span className="text-emerald-400 text-xs">{activeClients} active</span>
        </div>
        {stages.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs w-20 flex-shrink-0">{s.label}</span>
            <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${s.color}`}
                style={{ width: totalClients > 0 ? `${(s.count / totalClients) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-zinc-400 text-xs w-4 text-right">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
