'use client'

import { useEffect, useState } from 'react'
import { Heartbeat } from '@/lib/types'

function timestamp(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const tagColor: Record<string, string> = {
  standup:   'text-indigo-400',
  content:   'text-pink-400',
  research:  'text-cyan-400',
  finance:   'text-emerald-400',
  clients:   'text-blue-400',
  projects:  'text-amber-400',
  heartbeat: 'text-purple-400',
  weekly:    'text-purple-400',
  ideas:     'text-pink-400',
  strategy:  'text-cyan-400',
  sage:      'text-cyan-400',
}

export default function AutomationStream({ initial }: { initial: Heartbeat[] }) {
  const [beats, setBeats] = useState<Heartbeat[]>(initial)

  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/feed')
      if (res.ok) setBeats(await res.json())
    }
    const interval = setInterval(poll, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Automation Stream</span>
        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 font-mono">
        {beats.length === 0 ? (
          <p className="text-zinc-700 text-xs text-center py-8">No activity. Agents standing by.</p>
        ) : (
          beats.slice(0, 30).map(beat => {
            const primaryTag = beat.tags?.[0] ?? 'event'
            const color = tagColor[primaryTag] ?? 'text-zinc-400'
            const preview = beat.content
              .replace(/^#+\s*/gm, '')
              .replace(/\*\*/g, '')
              .split('\n')
              .find(l => l.trim().length > 10)
              ?.slice(0, 80) ?? ''

            return (
              <div key={beat.id} className="flex items-baseline gap-2 py-1 border-b border-zinc-900 hover:bg-zinc-900/50 px-1 rounded transition-colors">
                <span className="text-zinc-700 text-xs flex-shrink-0 w-10">{timestamp(beat.created_at)}</span>
                <span className={`text-xs flex-shrink-0 w-14 truncate ${color}`}>{beat.agent?.name ?? '—'}</span>
                <span className={`text-xs flex-shrink-0 ${color}`}>{primaryTag}</span>
                <span className="text-zinc-500 text-xs truncate flex-1">— {preview}</span>
                <span className="text-zinc-700 text-xs flex-shrink-0">{timeAgo(beat.created_at)}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
