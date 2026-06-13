import { db } from '@/lib/db'
import { ContentPost, ContentIdea } from '@/lib/types'
import AddPostModal from '@/components/content/AddPostModal'
import AddIdeaForm from '@/components/content/AddIdeaForm'
import IdeaItem from '@/components/content/IdeaItem'
import CalendarRow from '@/components/content/CalendarRow'
import NovaPanel from '@/components/content/NovaPanel'

export const revalidate = 0

export default async function ContentPage() {
  const [posts, ideas, metricsRows] = await Promise.all([
    db<ContentPost[]>`SELECT * FROM content_posts ORDER BY scheduled_date ASC NULLS LAST, created_at DESC`,
    db<ContentIdea[]>`SELECT * FROM content_ideas ORDER BY created_at DESC`,
    db`SELECT * FROM content_metrics WHERE month = date_trunc('month', now()) LIMIT 1`,
  ])

  const metrics = metricsRows[0] ?? { leads_generated: 0, email_subscribers: 0 }
  const upcoming = posts.filter(p => p.status !== 'Published')
  const published = posts.filter(p => p.status === 'Published')
  const thisMonth = published.filter(p => {
    if (!p.published_date) return false
    const d = new Date(p.published_date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content & Marketing</h1>
          <p className="text-zinc-500 text-sm mt-1">YouTube · TikTok · X · LinkedIn · Facebook · Instagram · Email</p>
        </div>
        <AddPostModal />
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs mb-1">Leads This Month</p>
          <p className="text-white text-2xl font-bold">{metrics.leads_generated}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs mb-1">Posts Published (MTD)</p>
          <p className="text-white text-2xl font-bold">{thisMonth.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs mb-1">Email Subscribers</p>
          <p className="text-white text-2xl font-bold">{metrics.email_subscribers.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Content Calendar */}
        <div className="xl:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Content Calendar</h2>
          {upcoming.length === 0 ? (
            <p className="text-zinc-600 text-sm">No upcoming content. Add a post to get started.</p>
          ) : (
            upcoming.map(post => <CalendarRow key={post.id} post={post} />)
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Nova Agent Panel */}
          <NovaPanel />

          {/* Ideas Backlog */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
            <h2 className="text-white font-semibold">Ideas Backlog</h2>
            <AddIdeaForm />
            <div className="flex-1">
              {ideas.length === 0 ? (
                <p className="text-zinc-600 text-sm">No ideas yet.</p>
              ) : (
                ideas.map(idea => <IdeaItem key={idea.id} idea={idea} />)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Published */}
      {published.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Recently Published</h2>
          {published.slice(0, 10).map(post => <CalendarRow key={post.id} post={post} />)}
        </div>
      )}
    </div>
  )
}
