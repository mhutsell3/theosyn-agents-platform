import { db } from '@/lib/db'
import { Client, STAGES } from '@/lib/types'
import PipelineColumn from '@/components/PipelineColumn'
import AddClientModal from '@/components/AddClientModal'
import PiperPanel from '@/components/PiperPanel'

export const revalidate = 0

export default async function ClientsPage() {
  const clients = await db<Client[]>`SELECT * FROM clients ORDER BY updated_at DESC`

  const byStage = Object.fromEntries(
    STAGES.map(stage => [stage, clients.filter(c => c.stage === stage)])
  )

  const total = clients.length
  const active = byStage['Active'].length
  const discovery = byStage['Discovery'].length

  return (
    <div className="p-6 flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Pipeline</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {total} total · {active} active · {discovery} in discovery
          </p>
        </div>
        <AddClientModal />
      </div>

      {/* Piper panel */}
      <PiperPanel />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => (
          <PipelineColumn key={stage} stage={stage} clients={byStage[stage] ?? []} />
        ))}
      </div>
    </div>
  )
}
