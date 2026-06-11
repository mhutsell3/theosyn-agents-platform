import { getAgentStatuses } from '@/lib/agents'
import AgentDashboard from '@/components/AgentDashboard'

export const revalidate = 0

export default async function Home() {
  const agents = await getAgentStatuses()
  return <AgentDashboard initialAgents={agents} />
}
