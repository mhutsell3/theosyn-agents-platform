'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NovaPanel() {
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [loadingHeartbeat, setLoadingHeartbeat] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  async function handleGenerateIdeas() {
    setLoadingIdeas(true)
    setResult(null)
    const res = await fetch('/api/nova/ideas', { method: 'POST' })
    const data = await res.json()
    setResult(`✨ Nova added ${data.count} ideas to your backlog.`)
    setLoadingIdeas(false)
    router.refresh()
  }

  async function handleHeartbeat() {
    setLoadingHeartbeat(true)
    setResult(null)
    const res = await fetch('/api/nova/heartbeat', { method: 'POST' })
    const data = await res.json()
    setResult('💓 Nova heartbeat written to the activity feed.')
    setLoadingHeartbeat(false)
    router.refresh()
  }

  return (
    <div className="bg-zinc-900 border border-indigo-900 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🎬</span>
        <div>
          <h3 className="text-white font-semibold text-sm">Nova — Content Agent</h3>
          <p className="text-zinc-500 text-xs">AI-powered content generation</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={handleGenerateIdeas}
          disabled={loadingIdeas}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors text-left px-3"
        >
          {loadingIdeas ? '✨ Generating ideas...' : '✨ Generate Ideas (Daily)'}
        </button>
        <button
          onClick={handleHeartbeat}
          disabled={loadingHeartbeat}
          className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm py-2 rounded-lg transition-colors text-left px-3"
        >
          {loadingHeartbeat ? '💓 Writing report...' : '💓 Run Weekly Heartbeat'}
        </button>
        <p className="text-zinc-600 text-xs mt-1">
          Click a post in the calendar to write or repurpose content with Nova.
        </p>
        {result && (
          <p className="text-emerald-400 text-xs mt-1">{result}</p>
        )}
      </div>
    </div>
  )
}
