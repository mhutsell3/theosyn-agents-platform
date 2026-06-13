'use client'

import { useRouter } from 'next/navigation'
import { ContentIdea, channelColor } from '@/lib/types'

export default function IdeaItem({ idea }: { idea: ContentIdea }) {
  const router = useRouter()

  async function handleDelete() {
    await fetch(`/api/content/ideas/${idea.id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handlePromote() {
    await fetch('/api/content/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: idea.title, channel: idea.channel ?? 'YouTube', status: 'Draft' }),
    })
    await fetch(`/api/content/ideas/${idea.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-zinc-800 last:border-0 group">
      {idea.channel && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${channelColor[idea.channel]}`}>
          {idea.channel}
        </span>
      )}
      <p className="text-zinc-300 text-sm flex-1">{idea.title}</p>
      <div className="flex gap-1">
        <button onClick={handlePromote} className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded transition-colors" title="Move to Draft">
          → Draft
        </button>
        <button onClick={handleDelete} className="text-xs text-zinc-600 hover:text-rose-400 px-1 rounded transition-colors">
          ✕
        </button>
      </div>
    </div>
  )
}
