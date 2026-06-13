import SagePanel from '@/components/SagePanel'
import { db } from '@/lib/db'

export const revalidate = 0

export default async function SagePage() {
  const briefs = await db`SELECT id, topic, created_at FROM sage_briefs ORDER BY created_at DESC LIMIT 10`

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🔍</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Sage</h1>
          <p className="text-zinc-500 text-sm">Research & Strategy — AI trends, competitive intel, church & SMB resources</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main panel */}
        <div className="lg:col-span-2">
          <SagePanel />
        </div>

        {/* Brief history */}
        <div className="flex flex-col gap-3">
          <h2 className="text-white font-semibold text-sm">Recent Briefs</h2>
          {(briefs as unknown as { id: string; topic: string; created_at: string }[]).length === 0 ? (
            <p className="text-zinc-600 text-xs">No briefs yet.</p>
          ) : (
            (briefs as unknown as { id: string; topic: string; created_at: string }[]).map(b => (
              <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-white text-sm font-medium">{b.topic}</p>
                <p className="text-zinc-600 text-xs mt-0.5">
                  {new Date(b.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
