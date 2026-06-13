'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SocialAccount {
  id: string
  platform: string
  page_name: string
  page_id: string
  active: boolean
  agent_name: string | null
  last_heartbeat: string | null
}

export default function SocialAccountRow({ account }: { account: SocialAccount }) {
  const [active, setActive] = useState(account.active)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function toggleActive() {
    const newVal = !active
    setActive(newVal)
    await fetch(`/api/social/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newVal }),
    })
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Remove "${account.page_name}" and delete its agent?`)) return
    setDeleting(true)
    await fetch(`/api/social/accounts/${account.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const platformEmoji: Record<string, string> = {
    Facebook: '📘', Instagram: '📸', LinkedIn: '💼', X: '🐦'
  }

  const heartbeatAge = account.last_heartbeat
    ? Math.floor((Date.now() - new Date(account.last_heartbeat).getTime()) / 3600000)
    : null

  return (
    <div className="flex items-center gap-4 py-3 border-b border-zinc-800 last:border-0">
      <span className="text-2xl">{platformEmoji[account.platform] ?? '📱'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">{account.page_name}</p>
        <p className="text-zinc-500 text-xs">{account.platform} · ID: {account.page_id}</p>
        {account.agent_name && (
          <p className="text-indigo-400 text-xs mt-0.5">
            🤖 {account.agent_name}
            {heartbeatAge !== null ? ` · last active ${heartbeatAge}h ago` : ' · no heartbeat yet'}
          </p>
        )}
      </div>
      <button
        onClick={toggleActive}
        className={`text-xs px-3 py-1 rounded-full transition-colors ${
          active ? 'bg-emerald-900 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
        }`}
      >
        {active ? 'Active' : 'Paused'}
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-zinc-600 hover:text-rose-400 text-xs transition-colors"
      >
        {deleting ? '...' : 'Remove'}
      </button>
    </div>
  )
}
