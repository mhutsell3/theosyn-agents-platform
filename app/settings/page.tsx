import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.orgId) redirect('/login')
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="mb-8">
          <a href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Dashboard</a>
          <h1 className="text-white text-2xl font-bold mt-4">Workspace Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">{session.user.orgName}</p>
        </div>
        <SettingsForm />
      </div>
    </div>
  )
}
