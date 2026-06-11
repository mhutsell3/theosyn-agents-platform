'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { AgentStatus } from '@/lib/agents'

const AGENT_COLORS: Record<string, string> = {
  Theo: '#6366f1', Scout: '#10b981', Nova: '#f59e0b',
  Quill: '#8b5cf6', Beacon: '#06b6d4', Flow: '#3b82f6',
  Piper: '#ec4899', Remi: '#ef4444', Sage: '#84cc16',
  Lumen: '#f97316', Atlas: '#64748b', Scribe: '#a78bfa',
}

const DESK_LAYOUT: Record<string, { dx: number; floor: number }> = {
  Theo:   { dx: 80,  floor: 0 },
  Scout:  { dx: 200, floor: 0 },
  Nova:   { dx: 320, floor: 0 },
  Quill:  { dx: 440, floor: 0 },
  Lumen:  { dx: 560, floor: 0 },
  Beacon: { dx: 80,  floor: 1 },
  Flow:   { dx: 200, floor: 1 },
  Piper:  { dx: 320, floor: 1 },
  Remi:   { dx: 440, floor: 1 },
  Sage:   { dx: 560, floor: 1 },
  Atlas:  { dx: 80,  floor: 2 },
  Scribe: { dx: 200, floor: 2 },
}

const FLOOR_Y = [148, 298, 448]
const CANVAS_W = 870
const CANVAS_H = 510
const FLOOR_H = 12

// Conference room
const CONF = { x: 688, y: 30, w: 168, h: 280 }
const CONF_TABLE = { x: 772, y: 162, rx: 44, ry: 26 }
const CONF_ENTRY = { x: 688, floorY: FLOOR_Y[0] }

// Seats around the conference table
const CONF_SEATS = [
  { x: 772, y: 100 },
  { x: 828, y: 128 },
  { x: 838, y: 172 },
  { x: 808, y: 210 },
  { x: 736, y: 210 },
  { x: 706, y: 172 },
  { x: 716, y: 128 },
]

type CharState = 'at_desk' | 'wandering' | 'to_desk' | 'going_to_meeting' | 'in_meeting' | 'leaving_meeting'

interface Char {
  id: string; name: string; emoji: string; color: string
  isOnline: boolean; lastAction: string | null
  x: number; y: number; tx: number; ty: number
  walkFrame: number; walkTick: number; facing: 1 | -1; moving: boolean
  idleTick: number
  state: CharState
  deskX: number; deskY: number
  stateTimer: number
  bubble: string | null; bubbleTimer: number
  seatIndex: number
}

interface MeetingState {
  active: boolean
  participants: string[]  // char ids
  timer: number
  announcement: string
  announceTick: number
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function drawCharacter(ctx: CanvasRenderingContext2D, c: Char, t: number, seated = false) {
  const { x, y, color, isOnline, walkFrame, facing, moving } = c
  const rgb = hexToRgb(color)
  const alpha = isOnline ? 1 : 0.3

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  if (!seated) ctx.scale(facing, 1)

  if (!seated) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath(); ctx.ellipse(0, 3, 10, 4, 0, 0, Math.PI * 2); ctx.fill()

    // Legs
    const legAngle = moving ? Math.sin(walkFrame * 0.6) * 0.5 : 0
    ctx.strokeStyle = `rgb(${Math.max(0, rgb.r - 40)},${Math.max(0, rgb.g - 40)},${Math.max(0, rgb.b - 40)})`
    ctx.lineWidth = 5; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-4 + Math.sin(-legAngle) * 14, 6 + Math.cos(-legAngle) * 14); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(4 + Math.sin(legAngle) * 14, 6 + Math.cos(legAngle) * 14); ctx.stroke()
  } else {
    // Seated legs
    ctx.strokeStyle = `rgb(${Math.max(0, rgb.r - 40)},${Math.max(0, rgb.g - 40)},${Math.max(0, rgb.b - 40)})`
    ctx.lineWidth = 5; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-10, 10); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(5, 4); ctx.lineTo(10, 10); ctx.stroke()
  }

  // Body
  ctx.fillStyle = color
  ctx.beginPath(); ctx.roundRect(-9, -14, 18, 22, 4); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.roundRect(-5, -12, 10, 10, 2); ctx.fill()

  // Arms
  const armSwing = (moving && !seated) ? Math.sin(walkFrame * 0.6 + Math.PI) * 0.4 : 0
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(-9 + Math.sin(-armSwing) * 10, -8 + Math.cos(-armSwing) * 8); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(9, -8); ctx.lineTo(9 + Math.sin(armSwing) * 10, -8 + Math.cos(armSwing) * 8); ctx.stroke()

  // Neck + head
  ctx.fillStyle = '#fde68a'; ctx.fillRect(-3, -20, 6, 8)
  ctx.beginPath(); ctx.arc(0, -28, 12, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(0, -28, 12, Math.PI, 0); ctx.fill()
  ctx.fillRect(-12, -30, 24, 6)

  // Eyes
  if (t % 180 < 4) {
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(-7, -27); ctx.lineTo(-3, -27); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(3, -27); ctx.lineTo(7, -27); ctx.stroke()
  } else {
    ctx.fillStyle = '#1e293b'
    ctx.beginPath(); ctx.arc(-5, -27, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(5, -27, 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'white'
    ctx.beginPath(); ctx.arc(-4, -28, 0.8, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(6, -28, 0.8, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, -24, 4, 0.2, Math.PI - 0.2); ctx.stroke()

  ctx.restore()

  // Online dot + emoji
  ctx.save()
  ctx.globalAlpha = alpha
  if (isOnline) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 0.08)
    ctx.fillStyle = `rgba(16,185,129,${pulse})`
    ctx.beginPath(); ctx.arc(x + 10, y - 40, 4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#10b981'
    ctx.beginPath(); ctx.arc(x + 10, y - 40, 3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.font = `${isOnline ? 16 : 13}px serif`
  ctx.textAlign = 'center'
  ctx.fillText(c.emoji, x, y - 46)
  ctx.restore()
}

function drawDesk(ctx: CanvasRenderingContext2D, dx: number, floorY: number, color: string, isOnline: boolean, t: number) {
  const dw = 68, dh = 18
  ctx.fillStyle = '#1e3a5f'
  ctx.beginPath(); ctx.roundRect(dx - dw / 2, floorY - dh - 18, dw, dh, 3); ctx.fill()
  ctx.strokeStyle = color; ctx.lineWidth = isOnline ? 1.5 : 0.5; ctx.stroke()

  ctx.fillStyle = '#0f172a'; ctx.fillRect(dx - 14, floorY - dh - 18 - 24, 28, 20)
  ctx.fillStyle = isOnline ? color : '#1f2937'; ctx.fillRect(dx - 12, floorY - dh - 18 - 22, 24, 16)
  if (isOnline) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.1 * Math.sin(t * 0.04)})`
    ctx.fillRect(dx - 12, floorY - dh - 18 - 22, 24, 16)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    for (let i = 0; i < 3; i++) ctx.fillRect(dx - 10, floorY - dh - 18 - 20 + i * 4, 8 + (dx + i * 13) % 8, 1.5)
  }
  ctx.fillStyle = '#334155'; ctx.fillRect(dx - 3, floorY - dh - 18 - 4, 6, 6); ctx.fillRect(dx - 8, floorY - dh - 18 - 2, 16, 3)
  ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(dx, floorY - 4, 14, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(dx, floorY - 4, 10, 0, Math.PI * 2); ctx.fill()
}

function drawConferenceRoom(ctx: CanvasRenderingContext2D, t: number, meeting: MeetingState) {
  const { x, y, w, h } = CONF
  const active = meeting.active

  // Room walls
  ctx.fillStyle = '#0f1f35'
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill()
  ctx.strokeStyle = active ? '#6366f1' : '#1e3a5f'
  ctx.lineWidth = active ? 2 : 1
  if (active) {
    const glow = 0.5 + 0.3 * Math.sin(t * 0.05)
    ctx.shadowColor = '#6366f1'; ctx.shadowBlur = 8 * glow
  }
  ctx.stroke()
  ctx.shadowBlur = 0

  // Door opening at bottom-left
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(x, y + h - 36, 22, 36)
  ctx.fillStyle = active ? '#6366f150' : '#1e293b'
  ctx.fillRect(x + 1, y + h - 35, 20, 34)

  // Room label
  ctx.fillStyle = active ? '#818cf8' : '#475569'
  ctx.font = 'bold 10px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('CONFERENCE', x + w / 2, y + 16)

  // Whiteboard on back wall
  ctx.fillStyle = '#1e3a5f'
  ctx.beginPath(); ctx.roundRect(x + 20, y + 22, w - 40, 30, 3); ctx.fill()
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.stroke()
  if (active) {
    ctx.fillStyle = '#6366f188'
    ctx.font = '7px monospace'
    ctx.fillText('MEETING IN PROGRESS', x + w / 2, y + 40)
    ctx.fillStyle = '#6366f144'
    ctx.fillRect(x + 22, y + 44, 40 + Math.sin(t * 0.02) * 20, 2)
    ctx.fillRect(x + 22, y + 48, 60 + Math.cos(t * 0.03) * 15, 2)
  } else {
    ctx.fillStyle = '#334155'
    ctx.font = '7px monospace'
    ctx.fillText('Available', x + w / 2, y + 40)
  }

  // Conference table
  ctx.fillStyle = active ? '#1e3a5f' : '#162032'
  ctx.strokeStyle = active ? '#3b82f688' : '#1e3a5f'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(CONF_TABLE.x, CONF_TABLE.y, CONF_TABLE.rx, CONF_TABLE.ry, 0, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Table surface sheen
  ctx.fillStyle = 'rgba(99,102,241,0.06)'
  ctx.beginPath()
  ctx.ellipse(CONF_TABLE.x - 8, CONF_TABLE.y - 8, 20, 12, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // Empty chairs
  if (!active) {
    CONF_SEATS.forEach(seat => {
      const angle = Math.atan2(seat.y - CONF_TABLE.y, seat.x - CONF_TABLE.x)
      const cx = seat.x + Math.cos(angle) * 8
      const cy = seat.y + Math.sin(angle) * 8
      ctx.fillStyle = '#1e293b'
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.stroke()
    })
  }

  // Active meeting glow dots
  if (active) {
    const pulse = 0.4 + 0.3 * Math.sin(t * 0.06)
    ctx.fillStyle = `rgba(99,102,241,${pulse})`
    ctx.beginPath()
    ctx.ellipse(CONF_TABLE.x, CONF_TABLE.y, CONF_TABLE.rx + 6, CONF_TABLE.ry + 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Floor line connecting to main office
  ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, CANVAS_H); ctx.stroke()
}

function drawBubble(ctx: CanvasRenderingContext2D, c: Char) {
  if (!c.bubble || c.bubbleTimer <= 0) return
  const bw = 160, bh = 44
  const bx = Math.max(4, Math.min(c.x - bw / 2, CANVAS_W - bw - 4))
  const by = c.y - 100

  ctx.fillStyle = 'rgba(15,23,42,0.97)'; ctx.strokeStyle = c.color; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke()
  ctx.fillStyle = 'rgba(15,23,42,0.97)'
  ctx.beginPath(); ctx.moveTo(c.x - 5, by + bh); ctx.lineTo(c.x, by + bh + 8); ctx.lineTo(c.x + 5, by + bh); ctx.fill()

  ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'left'
  ctx.fillText(c.name, bx + 8, by + 14)
  ctx.fillStyle = '#94a3b8'; ctx.font = '8px system-ui'
  const words = (c.bubble ?? '').split(' ')
  let l1 = '', l2 = ''
  words.forEach(w => { if ((l1 + ' ' + w).length < 22) l1 += (l1 ? ' ' : '') + w; else l2 += (l2 ? ' ' : '') + w })
  ctx.fillText(l1, bx + 8, by + 27)
  if (l2) ctx.fillText(l2.slice(0, 28), bx + 8, by + 38)
}

function drawOfficeBackground(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1a2744')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)

  // Windows
  for (let i = 0; i < 4; i++) {
    const wx = 30 + i * 155
    const shimmer = 0.05 + 0.02 * Math.sin(t * 0.02 + i)
    ctx.fillStyle = `rgba(99,102,241,${shimmer})`
    ctx.beginPath(); ctx.roundRect(wx, 8, 100, 52, 6); ctx.fill()
    ctx.strokeStyle = 'rgba(99,102,241,0.2)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.strokeStyle = 'rgba(99,102,241,0.15)'
    ctx.beginPath(); ctx.moveTo(wx + 50, 8); ctx.lineTo(wx + 50, 60); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(wx, 34); ctx.lineTo(wx + 100, 34); ctx.stroke()
  }

  // Floors
  FLOOR_Y.forEach((fy, i) => {
    const fg = ctx.createLinearGradient(0, fy, 0, fy + FLOOR_H)
    fg.addColorStop(0, '#334155'); fg.addColorStop(1, '#1e293b')
    ctx.fillStyle = fg; ctx.fillRect(0, fy, CONF.x - 2, FLOOR_H)
    ctx.fillStyle = 'rgba(148,163,184,0.12)'; ctx.fillRect(0, fy, CONF.x - 2, 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1
    for (let x = 0; x < CONF.x; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x, fy + FLOOR_H); ctx.stroke()
    }
    ctx.fillStyle = 'rgba(148,163,184,0.18)'; ctx.font = '8px monospace'; ctx.textAlign = 'right'
    ctx.fillText(`Floor ${i + 1}`, CONF.x - 8, fy + 10)
  })

  // Plants
  const plants = [[20, FLOOR_Y[0]], [630, FLOOR_Y[0]], [20, FLOOR_Y[1]], [630, FLOOR_Y[2]]]
  plants.forEach(([px, py]) => {
    ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.roundRect(px - 8, py - 20, 16, 14, 2); ctx.fill()
    ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.arc(px, py - 24, 10, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#15803d'
    ctx.beginPath(); ctx.arc(px - 6, py - 28, 7, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(px + 6, py - 27, 7, 0, Math.PI * 2); ctx.fill()
  })
}

function drawMeetingAnnouncement(ctx: CanvasRenderingContext2D, meeting: MeetingState, t: number) {
  if (!meeting.announcement || meeting.announceTick <= 0) return
  const alpha = Math.min(1, meeting.announceTick / 40) * Math.min(1, (meeting.announceTick) / 20)
  const bw = 260, bh = 36
  const bx = (CONF.x - bw) / 2
  const by = FLOOR_Y[0] - 80

  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(99,102,241,0.95)'
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 20); ctx.fill()
  ctx.fillStyle = 'white'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'
  ctx.fillText(meeting.announcement, bx + bw / 2, by + 23)
  ctx.globalAlpha = 1
}

export default function PixelOffice({ agents, onCallMeeting, onMeetingChange }: {
  agents: AgentStatus[]
  onCallMeeting?: (fn: () => void) => void
  onMeetingChange?: (active: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const charsRef = useRef<Char[]>([])
  const meetingRef = useRef<MeetingState>({ active: false, participants: [], timer: 0, announcement: '', announceTick: 0 })
  const triggerMeetingRef = useRef(false)

  // Expose trigger to parent
  useEffect(() => {
    onCallMeeting?.(() => { triggerMeetingRef.current = true })
  }, [onCallMeeting])
  const animRef = useRef(0)
  const tickRef = useRef(0)
  const [selected, setSelected] = useState<AgentStatus | null>(null)

  useEffect(() => {
    if (charsRef.current.length > 0) return
    charsRef.current = agents.map(a => {
      const layout = DESK_LAYOUT[a.name]
      const dx = layout?.dx ?? 300
      const dy = FLOOR_Y[layout?.floor ?? 0] - 2
      return {
        id: a.id, name: a.name, emoji: a.avatar_emoji,
        color: AGENT_COLORS[a.name] ?? '#6366f1',
        isOnline: a.isOnline, lastAction: a.lastAction,
        x: dx, y: dy, tx: dx, ty: dy,
        walkFrame: 0, walkTick: 0, facing: 1, moving: false,
        idleTick: Math.random() * 200,
        state: 'at_desk' as CharState, deskX: dx, deskY: dy,
        stateTimer: 80 + Math.random() * 200,
        bubble: null, bubbleTimer: 0, seatIndex: -1,
      }
    })
  }, [agents])

  useEffect(() => {
    charsRef.current.forEach(c => {
      const a = agents.find(x => x.id === c.id)
      if (a) { c.isOnline = a.isOnline; c.lastAction = a.lastAction }
    })
  }, [agents])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const t = ++tickRef.current
    const meeting = meetingRef.current
    const chars = charsRef.current

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    drawOfficeBackground(ctx, CANVAS_W, CANVAS_H, t)
    drawConferenceRoom(ctx, t, meeting)

    // Draw desks
    agents.forEach(a => {
      const layout = DESK_LAYOUT[a.name]
      if (!layout) return
      drawDesk(ctx, layout.dx, FLOOR_Y[layout.floor], AGENT_COLORS[a.name] ?? '#6366f1', a.isOnline, t)
    })

    // ── Meeting trigger ──
    const manualTrigger = triggerMeetingRef.current
    if (manualTrigger) triggerMeetingRef.current = false

    if (!meeting.active && (manualTrigger || t % 1200 === 0)) {
      const theo = chars.find(c => c.name === 'Theo') ?? chars[0]
      if (theo) {
        const others = chars.filter(c => c.id !== theo.id && c.isOnline && c.state === 'at_desk')
        if (others.length >= 0) {
          const count = Math.min(Math.floor(1 + Math.random() * 3), others.length)
          const invited = others.sort(() => Math.random() - 0.5).slice(0, count)
          const all = [theo, ...invited]

          meeting.active = true
          meeting.participants = all.map(c => c.id)
          meeting.timer = 500 + Math.floor(Math.random() * 300)
          meeting.announcement = `📢 Theo called ${invited.map(c => c.name).join(', ')} to a meeting!`
          meeting.announceTick = 220
          onMeetingChange?.(true)

          all.forEach((c, i) => {
            c.state = 'going_to_meeting'
            c.seatIndex = i % CONF_SEATS.length
            c.tx = CONF_ENTRY.x - 10
            c.ty = CONF_ENTRY.floorY - 2
            c.stateTimer = 999
            if (c.lastAction && Math.random() < 0.5) {
              c.bubble = '📅 Heading to meeting...'
              c.bubbleTimer = 120
            }
          })
        }
      }
    }

    // Meeting countdown
    if (meeting.active) {
      meeting.timer--
      if (meeting.announceTick > 0) meeting.announceTick--

      if (meeting.timer <= 0) {
        meeting.participants.forEach(id => {
          const c = chars.find(x => x.id === id)
          if (c) {
            c.state = 'to_desk'
            c.tx = c.deskX; c.ty = c.deskY
            c.stateTimer = 200
            c.bubble = '✅ Meeting done!'; c.bubbleTimer = 100
          }
        })
        meeting.active = false
        meeting.participants = []
        meeting.announcement = ''
        onMeetingChange?.(false)
      }
    }

    // ── Update + draw characters ──
    const inMeetingChars: Char[] = []

    chars.forEach(c => {
      if (c.state === 'in_meeting') { inMeetingChars.push(c); return }

      // State machine
      c.stateTimer--
      if (c.stateTimer <= 0) {
        if (c.state === 'at_desk' && !meeting.participants.includes(c.id)) {
          if (c.isOnline && Math.random() < 0.35) {
            const layout = DESK_LAYOUT[c.name]
            const floor = layout?.floor ?? 0
            c.tx = 30 + Math.random() * (CONF.x - 80)
            c.ty = FLOOR_Y[floor] - 2
            c.state = 'wandering'
            c.stateTimer = 80 + Math.random() * 100
          } else { c.stateTimer = 120 + Math.random() * 200 }
        } else if (c.state === 'wandering') {
          c.tx = c.deskX; c.ty = c.deskY; c.state = 'to_desk'; c.stateTimer = 150
        } else if (c.state === 'to_desk') {
          if (Math.abs(c.x - c.deskX) < 5) { c.state = 'at_desk'; c.stateTimer = 180 + Math.random() * 250 }
        }
        if (c.isOnline && c.lastAction && Math.random() < 0.12) {
          c.bubble = c.lastAction.slice(0, 55); c.bubbleTimer = 160
        }
      }

      // Check if arrived at conference door
      if (c.state === 'going_to_meeting' && Math.abs(c.x - (CONF_ENTRY.x - 10)) < 6) {
        c.state = 'in_meeting'
        const seat = CONF_SEATS[c.seatIndex] ?? CONF_SEATS[0]
        c.x = seat.x; c.y = seat.y
        c.tx = seat.x; c.ty = seat.y
        c.moving = false
      }

      // Move
      const dx = c.tx - c.x, dy = c.ty - c.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const speed = c.isOnline ? 1.3 : 0
      if (dist > 2 && speed > 0) {
        c.x += (dx / dist) * speed; c.y += (dy / dist) * speed
        c.facing = dx > 0 ? 1 : -1; c.moving = true
      } else { c.moving = false }

      if (c.moving) { c.walkTick++; if (c.walkTick % 6 === 0) c.walkFrame++ }
      else c.walkFrame = 0
      c.idleTick += 0.05
      if (!c.moving) c.y = c.ty + Math.sin(c.idleTick) * 1.5
      if (c.bubbleTimer > 0) c.bubbleTimer--

      drawCharacter(ctx, c, t)
    })

    // Draw meeting participants inside conference room
    inMeetingChars.forEach(c => {
      drawCharacter(ctx, c, t, true)
    })

    // Bubbles on top
    chars.forEach(c => drawBubble(ctx, c))

    // Announcement banner
    drawMeetingAnnouncement(ctx, meeting, t)

    // Periodic random bubble
    if (t % 300 === 0) {
      const online = chars.filter(c => c.isOnline && c.lastAction && c.state !== 'in_meeting')
      if (online.length) {
        const pick = online[Math.floor(Math.random() * online.length)]
        pick.bubble = pick.lastAction!.slice(0, 55); pick.bubbleTimer = 200
      }
    }

    ctx.restore()
    animRef.current = requestAnimationFrame(draw)
  }, [agents])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr; canvas.height = CANVAS_H * dpr
    canvas.style.width = `${CANVAS_W}px`; canvas.style.height = `${CANVAS_H}px`
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width)
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height)
    let closest: Char | null = null, closestDist = Infinity
    charsRef.current.forEach(c => {
      const d = Math.hypot(c.x - mx, c.y - my)
      if (d < closestDist) { closestDist = d; closest = c }
    })
    if (closestDist < 44 && closest) {
      const agent = agents.find(a => a.id === (closest as Char).id) ?? null
      setSelected(s => s?.id === agent?.id ? null : agent)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="w-full cursor-pointer block"
          style={{ maxWidth: CANVAS_W, display: 'block', margin: '0 auto' }}
        />

        {selected && (() => {
          const a = selected as AgentStatus
          const color = AGENT_COLORS[a.name] ?? '#6366f1'
          return (
            <div className="absolute top-3 right-3 w-60 rounded-xl p-4 backdrop-blur-sm border"
              style={{ background: 'rgba(15,23,42,0.95)', borderColor: `${color}55` }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{a.avatar_emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm leading-none">{a.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 truncate">{a.role}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${color}22`, color }}>
                  {a.isOnline ? 'Online' : 'Idle'}
                </span>
              </div>
              {a.lastAction && <p className="text-zinc-400 text-xs leading-relaxed">{a.lastAction}</p>}
              {a.minutesAgo !== null && (
                <p className="text-zinc-600 text-xs mt-2">
                  {a.minutesAgo < 1 ? 'Active just now' : `Active ${a.minutesAgo}m ago`}
                </p>
              )}
              <button onClick={() => setSelected(null)}
                className="absolute top-2 right-2 text-zinc-600 hover:text-zinc-400 text-sm">✕</button>
            </div>
          )
        })()}
      </div>

      {/* Online agent pills */}
      <div className="flex flex-wrap gap-2">
        {agents.filter(a => a.isOnline).map(a => (
          <button key={a.id}
            onClick={() => setSelected(s => s?.id === a.id ? null : a)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
            style={{
              background: selected?.id === a.id ? `${AGENT_COLORS[a.name] ?? '#6366f1'}22` : 'transparent',
              borderColor: `${AGENT_COLORS[a.name] ?? '#6366f1'}44`,
              color: AGENT_COLORS[a.name] ?? '#6366f1',
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: AGENT_COLORS[a.name] }} />
            {a.avatar_emoji} {a.name}
          </button>
        ))}
      </div>
    </div>
  )
}
