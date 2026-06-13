import { db } from '@/lib/db'
import { Agent } from '@/lib/types'
import AgentsGrid from '@/components/AgentsGrid'

export const revalidate = 30

export default async function AgentsPage() {
  const agents = await db<Agent[]>`SELECT * FROM agents ORDER BY category, name`

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        <p className="text-zinc-500 text-sm mt-1">Your active AI agent fleet — SMB and Church</p>
      </div>
      <AgentsGrid agents={agents as Agent[]} />
    </div>
  )
}
