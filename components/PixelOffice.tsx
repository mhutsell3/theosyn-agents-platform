'use client'

import { useEffect, useRef, useState } from 'react'
import type { AgentStatus } from '@/lib/agents'

const COL: Record<string, string> = {
  Theo: '#6366f1', Scout: '#10b981', Nova: '#f59e0b', Quill: '#8b5cf6',
  Beacon: '#06b6d4', Flow: '#3b82f6', Piper: '#ec4899', Remi: '#ef4444',
  Sage: '#84cc16', Lumen: '#f97316', Atlas: '#64748b', Scribe: '#a78bfa',
  Forge: '#d97706', Gather: '#059669', Grant: '#7c3aed', Herald: '#e11d48',
  Missions: '#0284c7', Orion: '#9333ea', Pulse: '#f43f5e', Reach: '#14b8a6',
  Serve: '#22c55e', Shepherd: '#eab308', Steward: '#6366f1', Flock: '#a855f7',
  Welcome: '#38bdf8',
}
const DEFAULT_COL = '#6366f1'

// Isometric projection
const ISO_ANGLE = Math.PI / 6  // 30 degrees
const TILE_W = 52
const TILE_H = 28

function isoProject(x: number, z: number, originX: number, originY: number) {
  return {
    sx: originX + (x - z) * (TILE_W / 2),
    sy: originY + (x + z) * (TILE_H / 2),
  }
}

const CONF_W = 4; const CONF_D = 9
const CONF_X = 0; const CONF_Z = 0
const CONF_CX = CONF_X + CONF_W / 2; const CONF_CZ = CONF_Z + CONF_D / 2
const CONF_ENTRY_X = CONF_X + CONF_W + 0.3

const CONF_SEATS = [
  { x: CONF_CX - 0.8, z: CONF_CZ - 2 },
  { x: CONF_CX + 0.8, z: CONF_CZ - 2 },
  { x: CONF_CX - 1.4, z: CONF_CZ },
  { x: CONF_CX + 1.4, z: CONF_CZ },
  { x: CONF_CX - 0.8, z: CONF_CZ + 2 },
  { x: CONF_CX + 0.8, z: CONF_CZ + 2 },
]

function buildLayout(agents: AgentStatus[]) {
  const COLS = 5
  const map: Record<string, { col: number; row: number; x: number; z: number }> = {}
  agents.forEach((a, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = CONF_W + 1.8 + col * 2.8
    const z = 1.0 + row * 3.2
    map[a.name] = { col, row, x, z }
  })
  return map
}

type CS = 'at_desk' | 'wandering' | 'to_desk' | 'going_to_meeting' | 'in_meeting'
interface Char {
  id: string; name: string; emoji: string; online: boolean; available: boolean; lastAction: string | null
  x: number; z: number; tx: number; tz: number; deskX: number; deskZ: number
  state: CS; timer: number; seatIdx: number; moving: boolean; facing: number
  bubble: string | null; bubbleTimer: number; phase: number; pulse: number
}
interface Meeting { active: boolean; participants: string[]; timer: number; announce: string; announceTick: number }

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function glowColor(hex: string, alpha = 0.6) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function PixelOffice({ agents, onCallMeeting, onMeetingChange }: {
  agents: AgentStatus[]
  onCallMeeting?: (fn: () => void) => void
  onMeetingChange?: (active: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const charsRef = useRef<Char[]>([])
  const agentsRef = useRef(agents)
  const meetRef = useRef<Meeting>({ active: false, participants: [], timer: 0, announce: '', announceTick: 0 })
  const triggerRef = useRef(false)
  const tickRef = useRef(0)
  const originRef = useRef({ x: 0, y: 0 })
  const [selected, setSelected] = useState<AgentStatus | null>(null)
  const [announce, setAnnounce] = useState('')
  const [confOn, setConfOn] = useState(false)

  useEffect(() => { agentsRef.current = agents }, [agents])
  useEffect(() => { onCallMeeting?.(() => { triggerRef.current = true }) }, [onCallMeeting])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctxMaybe = canvas.getContext('2d')
    if (!ctxMaybe) return
    const ctx: CanvasRenderingContext2D = ctxMaybe

    const W = container.clientWidth || 1280
    const H = Math.round(W * 0.60)
    canvas.width = W; canvas.height = H
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px'

    const deskMap = buildLayout(agentsRef.current)

    // Compute scene bounds to center origin
    const allX = Object.values(deskMap).map(d => d.x)
    const allZ = Object.values(deskMap).map(d => d.z)
    const sceneMaxX = Math.max(...allX, CONF_X + CONF_W) + 2
    const sceneMaxZ = Math.max(...allZ, CONF_Z + CONF_D) + 2
    const sceneCX = sceneMaxX / 2
    const sceneCZ = sceneMaxZ / 2

    // Compute scene screen dimensions for centering
    const sceneScreenH = (sceneMaxX + sceneMaxZ) * (TILE_H / 2)
    const originX = W / 2 - (sceneCX - sceneCZ) * (TILE_W / 2)
    const originY = Math.max(35, (H - sceneScreenH) / 2)
    originRef.current = { x: originX, y: originY }

    charsRef.current = agentsRef.current.map(a => {
      const d = deskMap[a.name] ?? { x: CONF_W + 3, z: 1.5 }
      return {
        id: a.id, name: a.name, emoji: a.avatar_emoji,
        online: a.isOnline, available: a.isAvailable, lastAction: a.lastAction,
        x: d.x, z: d.z, tx: d.x, tz: d.z, deskX: d.x, deskZ: d.z,
        state: 'at_desk', timer: 60 + Math.random() * 160, seatIdx: -1,
        moving: false, facing: 0, bubble: null, bubbleTimer: 0,
        phase: Math.random() * Math.PI * 2, pulse: Math.random() * Math.PI * 2,
      }
    })

    let rafId: number

    // ── Drawing helpers ─────────────────────────────────────────────────────

    function iso(x: number, z: number) {
      return isoProject(x, z, originX, originY)
    }

    function drawFloor(x: number, z: number, w: number, d: number, fillColor: string, alpha = 1) {
      const tl = iso(x, z)
      const tr = iso(x + w, z)
      const br = iso(x + w, z + d)
      const bl = iso(x, z + d)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.moveTo(tl.sx, tl.sy)
      ctx.lineTo(tr.sx, tr.sy)
      ctx.lineTo(br.sx, br.sy)
      ctx.lineTo(bl.sx, bl.sy)
      ctx.closePath()
      ctx.fillStyle = fillColor
      ctx.fill()
      ctx.restore()
    }

    function drawBox(x: number, z: number, w: number, d: number, h: number,
      topColor: string, leftColor: string, rightColor: string, glowCol?: string) {
      // Top face
      const tl = iso(x, z)
      const tr = iso(x + w, z)
      const br = iso(x + w, z + d)
      const bl = iso(x, z + d)
      ctx.beginPath()
      ctx.moveTo(tl.sx, tl.sy - h)
      ctx.lineTo(tr.sx, tr.sy - h)
      ctx.lineTo(br.sx, br.sy - h)
      ctx.lineTo(bl.sx, bl.sy - h)
      ctx.closePath()
      ctx.fillStyle = topColor
      ctx.fill()

      // Left face (x+w side, facing right in iso)
      ctx.beginPath()
      ctx.moveTo(tr.sx, tr.sy - h)
      ctx.lineTo(br.sx, br.sy - h)
      ctx.lineTo(br.sx, br.sy)
      ctx.lineTo(tr.sx, tr.sy)
      ctx.closePath()
      ctx.fillStyle = rightColor
      ctx.fill()

      // Right face (z+d side, facing left in iso)
      ctx.beginPath()
      ctx.moveTo(br.sx, br.sy - h)
      ctx.lineTo(bl.sx, bl.sy - h)
      ctx.lineTo(bl.sx, bl.sy)
      ctx.lineTo(br.sx, br.sy)
      ctx.closePath()
      ctx.fillStyle = leftColor
      ctx.fill()

      if (glowCol) {
        ctx.save()
        ctx.shadowColor = glowCol; ctx.shadowBlur = 12
        ctx.strokeStyle = glowCol; ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(tl.sx, tl.sy - h)
        ctx.lineTo(tr.sx, tr.sy - h)
        ctx.lineTo(br.sx, br.sy - h)
        ctx.lineTo(bl.sx, bl.sy - h)
        ctx.closePath()
        ctx.stroke()
        ctx.restore()
      }
    }

    function drawIsoLine(x1: number, z1: number, x2: number, z2: number, y: number, color: string, glow = 8) {
      const a = iso(x1, z1)
      const b = iso(x2, z2)
      ctx.save()
      ctx.shadowColor = color; ctx.shadowBlur = glow
      ctx.strokeStyle = color; ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(a.sx, a.sy - y)
      ctx.lineTo(b.sx, b.sy - y)
      ctx.stroke()
      ctx.restore()
    }

    function drawCharacter(c: Char, t: number) {
      const col = COL[c.name] ?? DEFAULT_COL
      const { sx, sy } = iso(c.x, c.z)
      const bobY = c.moving ? Math.abs(Math.sin(c.phase)) * 4 : Math.sin(c.phase * 0.35) * 2
      const baseY = sy - bobY

      // Glow ring on floor
      const gAlpha = c.online ? 0.35 + Math.sin(c.pulse + t * 0.05) * 0.15 : 0.08
      ctx.save()
      ctx.globalAlpha = gAlpha
      ctx.shadowColor = col; ctx.shadowBlur = 20
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18)
      rg.addColorStop(0, glowColor(col, 0.5))
      rg.addColorStop(1, glowColor(col, 0))
      ctx.fillStyle = rg
      ctx.beginPath(); ctx.ellipse(sx, sy, 18, 9, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()

      // Body (diamond shape)
      const bh = 22; const bw = 8
      ctx.save()
      ctx.shadowColor = col; ctx.shadowBlur = c.online ? 18 : 6
      ctx.fillStyle = col
      ctx.globalAlpha = c.online ? 0.95 : 0.45
      ctx.beginPath()
      ctx.moveTo(sx, baseY - bh)
      ctx.lineTo(sx + bw, baseY - bh * 0.5)
      ctx.lineTo(sx, baseY)
      ctx.lineTo(sx - bw, baseY - bh * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Head circle
      const headY = baseY - bh - 7
      ctx.save()
      ctx.shadowColor = col; ctx.shadowBlur = c.online ? 14 : 4
      ctx.fillStyle = c.online ? col : '#1e3060'
      ctx.globalAlpha = c.online ? 1.0 : 0.5
      ctx.beginPath(); ctx.arc(sx, headY, 6, 0, Math.PI * 2); ctx.fill()
      // emoji-like inner dot
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.beginPath(); ctx.arc(sx, headY, 3, 0, Math.PI * 2); ctx.fill()
      ctx.restore()

      // Label
      const labelY = headY - 14
      const label = `${c.emoji} ${c.name}`
      ctx.save()
      ctx.font = `bold 9px ui-monospace, monospace`
      ctx.textAlign = 'center'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(2,5,14,0.88)'
      ctx.globalAlpha = c.online ? 0.95 : 0.5
      ctx.beginPath()
      ctx.roundRect(sx - tw / 2 - 5, labelY - 10, tw + 10, 13, 4)
      ctx.fill()
      ctx.strokeStyle = glowColor(col, c.online ? 0.5 : 0.15)
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.fillStyle = c.online ? col : '#3a5080'
      ctx.fillText(label, sx, labelY - 1)
      ctx.restore()

      // Speech bubble
      if (c.bubbleTimer > 0 && c.bubble) {
        const fade = Math.min(1, c.bubbleTimer / 30)
        const bText = c.bubble.slice(0, 28)
        ctx.save()
        ctx.globalAlpha = fade * 0.9
        ctx.font = '8px ui-monospace, monospace'
        ctx.textAlign = 'left'
        const bw2 = ctx.measureText(bText).width
        const bx = sx - bw2 / 2 - 5; const by = labelY - 26
        ctx.fillStyle = 'rgba(2,6,18,0.93)'
        ctx.strokeStyle = glowColor(col, 0.5)
        ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.roundRect(bx, by, bw2 + 10, 12, 3); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#aabbee'
        ctx.fillText(bText, bx + 5, by + 9)
        ctx.restore()
      }
    }

    function drawDesk(x: number, z: number, col: string, isOnline: boolean) {
      const gAlpha = isOnline ? 0.9 : 0.55
      const dw = 1.0; const dd = 0.7
      // Desk surface
      drawBox(x - dw / 2, z - dd / 2, dw, dd, 10,
        '#1a2d4a', '#0f1e30', '#111d2e', isOnline ? col : undefined)

      // Monitor
      const mx = x; const mz = z - 0.15; const mh = 20
      const { sx: msx, sy: msy } = iso(mx, mz)
      ctx.save()
      ctx.shadowColor = col; ctx.shadowBlur = isOnline ? 20 : 6
      ctx.fillStyle = col
      ctx.globalAlpha = isOnline ? gAlpha : 0.3
      ctx.fillRect(msx - 14, msy - mh - 10, 28, 18)
      // Screen glow inner
      ctx.globalAlpha = isOnline ? 0.25 : 0.05
      ctx.fillStyle = col
      ctx.fillRect(msx - 11, msy - mh - 8, 22, 14)
      ctx.restore()

      // Desk accent line (LED strip)
      const { sx: ax1, sy: ay1 } = iso(x - dw / 2, z + dd / 2)
      const { sx: ax2, sy: ay2 } = iso(x + dw / 2, z + dd / 2)
      ctx.save()
      ctx.shadowColor = col; ctx.shadowBlur = isOnline ? 12 : 4
      ctx.strokeStyle = isOnline ? col : glowColor(col, 0.35)
      ctx.lineWidth = 2
      ctx.globalAlpha = isOnline ? 0.95 : 0.5
      ctx.beginPath(); ctx.moveTo(ax1, ay1 - 10); ctx.lineTo(ax2, ay2 - 10); ctx.stroke()
      ctx.restore()
    }

    function drawConferenceRoom(t: number, meetActive: boolean) {
      const cx = CONF_CX; const cz = CONF_CZ
      const roomCol = '#4488ff'
      const activeCol = '#8866ff'
      const col = meetActive ? activeCol : roomCol
      const pulse = meetActive ? (0.6 + Math.sin(t * 0.08) * 0.4) : 0.4

      // Floor
      drawFloor(CONF_X, CONF_Z, CONF_W, CONF_D, '#080e1e', 0.98)

      // Floor grid lines
      for (let gx = CONF_X; gx <= CONF_X + CONF_W; gx++) {
        drawIsoLine(gx, CONF_Z, gx, CONF_Z + CONF_D, 0, glowColor(col, 0.08), 0)
      }
      for (let gz = CONF_Z; gz <= CONF_Z + CONF_D; gz++) {
        drawIsoLine(CONF_X, gz, CONF_X + CONF_W, gz, 0, glowColor(col, 0.08), 0)
      }

      // Walls (neon edges)
      const corners = [
        [CONF_X, CONF_Z], [CONF_X + CONF_W, CONF_Z],
        [CONF_X + CONF_W, CONF_Z + CONF_D], [CONF_X, CONF_Z + CONF_D],
      ]
      const wallH = 28
      ctx.save()
      ctx.shadowColor = col; ctx.shadowBlur = 14 * pulse
      ctx.strokeStyle = col; ctx.lineWidth = 1.5
      ctx.globalAlpha = pulse
      // Vertical edges
      corners.forEach(([wx, wz]) => {
        const { sx, sy } = iso(wx, wz)
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - wallH); ctx.stroke()
      })
      // Top rectangle
      ctx.beginPath()
      for (let i = 0; i < corners.length; i++) {
        const [wx, wz] = corners[i]
        const { sx, sy } = iso(wx, wz)
        if (i === 0) ctx.moveTo(sx, sy - wallH)
        else ctx.lineTo(sx, sy - wallH)
      }
      ctx.closePath(); ctx.stroke()
      // Bottom rectangle
      ctx.beginPath()
      for (let i = 0; i < corners.length; i++) {
        const [wx, wz] = corners[i]
        const { sx, sy } = iso(wx, wz)
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.closePath(); ctx.stroke()
      ctx.restore()

      // Central table
      const tw = 1.8; const td = 3.5
      drawBox(cx - tw / 2, cz - td / 2, tw, td, 8, '#1a2e50', '#0e1c34', '#0f1d38', col)

      // Table glow ring (animated when active)
      const { sx: tSx, sy: tSy } = iso(cx, cz)
      const ringSize = 30 + (meetActive ? Math.sin(t * 0.1) * 5 : 0)
      ctx.save()
      ctx.globalAlpha = pulse * 0.5
      ctx.shadowColor = col; ctx.shadowBlur = 24
      ctx.strokeStyle = col; ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(tSx, tSy - 8, ringSize * 1.1, ringSize * 0.55, 0, 0, Math.PI * 2)
      ctx.stroke()
      if (meetActive) {
        ctx.globalAlpha = pulse * 0.25
        ctx.beginPath()
        ctx.ellipse(tSx, tSy - 8, ringSize * 1.5, ringSize * 0.75, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()

      // CONFERENCE label
      const labelPos = iso(CONF_X + CONF_W / 2, CONF_Z - 0.3)
      ctx.save()
      ctx.font = 'bold 10px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = meetActive ? activeCol : '#2a4a88'
      ctx.shadowColor = col; ctx.shadowBlur = meetActive ? 16 : 4
      ctx.globalAlpha = meetActive ? 0.95 : 0.6
      ctx.fillText(meetActive ? '● MEETING' : '○ CONF ROOM', labelPos.sx, labelPos.sy - 35)
      ctx.restore()
    }

    function drawOfficeFloor() {
      const deskMap2 = buildLayout(agentsRef.current)
      const allX2 = Object.values(deskMap2).map(d => d.x)
      const allZ2 = Object.values(deskMap2).map(d => d.z)
      const fx1 = Math.min(...allX2) - 1.5
      const fx2 = Math.max(...allX2) + 2
      const fz1 = Math.min(...allZ2) - 1.5
      const fz2 = Math.max(...allZ2) + 2

      // Floor base
      drawFloor(fx1, fz1, fx2 - fx1, fz2 - fz1, '#070c18', 0.95)

      // Grid
      const gridCol = 'rgba(15,35,70,0.6)'
      for (let gx = Math.floor(fx1); gx <= Math.ceil(fx2); gx++) {
        drawIsoLine(gx, fz1, gx, fz2, 0, gridCol, 0)
      }
      for (let gz = Math.floor(fz1); gz <= Math.ceil(fz2); gz++) {
        drawIsoLine(fx1, gz, fx2, gz, 0, gridCol, 0)
      }

      // Row accent strips
      const maxRow = Math.max(...Object.values(deskMap2).map(d => d.row))
      for (let r = 0; r <= maxRow; r++) {
        const rz = 1.5 + r * 3.5
        drawFloor(fx1 + 1, rz - 0.6, fx2 - fx1 - 2, 1.2, 'rgba(12,25,50,0.7)', 0.7)
      }
    }

    function tick() {
      rafId = requestAnimationFrame(tick)
      const t = ++tickRef.current
      const chars = charsRef.current
      const meet = meetRef.current
      const deskMap2 = buildLayout(agentsRef.current)

      // Sync agent status
      const cur = agentsRef.current
      chars.forEach(c => {
        const a = cur.find(x => x.id === c.id)
        if (a) { c.online = a.isOnline; c.available = a.isAvailable; c.lastAction = a.lastAction }
        c.pulse += 0.03
      })

      // Meeting trigger
      const manual = triggerRef.current; if (manual) triggerRef.current = false
      if (!meet.active && (manual || t % 1400 === 0)) {
        const theo = chars.find(c => c.name === 'Theo' && (c.online || manual)) ?? chars.find(c => c.online) ?? chars[0]
        if (theo) {
          const avail = chars.filter(c => c.id !== theo.id && c.available && c.state === 'at_desk')
          const cnt = Math.min(1 + Math.floor(Math.random() * 4), avail.length)
          const invited = avail.sort(() => Math.random() - 0.5).slice(0, cnt)
          const all = [theo, ...invited]
          meet.active = true; meet.participants = all.map(c => c.id)
          meet.timer = 600 + Math.floor(Math.random() * 400)
          meet.announce = `📢 ${theo.name} → ${invited.length ? invited.map(c => c.name).join(', ') : 'solo'}`
          meet.announceTick = 240
          setAnnounce(meet.announce); setConfOn(true); onMeetingChange?.(true)
          all.forEach((c, i) => {
            c.state = 'going_to_meeting'; c.seatIdx = i % CONF_SEATS.length
            c.tx = CONF_ENTRY_X; c.tz = c.deskZ; c.timer = 999
            c.bubble = '📅 Meeting!'; c.bubbleTimer = 120
          })
        }
      }

      if (meet.active) {
        meet.timer--
        if (meet.announceTick > 0 && --meet.announceTick === 0) { meet.announce = ''; setAnnounce('') }
        if (meet.timer <= 0) {
          meet.participants.forEach(id => {
            const c = chars.find(x => x.id === id)
            if (c) { c.state = 'to_desk'; c.tx = c.deskX; c.tz = c.deskZ; c.timer = 500; c.bubble = '✅ Done!'; c.bubbleTimer = 90 }
          })
          meet.active = false; meet.participants = []
          setConfOn(false); onMeetingChange?.(false)
        }
      }

      // Character AI
      chars.forEach(c => {
        if (c.state === 'in_meeting') {
          c.phase += 0.025
          const seat = CONF_SEATS[c.seatIdx] ?? CONF_SEATS[0]
          c.x = seat.x; c.z = seat.z + Math.sin(c.phase) * 0.01
        } else {
          c.timer--
          if (c.timer <= 0) {
            const d = deskMap2[c.name]
            if (c.state === 'at_desk' && !meet.participants.includes(c.id)) {
              if (c.online && Math.random() < 0.28) {
                const rz = (d?.z ?? 1.5)
                c.tx = (d?.x ?? CONF_W + 3) + (Math.random() - 0.5) * 2.5
                c.tz = rz + (Math.random() - 0.5) * 1.0
                c.state = 'wandering'; c.timer = 90 + Math.random() * 120
              } else { c.timer = 150 + Math.random() * 200 }
            } else if (c.state === 'wandering') {
              c.tx = c.deskX; c.tz = c.deskZ; c.state = 'to_desk'; c.timer = 500
            } else if (c.state === 'to_desk') { c.timer = 500 }
            if (c.online && c.lastAction && Math.random() < 0.07) {
              c.bubble = c.lastAction.slice(0, 40); c.bubbleTimer = 180
            }
          }
          if (c.state === 'to_desk' && Math.abs(c.x - c.deskX) < 0.08 && Math.abs(c.z - c.deskZ) < 0.08) {
            c.state = 'at_desk'; c.timer = 150 + Math.random() * 200; c.x = c.deskX; c.z = c.deskZ
          }
          if (c.state === 'going_to_meeting' && Math.abs(c.x - CONF_ENTRY_X) < 0.12) {
            const seat = CONF_SEATS[c.seatIdx] ?? CONF_SEATS[0]
            c.state = 'in_meeting'; c.x = seat.x; c.z = seat.z; c.tx = seat.x; c.tz = seat.z
          }
          const dx = c.tx - c.x; const dz = c.tz - c.z
          const dist = Math.sqrt(dx * dx + dz * dz)
          const spd = (c.online || c.state === 'going_to_meeting' || c.state === 'to_desk') ? 0.04 : 0
          if (dist > 0.04 && spd > 0) {
            c.x += dx / dist * spd; c.z += dz / dist * spd
            c.facing = Math.atan2(dx, dz); c.moving = true; c.phase += 0.14
          } else {
            c.moving = false
            if (c.online) c.phase += 0.03
          }
        }
        if (c.bubbleTimer > 0) c.bubbleTimer--
      })

      // ── RENDER ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H)

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#040b18')
      bg.addColorStop(1, '#020810')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Sort render order: back-to-front (isometric painter's algorithm)
      // Render by z+x descending (objects with higher z+x closer to viewer)

      // 1. Draw floors first
      drawOfficeFloor()
      drawConferenceRoom(t, meet.active)

      // 2. Draw desks (back to front: sort by x+z descending)
      const deskEntries = agentsRef.current.map(a => {
        const d = deskMap2[a.name]
        return d ? { a, d } : null
      }).filter(Boolean) as { a: AgentStatus; d: { x: number; z: number } }[]

      deskEntries.sort((a, b) => (a.d.x + a.d.z) - (b.d.x + b.d.z))
      deskEntries.forEach(({ a, d }) => {
        drawDesk(d.x, d.z, COL[a.name] ?? DEFAULT_COL, a.isOnline)
      })

      // 3. Draw characters (back to front)
      const sortedChars = [...chars].sort((a, b) => (a.x + a.z) - (b.x + b.z))
      sortedChars.forEach(c => drawCharacter(c, t))

      // 4. Scanline overlay for CRT effect
      ctx.save()
      ctx.globalAlpha = 0.025
      for (let y = 0; y < H; y += 3) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, y, W, 1)
      }
      ctx.restore()
    }
    tick()

    return () => { cancelAnimationFrame(rafId) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-0" ref={containerRef}>
      {announce && (
        <div className="flex justify-center mb-3">
          <div className="px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 28px rgba(99,102,241,0.55)' }}>
            {announce}
          </div>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden border border-zinc-800/50 w-full"
        style={{ boxShadow: '0 0 80px rgba(10,20,60,0.9), inset 0 0 0 1px rgba(60,80,160,0.1)' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />

        <div className="absolute top-3 right-3 pointer-events-none">
          <div className="px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider" style={{
            background: confOn ? 'rgba(99,102,241,0.2)' : 'rgba(8,14,28,0.88)',
            border: `1px solid ${confOn ? 'rgba(99,102,241,0.6)' : 'rgba(30,50,90,0.5)'}`,
            color: confOn ? '#a5b4fc' : '#233058',
            boxShadow: confOn ? '0 0 18px rgba(99,102,241,0.35)' : 'none',
          }}>
            {confOn ? '● MEETING ACTIVE' : '○ CONFERENCE'}
          </div>
        </div>

        {selected && (() => {
          const a = selected; const col = COL[a.name] ?? '#6366f1'
          return (
            <div className="absolute bottom-3 left-3 rounded-2xl p-4 w-56" style={{
              background: 'rgba(5,9,20,0.97)', border: `1px solid ${col}44`,
              backdropFilter: 'blur(20px)', boxShadow: `0 0 30px ${col}20, 0 8px 40px rgba(0,0,0,0.7)`, zIndex: 30,
            }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: `radial-gradient(135deg at 30% 30%, ${col}cc, ${col}44)`, border: `2px solid ${col}`, boxShadow: `0 0 14px ${col}55` }}>
                  {a.avatar_emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold text-sm leading-none">{a.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 truncate">{a.role}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${col}22`, color: col }}>
                  {a.isOnline ? 'Online' : a.isAvailable ? 'Recent' : 'Idle'}
                </span>
              </div>
              {a.lastAction && <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">{a.lastAction}</p>}
              {a.minutesAgo !== null && <p className="text-zinc-700 text-xs mt-2">{a.minutesAgo < 1 ? 'Active just now' : `${a.minutesAgo}m ago`}</p>}
              <button onClick={() => setSelected(null)} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-all text-xs">✕</button>
            </div>
          )
        })()}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {agents.map(a => {
          const col = COL[a.name] ?? '#6366f1'
          return (
            <button key={a.id} onClick={() => setSelected(s => s?.id === a.id ? null : a)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                background: selected?.id === a.id ? `${col}1a` : 'rgba(6,10,20,0.9)',
                borderColor: `${col}${a.isOnline ? '55' : '18'}`,
                color: a.isOnline ? col : '#1e2e50',
                boxShadow: a.isOnline && selected?.id === a.id ? `0 0 10px ${col}33` : 'none',
              }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: a.isOnline ? col : '#0f1e38', boxShadow: a.isOnline ? `0 0 5px ${col}` : 'none' }} />
              {a.avatar_emoji} {a.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
