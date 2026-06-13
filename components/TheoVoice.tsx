'use client'

import { useState, useRef, useEffect } from 'react'

type State = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

export default function TheoVoice() {
  const [state, setState] = useState<State>('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [expanded, setExpanded] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stateLabel: Record<State, string> = {
    idle:      'Hold to talk to Theo',
    listening: '🎙 Listening...',
    thinking:  '🧠 Thinking...',
    speaking:  '🔊 Speaking...',
    error:     '⚠️ Error — try again',
  }

  const stateColor: Record<State, string> = {
    idle:      'bg-indigo-600 hover:bg-indigo-500',
    listening: 'bg-rose-600 animate-pulse',
    thinking:  'bg-amber-600 animate-pulse',
    speaking:  'bg-emerald-600 animate-pulse',
    error:     'bg-zinc-700',
  }

  async function startListening() {
    if (state !== 'idle' && state !== 'error') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.start()
      setState('listening')
      setTranscript('')
      setResponse('')
    } catch {
      setState('error')
    }
  }

  async function stopListening() {
    if (state !== 'listening') return
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    setState('thinking')

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

      // Stop mic
      recorder.stream.getTracks().forEach(t => t.stop())

      try {
        // 1. Transcribe
        const form = new FormData()
        form.append('audio', blob, 'audio.webm')
        const transRes = await fetch('/api/voice/transcribe', { method: 'POST', body: form })
        const { text } = await transRes.json()
        setTranscript(text)
        if (!text) { setState('error'); return }

        // 2. Think
        const thinkRes = await fetch('/api/voice/think', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const { response: reply } = await thinkRes.json()
        setResponse(reply)
        setExpanded(true)

        // 3. Speak
        setState('speaking')
        const speakRes = await fetch('/api/voice/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: reply }),
        })

        if (speakRes.ok) {
          const audioBlob = await speakRes.blob()
          const url = URL.createObjectURL(audioBlob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            setState('idle')
            URL.revokeObjectURL(url)
          }
          audio.play()
        } else {
          setState('idle')
        }
      } catch {
        setState('error')
      }
    }

    recorder.stop()
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end gap-3">
      {/* Transcript / response bubble */}
      {expanded && (transcript || response) && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 max-w-sm shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-500 text-xs font-semibold">THEO</span>
            <button onClick={() => setExpanded(false)} className="text-zinc-600 hover:text-white text-xs">✕</button>
          </div>
          {transcript && (
            <p className="text-zinc-400 text-xs mb-2 italic">"{transcript}"</p>
          )}
          {response && (
            <p className="text-white text-sm leading-relaxed">{response}</p>
          )}
        </div>
      )}

      {/* Main button */}
      <button
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        className={`flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-medium shadow-2xl transition-all ${stateColor[state]}`}
      >
        <span className="text-lg">
          {state === 'idle' ? '🎙' :
           state === 'listening' ? '⏹' :
           state === 'thinking' ? '⏳' :
           state === 'speaking' ? '🔊' : '⚠️'}
        </span>
        <span className="hidden sm:block">{stateLabel[state]}</span>
      </button>
    </div>
  )
}
