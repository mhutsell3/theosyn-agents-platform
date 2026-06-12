'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { AgentStatus } from '@/lib/agents'

const COLORS: Record<string, string> = {
  Theo: '#6366f1', Scout: '#10b981', Nova: '#f59e0b',
  Quill: '#8b5cf6', Beacon: '#06b6d4', Flow: '#3b82f6',
  Piper: '#ec4899', Remi: '#ef4444', Sage: '#84cc16',
  Lumen: '#f97316', Atlas: '#64748b', Scribe: '#a78bfa',
}

const DESK_LAYOUT: Record<string, { col: number; row: number }> = {
  Theo:   { col: 0, row: 0 }, Scout:  { col: 1, row: 0 }, Nova:   { col: 2, row: 0 },
  Quill:  { col: 3, row: 0 }, Lumen:  { col: 4, row: 0 },
  Beacon: { col: 0, row: 1 }, Flow:   { col: 1, row: 1 }, Piper:  { col: 2, row: 1 },
  Remi:   { col: 3, row: 1 }, Sage:   { col: 4, row: 1 },
  Atlas:  { col: 0, row: 2 }, Scribe: { col: 1, row: 2 },
}

// Layout constants (px)
const COL_W = 110
const ROW_H = 150
const COL_START = 60
const ROW_START = 60
const CONF_X = 620
const CONF_Y = 20
const CONF_W = 170
const CONF_H = 310

// Seat positions inside conference room
const CONF_SEATS = [
  { x: CONF_X + 85, y: CONF_Y + 75 },
  { x: CONF_X + 140, y: CONF_Y + 110 },
  { x: CONF_X + 145, y: CONF_Y + 175 },
  { x: CONF_X + 85, y: CONF_Y + 225 },
  { x: CONF_X + 28, y: CONF_Y + 175 },
  { x: CONF_X + 28, y: CONF_Y + 110 },
]
const CONF_ENTRY_X = CONF_X - 5

type CharState = 'at_desk' | 'wandering' | 'to_desk' | 'going_to_meeting' | 'in_meeting'

interface Char {
  id: string; name: string; emoji: string; color: string
  isOnline: boolean; isAvailable: boolean; lastAction: string | null
  x: number; y: number; tx: number; ty: number
  deskX: number; deskY: number
  state: CharState; stateTimer: number; seatIndex: number
  moving: boolean; facing: number
  bubble: string | null; bubbleTimer: number
  walkPhase: number
}

interface MeetingState {
  active: boolean; participants: string[]; timer: number
  announcement: string; announceTick: number
}

interface RenderChar {
  id: string; name: string; emoji: string; color: string
  x: number; y: number; isOnline: boolean; isAvailable: boolean
  moving: boolean; facing: number; state: CharState
  bubble: string | null; walkPhase: number; lastAction: string | null
}

function deskPos(col: number, row: number) {
  return { x: COL_START + col * COL_W, y: ROW_START + row * ROW_H }
}

export default function PixelOffice({ agents, onCallMeeting, onMeetingChange }: {
  agents: AgentStatus[]
  onCallMeeting?: (fn: () => void) => void
  onMeetingChange?: (active: boolean) => void
}) {
  const charsRef = useRef<Char[]>([])
  const meetingRef = useRef<MeetingState>({ active: false, participants: [], timer: 0, announcement: '', announceTick: 0 })
  const triggerRef = useRef(false)
  const animRef = useRef(0)
  const tickRef = useRef(0)
  const charElemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const bubbleElemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [selected, setSelected] = useState<AgentStatus | null>(null)
  const [meetingAnnounce, setMeetingAnnounce] = useState('')
  const [confActive, setConfActive] = useState(false)

  useEffect(() => {
    onCallMeeting?.(() => { triggerRef.current = true })
  }, [onCallMeeting])

  // Init chars
  useEffect(() => {
    if (charsRef.current.length > 0) return
    charsRef.current = agents.map(a => {
      const layout = DESK_LAYOUT[a.name]
      const pos = layout ? deskPos(layout.col, layout.row) : { x: 200, y: 200 }
      return {
        id: a.id, name: a.name, emoji: a.avatar_emoji,
        color: COLORS[a.name] ?? '#6366f1',
        isOnline: a.isOnline, isAvailable: a.isAvailable, lastAction: a.lastAction,
        x: pos.x, y: pos.y, tx: pos.x, ty: pos.y,
        deskX: pos.x, deskY: pos.y,
        state: 'at_desk', stateTimer: 100 + Math.random() * 200, seatIndex: -1,
        moving: false, facing: 1,
        bubble: null, bubbleTimer: 0, walkPhase: Math.random() * Math.PI * 2,
      }
    })
  }, [agents])

  // Sync online status
  useEffect(() => {
    charsRef.current.forEach(c => {
      const a = agents.find(x => x.id === c.id)
      if (a) { c.isOnline = a.isOnline; c.isAvailable = a.isAvailable; c.lastAction = a.lastAction }
    })
  }, [agents])

  const loop = useCallback(() => {
    const t = ++tickRef.current
    const chars = charsRef.current
    const meeting = meetingRef.current

    // Meeting trigger
    const manual = triggerRef.current
    if (manual) triggerRef.current = false

    if (!meeting.active && (manual || t % 1200 === 0)) {
      const theo = chars.find(c => c.name === 'Theo' && (c.isOnline || manual)) ?? chars[0]
      if (theo) {
        const others = chars.filter(c => c.id !== theo.id && c.isAvailable && c.state === 'at_desk')
        const count = Math.min(1 + Math.floor(Math.random() * 3), others.length)
        const invited = others.sort(() => Math.random() - 0.5).slice(0, count)
        const all = [theo, ...invited]
        meeting.active = true
        meeting.participants = all.map(c => c.id)
        meeting.timer = 500 + Math.floor(Math.random() * 300)
        meeting.announcement = `📢 Theo called ${invited.length ? invited.map(c => c.name).join(', ') : 'a solo'} meeting`
        meeting.announceTick = 240
        setMeetingAnnounce(meeting.announcement)
        setConfActive(true)
        onMeetingChange?.(true)
        all.forEach((c, i) => {
          c.state = 'going_to_meeting'; c.seatIndex = i % CONF_SEATS.length
          c.tx = CONF_ENTRY_X; c.ty = c.deskY; c.stateTimer = 999
          c.bubble = '📅 Heading to meeting…'; c.bubbleTimer = 100
        })
      }
    }

    if (meeting.active) {
      meeting.timer--
      if (meeting.announceTick > 0) meeting.announceTick--
      if (meeting.announceTick === 0 && meeting.announcement) {
        meeting.announcement = ''; setMeetingAnnounce('')
      }
      if (meeting.timer <= 0) {
        meeting.participants.forEach(id => {
          const c = chars.find(x => x.id === id)
          if (c) { c.state = 'to_desk'; c.tx = c.deskX; c.ty = c.deskY; c.stateTimer = 200; c.bubble = '✅ Done!'; c.bubbleTimer = 80 }
        })
        meeting.active = false; meeting.participants = []
        setConfActive(false); onMeetingChange?.(false)
      }
    }

    // Update each char
    chars.forEach(c => {
      if (c.state === 'in_meeting') {
        // Seated idle bob
        c.walkPhase += 0.03
        const seat = CONF_SEATS[c.seatIndex] ?? CONF_SEATS[0]
        c.x = seat.x; c.y = seat.y + Math.sin(c.walkPhase) * 1.2
      } else {
        c.stateTimer--
        if (c.stateTimer <= 0) {
          if (c.state === 'at_desk' && !meeting.participants.includes(c.id)) {
            if (c.isOnline && Math.random() < 0.3) {
              const layout = DESK_LAYOUT[c.name]
              const row = layout?.row ?? 0
              const rowY = ROW_START + row * ROW_H
              c.tx = 40 + Math.random() * (CONF_X - 80); c.ty = rowY
              c.state = 'wandering'; c.stateTimer = 80 + Math.random() * 100
            } else { c.stateTimer = 150 + Math.random() * 200 }
          } else if (c.state === 'wandering') {
            c.tx = c.deskX; c.ty = c.deskY; c.state = 'to_desk'; c.stateTimer = 120
          } else if (c.state === 'to_desk' && Math.abs(c.x - c.deskX) < 4) {
            c.state = 'at_desk'; c.stateTimer = 150 + Math.random() * 250
          }
          if (c.isOnline && c.lastAction && Math.random() < 0.08) {
            c.bubble = c.lastAction.slice(0, 55); c.bubbleTimer = 160
          }
        }

        // Arrived at conf door
        if (c.state === 'going_to_meeting' && Math.abs(c.x - CONF_ENTRY_X) < 6) {
          c.state = 'in_meeting'
          const seat = CONF_SEATS[c.seatIndex] ?? CONF_SEATS[0]
          c.x = seat.x; c.y = seat.y
          c.tx = seat.x; c.ty = seat.y; c.moving = false
        }

        // Move
        const dx = c.tx - c.x, dy = c.ty - c.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = (c.isOnline || c.state === 'going_to_meeting') ? 1.4 : 0
        if (dist > 2 && speed > 0) {
          c.x += (dx / dist) * speed; c.y += (dy / dist) * speed
          c.facing = dx >= 0 ? 1 : -1; c.moving = true
          c.walkPhase += 0.15
        } else {
          c.moving = false
          // Gentle idle bob at desk
          if (c.isOnline) c.walkPhase += 0.04
          c.y = c.ty + Math.sin(c.walkPhase) * 1.5
        }
      }
      if (c.bubbleTimer > 0) c.bubbleTimer--

      // Direct DOM update for position (bypasses React reconcile for smoothness)
      const el = charElemRefs.current.get(c.id)
      if (el) {
        el.style.transform = `translate(${c.x - 22}px, ${c.y - 44}px) scaleX(${c.facing})`
        // Walk bob class
        if (c.moving) el.classList.add('char-walk')
        else el.classList.remove('char-walk')
      }
      const bel = bubbleElemRefs.current.get(c.id)
      if (bel) {
        bel.style.transform = `translate(${c.x - 80}px, ${c.y - 110}px)`
        bel.style.opacity = c.bubble && c.bubbleTimer > 0 ? Math.min(1, c.bubbleTimer / 20).toString() : '0'
        if (c.bubble && c.bubbleTimer > 0) {
          const nameEl = bel.querySelector('.bubble-name') as HTMLElement
          const textEl = bel.querySelector('.bubble-text') as HTMLElement
          if (nameEl) nameEl.textContent = c.name
          if (textEl) textEl.textContent = c.bubble.slice(0, 55)
        }
      }
    })

    // Random bubble
    if (t % 300 === 0) {
      const pick = chars.filter(c => c.isOnline && c.lastAction && c.state !== 'in_meeting')
      if (pick.length) {
        const c = pick[Math.floor(Math.random() * pick.length)]
        c.bubble = c.lastAction!.slice(0, 55); c.bubbleTimer = 180
      }
    }

    animRef.current = requestAnimationFrame(loop)
  }, [agents, onMeetingChange])

  useEffect(() => {
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [loop])

  const CANVAS_W = 810
  const CANVAS_H = 480

  return (
    <div className="space-y-0">
      <style>{`
        .char-avatar { transition: box-shadow 0.3s; }
        @keyframes charWalk {
          0%,100% { margin-top: 0px; }
          50% { margin-top: -3px; }
        }
        .char-walk .char-avatar { animation: charWalk 0.25s ease-in-out infinite; }
        @keyframes onlinePulse {
          0%,100% { box-shadow: 0 0 0 0 var(--agent-color); opacity: 1; }
          50% { box-shadow: 0 0 0 5px transparent; opacity: 0.9; }
        }
        .agent-online .char-avatar { animation: onlinePulse 2s ease-in-out infinite; }
      `}</style>

      {/* Announcement */}
      {meetingAnnounce && (
        <div className="flex justify-center mb-3">
          <div className="px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
            {meetingAnnounce}
          </div>
        </div>
      )}

      {/* Office canvas */}
      <div
        className="relative rounded-2xl overflow-hidden border border-zinc-800"
        style={{
          width: CANVAS_W, height: CANVAS_H,
          background: 'radial-gradient(ellipse at top, #0f1a2e 0%, #080d18 100%)',
        }}
      >
        {/* Dot grid background */}
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#334155" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Floor lanes */}
        {[0, 1, 2].map(row => {
          const y = ROW_START + row * ROW_H - 10
          return (
            <div key={row} className="absolute left-0 right-0" style={{ top: y, height: 78 }}>
              <div className="absolute inset-0 rounded-xl mx-3" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(51,65,85,0.3)' }} />
              <div className="absolute top-0 left-4 right-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.2), transparent)' }} />
              <div className="absolute bottom-0 left-4 right-4 h-px" style={{ background: 'rgba(51,65,85,0.4)' }} />
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-700">F{row + 1}</span>
            </div>
          )
        })}

        {/* Desks */}
        {agents.map(a => {
          const layout = DESK_LAYOUT[a.name]
          if (!layout) return null
          const { x, y } = deskPos(layout.col, layout.row)
          const color = COLORS[a.name] ?? '#6366f1'
          return (
            <div key={a.id} className="absolute" style={{ left: x - 28, top: y - 30, width: 56, height: 34 }}>
              {/* Desk surface */}
              <div className="absolute inset-0 rounded-lg" style={{
                background: 'rgba(15,32,64,0.9)',
                border: `1px solid ${a.isOnline ? color + '55' : 'rgba(51,65,85,0.4)'}`,
                boxShadow: a.isOnline ? `0 0 12px ${color}22` : 'none',
              }} />
              {/* Monitor */}
              <div className="absolute rounded-sm" style={{
                left: 14, top: 4, width: 18, height: 14,
                background: a.isOnline ? color : '#1f2937',
                opacity: a.isOnline ? 0.9 : 0.3,
                boxShadow: a.isOnline ? `0 0 8px ${color}88` : 'none',
              }} />
              {/* Monitor stand */}
              <div className="absolute rounded-sm" style={{ left: 21, top: 18, width: 4, height: 6, background: '#374151' }} />
              {/* Keyboard */}
              <div className="absolute rounded-sm" style={{ left: 8, top: 26, width: 30, height: 4, background: '#1e293b', border: '1px solid #374151' }} />
            </div>
          )
        })}

        {/* Conference room */}
        <div className="absolute rounded-2xl overflow-hidden" style={{
          left: CONF_X, top: CONF_Y, width: CONF_W, height: CONF_H,
          background: confActive ? 'rgba(12,20,40,0.97)' : 'rgba(10,16,32,0.9)',
          border: `1px solid ${confActive ? 'rgba(99,102,241,0.6)' : 'rgba(30,41,59,0.8)'}`,
          boxShadow: confActive ? '0 0 30px rgba(99,102,241,0.15), inset 0 0 30px rgba(99,102,241,0.05)' : 'none',
          backdropFilter: 'blur(12px)',
        }}>
          {/* Header */}
          <div className="px-3 py-2 border-b" style={{ borderColor: confActive ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.6)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: confActive ? '#6366f1' : '#374151', boxShadow: confActive ? '0 0 6px #6366f1' : 'none' }} />
              <span className="text-xs font-semibold" style={{ color: confActive ? '#a5b4fc' : '#475569' }}>CONFERENCE</span>
            </div>
          </div>
          {/* Whiteboard */}
          <div className="mx-3 mt-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.3)' }}>
            <div className="text-xs font-mono" style={{ color: confActive ? '#818cf8' : '#374151' }}>
              {confActive ? '● MEETING IN PROGRESS' : '○ Available'}
            </div>
          </div>
          {/* Table */}
          <div className="absolute rounded-full" style={{
            left: CONF_W / 2 - 38, top: 90, width: 76, height: 120,
            background: confActive ? 'rgba(30,41,80,0.9)' : 'rgba(20,28,56,0.7)',
            border: `1px solid ${confActive ? 'rgba(99,102,241,0.4)' : 'rgba(30,41,59,0.6)'}`,
            boxShadow: confActive ? '0 0 20px rgba(99,102,241,0.1)' : 'none',
          }} />
          {/* Empty seat rings */}
          {!confActive && CONF_SEATS.map((s, i) => (
            <div key={i} className="absolute rounded-full" style={{
              left: s.x - CONF_X - 8, top: s.y - CONF_Y - 8, width: 16, height: 16,
              border: '1px solid rgba(51,65,85,0.4)',
              background: 'rgba(15,23,42,0.6)',
            }} />
          ))}
        </div>

        {/* Decorative plants */}
        {[[24, ROW_START + 0 * ROW_H - 8], [CONF_X - 28, ROW_START + 0 * ROW_H - 8], [24, ROW_START + 1 * ROW_H - 8]].map(([px, py], i) => (
          <div key={i} className="absolute" style={{ left: px, top: py }}>
            <div className="w-5 h-3 rounded-t-sm" style={{ background: '#166534' }} />
            <div className="w-5 h-3 rounded-b-sm" style={{ background: '#78350f' }} />
          </div>
        ))}

        {/* Characters — DOM-manipulated directly in RAF loop */}
        {agents.map(a => {
          const color = COLORS[a.name] ?? '#6366f1'
          return (
            <div
              key={a.id}
              ref={el => { if (el) charElemRefs.current.set(a.id, el); else charElemRefs.current.delete(a.id) }}
              className={`absolute cursor-pointer select-none ${a.isOnline ? 'agent-online' : ''}`}
              style={{ width: 44, height: 44, willChange: 'transform', ['--agent-color' as string]: color + '55' }}
              onClick={() => setSelected(s => s?.id === a.id ? null : a)}
            >
              {/* Avatar circle */}
              <div className="char-avatar w-11 h-11 rounded-full flex items-center justify-center text-xl relative" style={{
                background: a.isOnline
                  ? `radial-gradient(135deg at 30% 30%, ${color}dd, ${color}88)`
                  : 'rgba(30,41,59,0.7)',
                border: `2px solid ${a.isOnline ? color : 'rgba(51,65,85,0.5)'}`,
                boxShadow: a.isOnline ? `0 0 16px ${color}55, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 4px rgba(0,0,0,0.3)',
                opacity: a.isOnline ? 1 : 0.35,
                filter: a.isOnline ? 'none' : 'grayscale(0.5)',
              }}>
                {a.avatar_emoji}
                {/* Online indicator dot */}
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950" style={{
                  background: a.isOnline ? '#10b981' : '#374151',
                  boxShadow: a.isOnline ? '0 0 6px #10b981' : 'none',
                }} />
              </div>
              {/* Name tag */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-md" style={{
                  background: 'rgba(10,14,26,0.85)',
                  color: a.isOnline ? color : '#475569',
                  fontSize: '9px',
                }}>
                  {a.name}
                </span>
              </div>
            </div>
          )
        })}

        {/* Speech bubbles — DOM-manipulated */}
        {agents.map(a => (
          <div
            key={`bubble-${a.id}`}
            ref={el => { if (el) bubbleElemRefs.current.set(a.id, el); else bubbleElemRefs.current.delete(a.id) }}
            className="absolute pointer-events-none"
            style={{ width: 160, opacity: 0, willChange: 'transform, opacity', transition: 'opacity 0.3s' }}
          >
            <div className="rounded-xl px-3 py-2" style={{
              background: 'rgba(10,14,26,0.95)',
              border: `1px solid ${COLORS[a.name] ?? '#6366f1'}55`,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              <p className="bubble-name text-xs font-bold mb-0.5" style={{ color: COLORS[a.name] ?? '#6366f1' }}></p>
              <p className="bubble-text text-xs leading-relaxed text-zinc-300" style={{ fontSize: '10px' }}></p>
            </div>
            {/* Bubble tail */}
            <div className="w-2 h-2 mx-auto -mt-px" style={{
              background: 'rgba(10,14,26,0.95)',
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            }} />
          </div>
        ))}

        {/* Selected agent panel */}
        {selected && (() => {
          const a = selected
          const color = COLORS[a.name] ?? '#6366f1'
          return (
            <div className="absolute top-3 right-3 rounded-2xl p-4 w-56" style={{
              background: 'rgba(8,13,24,0.97)', border: `1px solid ${color}44`,
              backdropFilter: 'blur(16px)', boxShadow: `0 0 30px ${color}22, 0 8px 32px rgba(0,0,0,0.5)`,
              zIndex: 20,
            }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{
                  background: `radial-gradient(135deg at 30% 30%, ${color}cc, ${color}66)`,
                  border: `2px solid ${color}`,
                }}>
                  {a.avatar_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm leading-none">{a.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 truncate">{a.role}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}22`, color }}>
                  {a.isOnline ? 'Online' : a.isAvailable ? 'Recent' : 'Idle'}
                </span>
              </div>
              {a.lastAction && <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">{a.lastAction}</p>}
              {a.minutesAgo !== null && (
                <p className="text-zinc-700 text-xs mt-2">
                  {a.minutesAgo < 1 ? 'Active just now' : `${a.minutesAgo}m ago`}
                </p>
              )}
              <button onClick={() => setSelected(null)} className="absolute top-2 right-2 text-zinc-600 hover:text-zinc-400 text-sm">✕</button>
            </div>
          )
        })()}
      </div>

      {/* Agent pills */}
      <div className="flex flex-wrap gap-2 mt-3">
        {agents.filter(a => a.isOnline || a.isAvailable).map(a => (
          <button key={a.id}
            onClick={() => setSelected(s => s?.id === a.id ? null : a)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
            style={{
              background: selected?.id === a.id ? `${COLORS[a.name] ?? '#6366f1'}22` : 'rgba(10,14,26,0.8)',
              borderColor: `${COLORS[a.name] ?? '#6366f1'}${a.isOnline ? '66' : '33'}`,
              color: a.isOnline ? (COLORS[a.name] ?? '#6366f1') : '#64748b',
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.isOnline ? (COLORS[a.name] ?? '#6366f1') : '#374151' }} />
            {a.avatar_emoji} {a.name}
          </button>
        ))}
      </div>
    </div>
  )
}
