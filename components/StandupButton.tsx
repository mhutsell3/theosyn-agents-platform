'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function StandupButton() {
  const [loading, setLoading] = useState(false)
  const [standup, setStandup] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()

  async function handleStandup() {
    setLoading(true)
    try {
      const res = await fetch('/api/theo/standup', { method: 'POST' })
      const data = await res.json()
      setStandup(data.standup)
      setShowModal(true)
      router.refresh()
      // Auto-read aloud
      await readAloud(data.standup)
    } finally {
      setLoading(false)
    }
  }

  async function readAloud(text: string) {
    setSpeaking(true)
    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
        }
        audio.play()
      }
    } catch {
      setSpeaking(false)
    }
  }

  function stopAudio() {
    audioRef.current?.pause()
    audioRef.current = null
    setSpeaking(false)
  }

  function closeModal() {
    stopAudio()
    setShowModal(false)
  }

  return (
    <>
      <button
        onClick={handleStandup}
        disabled={loading}
        className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg transition-all ${
          loading
            ? 'bg-zinc-800 text-zinc-500'
            : speaking
            ? 'bg-indigo-900 text-indigo-300 animate-pulse'
            : 'bg-zinc-800 hover:bg-indigo-900 text-zinc-400 hover:text-indigo-300'
        }`}
      >
        <span>{loading ? '⏳' : speaking ? '🔊' : '🧠'}</span>
        {loading ? 'BRIEFING...' : speaking ? 'SPEAKING...' : 'STANDUP'}
      </button>

      {/* Modal */}
      {showModal && standup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal card */}
          <div className="relative bg-zinc-950 border border-indigo-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl shadow-indigo-900/30">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-indigo-900 border-2 border-indigo-500 flex items-center justify-center text-xl ${speaking ? 'shadow-[0_0_20px_rgba(99,102,241,0.8)]' : ''}`}>
                  🧠
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Theo — Daily Standup</p>
                  <p className="text-zinc-500 text-xs font-mono">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {speaking ? (
                  <button
                    onClick={stopAudio}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ⏹ Stop
                  </button>
                ) : (
                  <button
                    onClick={() => readAloud(standup)}
                    className="text-xs bg-indigo-800 hover:bg-indigo-700 text-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    🔊 Read Again
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="text-zinc-600 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Speaking indicator */}
            {speaking && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-indigo-950 rounded-lg border border-indigo-900">
                <span className="flex gap-0.5">
                  {[1,2,3,4].map(i => (
                    <span
                      key={i}
                      className="w-1 bg-indigo-400 rounded-full animate-pulse"
                      style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </span>
                <span className="text-indigo-400 text-xs font-mono">Theo is speaking...</span>
              </div>
            )}

            {/* Standup text */}
            <div className="max-h-72 overflow-y-auto">
              {standup.split('\n\n').map((para, i) => (
                <p key={i} className="text-zinc-300 text-sm leading-relaxed mb-3">{para}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
