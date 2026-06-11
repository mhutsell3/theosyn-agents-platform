'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface AgentStatus {
  id: string
  name: string
  role: string
  avatar_emoji: string
  ollama_model: string | null
  isOnline: boolean
  lastAction: string | null
  minutesAgo: number | null
}

// Agent desk positions in the office (grid coords)
const DESK_POSITIONS: Record<string, { x: number; y: number; color: string }> = {
  Theo:    { x: 2,  y: 2,  color: '#6366f1' },
  Scout:   { x: 5,  y: 2,  color: '#10b981' },
  Nova:    { x: 8,  y: 2,  color: '#f59e0b' },
  Quill:   { x: 2,  y: 6,  color: '#8b5cf6' },
  Beacon:  { x: 5,  y: 6,  color: '#06b6d4' },
  Flow:    { x: 8,  y: 6,  color: '#3b82f6' },
  Piper:   { x: 2,  y: 10, color: '#ec4899' },
  Remi:    { x: 5,  y: 10, color: '#ef4444' },
  Sage:    { x: 8,  y: 10, color: '#84cc16' },
  Lumen:   { x: 11, y: 2,  color: '#f97316' },
  Atlas:   { x: 11, y: 6,  color: '#64748b' },
  Scribe:  { x: 11, y: 10, color: '#a78bfa' },
}

const CELL = 48
const COLS = 14
const ROWS = 13

interface CharacterState {
  x: number
  y: number
  tx: number
  ty: number
  frame: number
  bobOffset: number
  bubble: string | null
  bubbleTimer: number
}

export default function PixelOffice({ agents }: { agents: AgentStatus[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<Map<string, CharacterState>>(new Map())
  const animRef = useRef<number>(0)
  const tickRef = useRef(0)
  const [selected, setSelected] = useState<AgentStatus | null>(null)

  // Init character positions
  useEffect(() => {
    agents.forEach(a => {
      if (stateRef.current.has(a.id)) return
      const desk = DESK_POSITIONS[a.name]
      const sx = desk ? desk.x * CELL + CELL / 2 : Math.random() * COLS * CELL
      const sy = desk ? desk.y * CELL + CELL / 2 : Math.random() * ROWS * CELL
      stateRef.current.set(a.id, {
        x: sx, y: sy, tx: sx, ty: sy,
        frame: 0, bobOffset: Math.random() * Math.PI * 2,
        bubble: null, bubbleTimer: 0,
      })
    })
  }, [agents])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    tickRef.current++
    const t = tickRef.current

    // Background — office floor
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid lines (floor tiles)
    ctx.strokeStyle = '#16213e'
    ctx.lineWidth = 1
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke()
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke()
    }

    // Draw desks
    agents.forEach(a => {
      const desk = DESK_POSITIONS[a.name]
      if (!desk) return
      const px = desk.x * CELL
      const py = desk.y * CELL
      const color = desk.color

      // Desk surface
      ctx.fillStyle = '#0f3460'
      ctx.fillRect(px + 4, py + 4, CELL * 1.5 - 8, CELL - 8)

      // Desk border
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(px + 4, py + 4, CELL * 1.5 - 8, CELL - 8)

      // Monitor
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(px + 12, py + 8, 24, 18)
      ctx.fillStyle = a.isOnline ? color : '#374151'
      ctx.fillRect(px + 14, py + 10, 20, 14)

      // Screen glow when online
      if (a.isOnline) {
        const glowAlpha = 0.3 + 0.2 * Math.sin(t * 0.05)
        ctx.fillStyle = color + Math.floor(glowAlpha * 255).toString(16).padStart(2, '0')
        ctx.fillRect(px + 14, py + 10, 20, 14)
      }

      // Name label
      ctx.fillStyle = '#cbd5e1'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(a.name, px + CELL * 0.75, py + CELL - 2)
    })

    // Draw characters
    agents.forEach(a => {
      const state = stateRef.current.get(a.id)
      if (!state) return
      const desk = DESK_POSITIONS[a.name]
      const color = desk?.color ?? '#6366f1'

      // Move toward target (sitting at desk)
      const dx = state.tx - state.x
      const dy = state.ty - state.y
      if (Math.abs(dx) > 1) state.x += dx * 0.08
      if (Math.abs(dy) > 1) state.y += dy * 0.08

      // Bob animation
      const bob = a.isOnline ? Math.sin(t * 0.08 + state.bobOffset) * 2 : 0
      const cx = state.x
      const cy = state.y + bob

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(cx, cy + 14, 8, 3, 0, 0, Math.PI * 2)
      ctx.fill()

      // Body
      ctx.fillStyle = a.isOnline ? color : '#374151'
      ctx.fillRect(cx - 8, cy - 8, 16, 16)

      // Head
      ctx.fillStyle = a.isOnline ? '#fde68a' : '#4b5563'
      ctx.fillRect(cx - 5, cy - 18, 10, 10)

      // Eyes
      if (a.isOnline) {
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(cx - 3, cy - 15, 2, 2)
        ctx.fillRect(cx + 1, cy - 15, 2, 2)
        // Blink
        if (t % 80 < 3) {
          ctx.fillStyle = '#fde68a'
          ctx.fillRect(cx - 3, cy - 15, 2, 2)
          ctx.fillRect(cx + 1, cy - 15, 2, 2)
        }
      }

      // Emoji avatar above character
      ctx.font = '14px serif'
      ctx.textAlign = 'center'
      ctx.fillText(a.avatar_emoji, cx, cy - 22)

      // Online indicator
      ctx.fillStyle = a.isOnline ? '#10b981' : '#6b7280'
      ctx.beginPath()
      ctx.arc(cx + 9, cy - 20, 3, 0, Math.PI * 2)
      ctx.fill()

      // Speech bubble
      if (state.bubble && state.bubbleTimer > 0) {
        state.bubbleTimer--
        const bx = cx - 60
        const by = cy - 60
        const bw = 120
        const bh = 36

        ctx.fillStyle = 'rgba(15,52,96,0.95)'
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(bx, by, bw, bh, 6)
        ctx.fill()
        ctx.stroke()

        // Tail
        ctx.beginPath()
        ctx.moveTo(cx - 4, by + bh)
        ctx.lineTo(cx, by + bh + 8)
        ctx.lineTo(cx + 4, by + bh)
        ctx.fillStyle = 'rgba(15,52,96,0.95)'
        ctx.fill()

        ctx.fillStyle = '#f1f5f9'
        ctx.font = '8px monospace'
        ctx.textAlign = 'center'
        // Word wrap into 2 lines
        const words = state.bubble.split(' ')
        let line1 = '', line2 = ''
        words.forEach(w => {
          if (line1.length + w.length < 18) line1 += (line1 ? ' ' : '') + w
          else line2 += (line2 ? ' ' : '') + w
        })
        ctx.fillText(line1, bx + bw / 2, by + 14)
        if (line2) ctx.fillText(line2.slice(0, 30), bx + bw / 2, by + 26)
      }
    })

    // Trigger bubbles occasionally for online agents
    if (t % 180 === 0) {
      const onlineAgents = agents.filter(a => a.isOnline && a.lastAction)
      if (onlineAgents.length) {
        const a = onlineAgents[Math.floor(Math.random() * onlineAgents.length)]
        const state = stateRef.current.get(a.id)
        if (state) {
          state.bubble = a.lastAction?.slice(0, 60) ?? null
          state.bubbleTimer = 150
        }
      }
    }

    animRef.current = requestAnimationFrame(draw)
  }, [agents])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (COLS * CELL / rect.width)
    const my = (e.clientY - rect.top) * (ROWS * CELL / rect.height)

    let closest: AgentStatus | null = null
    let closestDist = Infinity

    agents.forEach(a => {
      const state = stateRef.current.get(a.id)
      if (!state) return
      const d = Math.hypot(state.x - mx, state.y - my)
      if (d < closestDist) { closestDist = d; closest = a }
    })

    if (closestDist < 30) setSelected(s => s?.id === closest?.id ? null : closest)
  }

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={COLS * CELL}
        height={ROWS * CELL}
        onClick={handleClick}
        className="w-full rounded-xl border border-zinc-700 cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Selected agent panel */}
      {selected && (
        <div className="absolute top-3 right-3 bg-zinc-900/95 border border-zinc-700 rounded-xl p-4 w-64 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{selected.avatar_emoji}</span>
            <div>
              <p className="text-white font-bold text-sm">{selected.name}</p>
              <p className="text-zinc-500 text-xs">{selected.role}</p>
            </div>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${selected.isOnline ? 'bg-emerald-900 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
              {selected.isOnline ? 'Online' : 'Idle'}
            </span>
          </div>
          {selected.lastAction && (
            <p className="text-zinc-400 text-xs leading-relaxed">{selected.lastAction}</p>
          )}
          {selected.minutesAgo !== null && (
            <p className="text-zinc-600 text-xs mt-2">
              {selected.minutesAgo < 1 ? 'Active just now' : `Active ${selected.minutesAgo}m ago`}
            </p>
          )}
          {selected.ollama_model && (
            <p className="text-zinc-700 text-xs mt-1 font-mono">{selected.ollama_model}</p>
          )}
          <button onClick={() => setSelected(null)} className="absolute top-2 right-2 text-zinc-600 hover:text-zinc-400 text-xs">✕</button>
        </div>
      )}
    </div>
  )
}
