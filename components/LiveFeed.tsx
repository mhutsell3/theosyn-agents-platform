'use client'

import { useEffect, useRef, useState } from 'react'
import { Heartbeat } from '@/lib/types'
import FeedItem from './FeedItem'

export default function LiveFeed({ initial }: { initial: Heartbeat[] }) {
  const [beats, setBeats] = useState<Heartbeat[]>(initial)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/feed')
      if (res.ok) {
        const data = await res.json()
        setBeats(data)
      }
    }
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [beats])

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Live Activity</h2>
        <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {beats.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-8">No activity yet. Agents are standing by.</p>
        ) : (
          beats.map(beat => <FeedItem key={beat.id} beat={beat} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
