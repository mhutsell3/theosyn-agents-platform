import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAgentStatuses } from '@/lib/agents'
import AgentDashboard from '@/components/AgentDashboard'

export const revalidate = 0

export default async function Home() {
  const session = await auth()
  if (!session?.user?.orgId) redirect('/login')

  const agents = await getAgentStatuses(session.user.orgId)
  return <AgentDashboard initialAgents={agents} orgName={session.user.orgName} />
}
