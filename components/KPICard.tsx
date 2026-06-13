interface KPICardProps {
  label: string
  value: number | string
  icon: string
  sub?: string
  color?: 'indigo' | 'emerald' | 'amber' | 'rose'
}

const colorMap = {
  indigo: 'bg-indigo-500/10 text-indigo-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-400',
  rose: 'bg-rose-500/10 text-rose-400',
}

export default function KPICard({ label, value, icon, sub, color = 'indigo' }: KPICardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-sm">{label}</span>
        <span className={`text-xl p-2 rounded-lg ${colorMap[color]}`}>{icon}</span>
      </div>
      <div>
        <span className="text-white text-3xl font-bold">{value}</span>
        {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  )
}
