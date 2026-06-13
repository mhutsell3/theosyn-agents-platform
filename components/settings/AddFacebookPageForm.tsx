'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddFacebookPageForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [platform, setPlatform] = useState('Facebook')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/social/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_id: form.get('page_id'),
        access_token: form.get('access_token'),
        platform,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to connect page')
      return
    }
    ;(e.target as HTMLFormElement).reset()
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="text-zinc-400 text-xs mb-1 block">Platform</label>
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
        >
          <option>Facebook</option>
          <option>Instagram</option>
          <option>LinkedIn</option>
          <option>X</option>
        </select>
      </div>
      <div>
        <label className="text-zinc-400 text-xs mb-1 block">Page ID *</label>
        <input
          name="page_id"
          required
          placeholder="e.g. 123456789012345"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
        <p className="text-zinc-600 text-xs mt-1">Find this in your Facebook Page Settings → Page Transparency</p>
      </div>
      <div>
        <label className="text-zinc-400 text-xs mb-1 block">Page Access Token *</label>
        <textarea
          name="access_token"
          required
          rows={3}
          placeholder="Paste your Page Access Token here..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none font-mono text-xs"
        />
        <p className="text-zinc-600 text-xs mt-1">Get this from Meta for Developers → Graph API Explorer → Generate Token</p>
      </div>
      {error && <p className="text-rose-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors"
      >
        {loading ? 'Connecting & spinning up agent...' : 'Connect Page + Spin Up Agent'}
      </button>
    </form>
  )
}
