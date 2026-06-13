import ScoutPanel from '@/components/ScoutPanel'
import ScoutApprovalPanel from '@/components/ScoutApprovalPanel'
import { db } from '@/lib/db'

export const revalidate = 0

export default async function ScoutPage() {
  const [stats, pendingCount] = await Promise.all([
    db`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE grade = 'A') as grade_a,
        COUNT(*) FILTER (WHERE grade = 'B') as grade_b,
        COUNT(*) FILTER (WHERE grade = 'C') as grade_c,
        COUNT(*) FILTER (WHERE outreach_status = 'contacted') as contacted,
        COUNT(*) FILTER (WHERE outreach_status = 'converted') as converted
      FROM scout_leads`,
    db`SELECT COUNT(*) as count FROM scout_leads WHERE approval_status = 'pending'`,
  ])

  const s = stats[0] as unknown as {
    total: string; grade_a: string; grade_b: string; grade_c: string
    contacted: string; converted: string
  }
  const pending = Number((pendingCount[0] as unknown as { count: string }).count)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🔭</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Scout</h1>
          <p className="text-zinc-500 text-sm">Lead Generation — Central Indiana · 75mi radius · 7 search areas</p>
        </div>
        {pending > 0 && (
          <span className="ml-auto bg-amber-600 text-white text-sm px-3 py-1 rounded-full font-medium animate-pulse">
            ✋ {pending} awaiting approval
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Leads',  value: s.total,     color: 'text-white' },
          { label: 'Grade A',      value: s.grade_a,   color: 'text-emerald-400' },
          { label: 'Grade B',      value: s.grade_b,   color: 'text-amber-400' },
          { label: 'Grade C',      value: s.grade_c,   color: 'text-zinc-500' },
          { label: 'Contacted',    value: s.contacted, color: 'text-blue-400' },
          { label: 'Converted',    value: s.converted, color: 'text-indigo-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-zinc-500 text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Approval panel — shown prominently when there are pending emails */}
      {pending > 0 && (
        <div className="mb-8">
          <ScoutApprovalPanel />
        </div>
      )}

      <ScoutPanel />
    </div>
  )
}
