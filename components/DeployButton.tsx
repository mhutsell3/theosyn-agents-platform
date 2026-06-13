'use client'

import { useState } from 'react'

export default function DeployButton() {
  const [status, setStatus] = useState<'idle' | 'deploying' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function deploy() {
    setStatus('deploying')
    setMessage(null)
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'x-deploy-secret': process.env.NEXT_PUBLIC_DEPLOY_SECRET ?? '' },
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('done')
        setMessage(data.message)
      } else {
        setStatus('error')
        setMessage(data.error ?? 'Deploy failed')
      }
    } catch {
      setStatus('error')
      setMessage('Could not reach deploy endpoint')
    }
    setTimeout(() => { setStatus('idle'); setMessage(null) }, 10000)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
      <div>
        <h2 className="text-white font-semibold text-sm">Deploy</h2>
        <p className="text-zinc-500 text-xs mt-0.5">Pull latest code from GitHub and restart the server. Takes ~2 minutes.</p>
      </div>
      <button
        onClick={deploy}
        disabled={status === 'deploying'}
        className={`w-fit text-sm px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
          status === 'done'  ? 'bg-emerald-700 text-white' :
          status === 'error' ? 'bg-red-700 text-white' :
          'bg-indigo-700 hover:bg-indigo-600 text-white'
        }`}
      >
        {status === 'deploying' ? '⏳ Deploying...' :
         status === 'done'      ? '✓ Deploy started' :
         status === 'error'     ? '✗ Failed' :
         '🚀 Deploy Now'}
      </button>
      {message && <p className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{message}</p>}
      {status === 'done' && (
        <p className="text-zinc-500 text-xs">The server is rebuilding in the background. The site will be briefly unavailable then come back on its own.</p>
      )}
    </div>
  )
}
