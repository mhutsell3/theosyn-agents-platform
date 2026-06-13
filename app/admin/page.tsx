import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllAgentsForAdmin } from '@/lib/agents'
import AdminAgentList from './AdminAgentList'

export const revalidate = 0

export default async function AdminPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session?.user as any)?.isSystemAdmin) redirect('/')

  const agents = await getAllAgentsForAdmin()
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <a href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</a>
            <h1 className="text-white text-2xl font-bold mt-4">System Admin</h1>
            <p className="text-zinc-500 text-sm mt-1">Global agent control — disabled agents are hidden from all tenants</p>
          </div>
          <span className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full">
            System Admin
          </span>
        </div>
        <AdminAgentList initialAgents={agents} />
      </div>
    </div>
  )
}
