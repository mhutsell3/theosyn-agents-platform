'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContentPost, channelColor, statusColor, CONTENT_STATUSES } from '@/lib/types'
import PostDrawer from './PostDrawer'

function fmt(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CalendarRow({ post }: { post: ContentPost }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(post.status)
  const router = useRouter()

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    const newStatus = e.target.value
    setStatus(newStatus as typeof post.status)
    await fetch(`/api/content/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
  }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0 group cursor-pointer hover:bg-zinc-800/50 -mx-5 px-5 transition-colors"
      >
        <span className="text-zinc-500 text-xs w-16 flex-shrink-0">{fmt(post.scheduled_date)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${channelColor[post.channel]}`}>
          {post.channel}
        </span>
        <p className="text-zinc-300 text-sm flex-1 truncate">{post.title}</p>
        {post.draft_content && (
          <span className="text-zinc-600 text-xs flex-shrink-0">✍️</span>
        )}
        <select
          value={status}
          onChange={handleStatusChange}
          onClick={e => e.stopPropagation()}
          className={`text-xs px-1.5 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none flex-shrink-0 ${statusColor[status]}`}
        >
          {CONTENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {open && <PostDrawer post={post} onClose={() => setOpen(false)} />}
    </>
  )
}
