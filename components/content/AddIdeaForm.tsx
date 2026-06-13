'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CONTENT_CHANNELS } from '@/lib/types'

export default function AddIdeaForm() {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState('YouTube')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await fetch('/api/content/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, channel }),
    })
    setTitle('')
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <select
        value={channel}
        onChange={e => setChannel(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
      >
        {CONTENT_CHANNELS.map(c => <option key={c}>{c}</option>)}
      </select>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Add a content idea..."
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
      />
      <button type="submit" disabled={loading || !title.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
        Add
      </button>
    </form>
  )
}
