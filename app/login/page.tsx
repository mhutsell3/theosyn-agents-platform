'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.ok) {
      router.push('/')
    } else {
      setError('Invalid credentials')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-4xl mb-2">🏢</p>
          <h1 className="text-white text-xl font-bold tracking-tight">TheoSYN Agents</h1>
          <p className="text-zinc-500 text-sm mt-1">Command Center · Live Status</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-4">
          <div>
            <label className="text-zinc-400 text-xs font-medium block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs font-medium block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
