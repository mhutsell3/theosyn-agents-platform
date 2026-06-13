'use client'

import { useEffect, useState } from 'react'

interface ServiceStatus {
  name: string
  url: string
  label: string
}

const SERVICES: ServiceStatus[] = [
  { name: 'ollama',    url: '/api/status/ollama',    label: 'OLLAMA' },
  { name: 'postgres',  url: '/api/status/postgres',  label: 'POSTGRES' },
  { name: 'voice',     url: '/api/status/voice',     label: 'VOICE' },
  { name: 'n8n',       url: '/api/status/n8n',       label: 'N8N' },
]

type Health = 'checking' | 'up' | 'stale' | 'down'

const healthColor: Record<Health, string> = {
  checking: 'text-zinc-600',
  up:       'text-emerald-400',
  stale:    'text-amber-400',
  down:     'text-rose-400',
}

const healthDot: Record<Health, string> = {
  checking: 'bg-zinc-600',
  up:       'bg-emerald-400 animate-pulse',
  stale:    'bg-amber-400',
  down:     'bg-rose-500',
}

export default function StatusBar() {
  const [statuses, setStatuses] = useState<Record<string, Health>>({
    ollama: 'checking', postgres: 'checking', voice: 'checking', n8n: 'checking',
  })
  const [latency, setLatency] = useState<Record<string, number>>({})

  useEffect(() => {
    async function checkAll() {
      await Promise.all(SERVICES.map(async (svc) => {
        const start = Date.now()
        try {
          const res = await fetch(svc.url, { cache: 'no-store' })
          const ms = Date.now() - start
          const data = await res.json()
          setLatency(prev => ({ ...prev, [svc.name]: ms }))
          setStatuses(prev => ({ ...prev, [svc.name]: data.status === 'ok' ? 'up' : 'stale' }))
        } catch {
          setStatuses(prev => ({ ...prev, [svc.name]: 'down' }))
        }
      }))
    }

    checkAll()
    const interval = setInterval(checkAll, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="hidden md:flex fixed bottom-0 left-56 right-0 z-40 bg-zinc-950 border-t border-zinc-800 px-6 py-1.5 items-center gap-6">
      <span className="text-zinc-700 text-xs font-mono uppercase tracking-widest">System</span>
      {SERVICES.map(svc => {
        const health = statuses[svc.name]
        const ms = latency[svc.name]
        return (
          <div key={svc.name} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${healthDot[health]}`} />
            <span className={`text-xs font-mono ${healthColor[health]}`}>{svc.label}</span>
            {ms && health === 'up' && (
              <span className="text-zinc-700 text-xs font-mono">{ms}ms</span>
            )}
            {health !== 'up' && health !== 'checking' && (
              <span className={`text-xs font-mono ${healthColor[health]}`}>{health.toUpperCase()}</span>
            )}
          </div>
        )
      })}
      <div className="ml-auto text-zinc-700 text-xs font-mono">
        TheoSYN Labs OS — {new Date().toLocaleDateString()}
      </div>
    </div>
  )
}
