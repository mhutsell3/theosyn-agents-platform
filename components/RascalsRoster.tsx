import { Agent, agentStatus } from '@/lib/types'

const dotColor = {
  online: 'bg-emerald-400',
  idle: 'bg-amber-400',
  offline: 'bg-zinc-600',
}

export default function RascalsRoster({ agents }: { agents: Agent[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-white font-semibold mb-4">Agents</h2>
      <div className="flex flex-col gap-2">
        {agents.map(agent => {
          const status = agentStatus(agent)
          return (
            <div key={agent.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800 transition-colors">
              <div className="relative">
                <div className="text-2xl w-9 h-9 flex items-center justify-center bg-zinc-800 rounded-full">
                  {agent.avatar_emoji}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${dotColor[status]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{agent.name}</p>
                <p className="text-zinc-500 text-xs truncate">{agent.role}</p>
              </div>
              <span className={`text-xs capitalize ${status === 'online' ? 'text-emerald-400' : status === 'idle' ? 'text-amber-400' : 'text-zinc-600'}`}>
                {status}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
