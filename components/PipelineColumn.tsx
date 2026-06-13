import { Client, ClientStage, stageColor } from '@/lib/types'
import ClientCard from './ClientCard'

interface Props {
  stage: ClientStage
  clients: Client[]
}

export default function PipelineColumn({ stage, clients }: Props) {
  return (
    <div className="flex flex-col gap-3 min-w-48 flex-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stageColor[stage]}`}>
          {stage}
        </span>
        <span className="text-zinc-600 text-xs">{clients.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {clients.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-lg p-4 text-zinc-700 text-xs text-center">
            No clients
          </div>
        ) : (
          clients.map(c => <ClientCard key={c.id} client={c} />)
        )}
      </div>
    </div>
  )
}
