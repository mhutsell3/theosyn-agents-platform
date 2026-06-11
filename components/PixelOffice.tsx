'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { AgentStatus } from '@/lib/agents'

const AGENT_COLORS: Record<string, string> = {
  Theo: '#6366f1', Scout: '#10b981', Nova: '#f59e0b',
  Quill: '#8b5cf6', Beacon: '#06b6d4', Flow: '#3b82f6',
  Piper: '#ec4899', Remi: '#ef4444', Sage: '#84cc16',
  Lumen: '#f97316', Atlas: '#64748b', Scribe: '#a78bfa',
}

// Desk positions [x, y] — y is the floor they walk on
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

const FLOOR_Y = [140, 290, 440]
const CANVAS_W = 680
const CANVAS_H = 500
const FLOOR_H = 12

interface Char {
  id: string
  name: string
  emoji: string
  color: string
  isOnline: boolean
  lastAction: string | null
  // position
  x: number
  y: number
  // target
  tx: number
  ty: number
  // walk animation
  walkFrame: number
  walkTick: number
  facing: 1 | -1
  moving: boolean
  // idle animation
  idleTick: number
  // state machine
  state: 'at_desk' | 'wandering' | 'to_desk'
  deskX: number
  deskY: number
  stateTimer: number
  // bubble
  bubble: string | null
  bubbleTimer: number
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function drawCharacter(ctx: CanvasRenderingContext2D, c: Char, t: number) {
  const { x, y, color, isOnline, walkFrame, facing, moving } = c
  const rgb = hexToRgb(color)
  const alpha = isOnline ? 1 : 0.35

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.scale(facing, 1)

  // Shadow
  ctx.fillStyle = `rgba(0,0,0,0.25)`
  ctx.beginPath()
  ctx.ellipse(0, 2, 10, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Leg animation frames
  const legAngle = moving ? Math.sin(walkFrame * 0.6) * 0.5 : 0
  const legLen = 14

  // Left leg
  ctx.save()
  ctx.strokeStyle = `rgb(${Math.max(0,rgb.r-40)},${Math.max(0,rgb.g-40)},${Math.max(0,rgb.b-40)})`
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-4, 6)
  ctx.lineTo(-4 + Math.sin(-legAngle) * legLen, 6 + Math.cos(-legAngle) * legLen)
  ctx.stroke()
  ctx.restore()

  // Right leg
  ctx.save()
  ctx.strokeStyle = `rgb(${Math.max(0,rgb.r-40)},${Math.max(0,rgb.g-40)},${Math.max(0,rgb.b-40)})`
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(4, 6)
  ctx.lineTo(4 + Math.sin(legAngle) * legLen, 6 + Math.cos(legAngle) * legLen)
  ctx.stroke()
  ctx.restore()

  // Body
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(-9, -14, 18, 22, 4)
  ctx.fill()

  // Shirt detail
  ctx.fillStyle = `rgba(255,255,255,0.15)`
  ctx.beginPath()
  ctx.roundRect(-5, -12, 10, 10, 2)
  ctx.fill()

  // Arms
  const armSwing = moving ? Math.sin(walkFrame * 0.6 + Math.PI) * 0.4 : 0
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  // Left arm
  ctx.beginPath()
  ctx.moveTo(-9, -8)
  ctx.lineTo(-9 + Math.sin(-armSwing) * 10, -8 + Math.cos(-armSwing) * 8)
  ctx.stroke()
  // Right arm
  ctx.beginPath()
  ctx.moveTo(9, -8)
  ctx.lineTo(9 + Math.sin(armSwing) * 10, -8 + Math.cos(armSwing) * 8)
  ctx.stroke()
  ctx.restore()

  // Neck
  ctx.fillStyle = '#fde68a'
  ctx.fillRect(-3, -20, 6, 8)

  // Head
  ctx.fillStyle = '#fde68a'
  ctx.beginPath()
  ctx.arc(0, -28, 12, 0, Math.PI * 2)
  ctx.fill()

  // Hair / hat
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, -28, 12, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(-12, -30, 24, 6)

  // Eyes
  const blink = t % 180 < 4
  if (!blink) {
    ctx.fillStyle = '#1e293b'
    ctx.beginPath(); ctx.arc(-5, -27, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(5, -27, 2, 0, Math.PI * 2); ctx.fill()
    // Pupils
    ctx.fillStyle = 'white'
    ctx.beginPath(); ctx.arc(-4, -28, 0.8, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(6, -28, 0.8, 0, Math.PI * 2); ctx.fill()
  } else {
    // Blink — thin lines
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(-7, -27); ctx.lineTo(-3, -27); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(3, -27); ctx.lineTo(7, -27); ctx.stroke()
  }

  // Smile
  ctx.strokeStyle = '#92400e'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, -24, 4, 0.2, Math.PI - 0.2)
  ctx.stroke()

  // Online dot
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = alpha
  if (isOnline) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 0.08)
    ctx.fillStyle = `rgba(16,185,129,${pulse})`
    ctx.beginPath()
    ctx.arc(x + 10, y - 40, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#10b981'
    ctx.beginPath()
    ctx.arc(x + 10, y - 40, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // Emoji above head
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `${isOnline ? 16 : 14}px serif`
  ctx.textAlign = 'center'
  ctx.fillText(c.emoji, x, y - 46)
  ctx.restore()
}

function drawDesk(ctx: CanvasRenderingContext2D, dx: number, floorY: number, color: string, isOnline: boolean, t: number) {
  const dw = 70, dh = 18

  // Desk surface
  ctx.fillStyle = '#1e3a5f'
  ctx.beginPath()
  ctx.roundRect(dx - dw / 2, floorY - dh - 18, dw, dh, 3)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = isOnline ? 1.5 : 0.5
  ctx.stroke()

  // Monitor
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(dx - 14, floorY - dh - 18 - 24, 28, 20)
  ctx.fillStyle = isOnline ? color : '#1f2937'
  ctx.fillRect(dx - 12, floorY - dh - 18 - 22, 24, 16)

  // Screen glow / content
  if (isOnline) {
    const glow = 0.2 + 0.15 * Math.sin(t * 0.04)
    ctx.fillStyle = `rgba(255,255,255,${glow})`
    ctx.fillRect(dx - 12, floorY - dh - 18 - 22, 24, 16)
    // Fake text lines on screen
    ctx.fillStyle = `rgba(255,255,255,0.6)`
    for (let i = 0; i < 3; i++) {
      const w = 8 + Math.floor(((dx + i * 37) % 10))
      ctx.fillRect(dx - 10, floorY - dh - 18 - 20 + i * 4, w, 1.5)
    }
  }

  // Monitor stand
  ctx.fillStyle = '#334155'
  ctx.fillRect(dx - 3, floorY - dh - 18 - 4, 6, 6)
  ctx.fillRect(dx - 8, floorY - dh - 18 - 2, 16, 3)

  // Chair
  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.arc(dx, floorY - 4, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#334155'
  ctx.beginPath()
  ctx.arc(dx, floorY - 4, 10, 0, Math.PI * 2)
  ctx.fill()
}

function drawOffice(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(1, '#1e293b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Wall windows top
  for (let i = 0; i < 5; i++) {
    const wx = 30 + i * 130
    const shimmer = 0.06 + 0.02 * Math.sin(t * 0.02 + i)
    ctx.fillStyle = `rgba(99,102,241,${shimmer})`
    ctx.beginPath()
    ctx.roundRect(wx, 8, 80, 50, 6)
    ctx.fill()
    ctx.strokeStyle = 'rgba(99,102,241,0.25)'
    ctx.lineWidth = 1
    ctx.stroke()
    // Window cross
    ctx.strokeStyle = 'rgba(99,102,241,0.2)'
    ctx.beginPath(); ctx.moveTo(wx + 40, 8); ctx.lineTo(wx + 40, 58); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(wx, 33); ctx.lineTo(wx + 80, 33); ctx.stroke()
  }

  // Floors / platforms
  FLOOR_Y.forEach((fy, i) => {
    // Floor surface
    const fg = ctx.createLinearGradient(0, fy, 0, fy + FLOOR_H)
    fg.addColorStop(0, '#334155')
    fg.addColorStop(1, '#1e293b')
    ctx.fillStyle = fg
    ctx.fillRect(0, fy, w, FLOOR_H)

    // Floor edge highlight
    ctx.fillStyle = 'rgba(148,163,184,0.15)'
    ctx.fillRect(0, fy, w, 2)

    // Floor tiles
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x, fy + FLOOR_H); ctx.stroke()
    }

    // Floor label
    ctx.fillStyle = 'rgba(148,163,184,0.2)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`Floor ${i + 1}`, w - 6, fy + 10)
  })

  // Plants in corners
  const plantSpots = [[20, FLOOR_Y[0]], [CANVAS_W - 30, FLOOR_Y[0]], [20, FLOOR_Y[1]], [CANVAS_W - 30, FLOOR_Y[2]]]
  plantSpots.forEach(([px, py]) => {
    // Pot
    ctx.fillStyle = '#92400e'
    ctx.beginPath()
    ctx.roundRect(px - 8, py - 20, 16, 14, 2)
    ctx.fill()
    // Plant
    ctx.fillStyle = '#166534'
    ctx.beginPath()
    ctx.arc(px, py - 24, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#15803d'
    ctx.beginPath()
    ctx.arc(px - 6, py - 28, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(px + 6, py - 27, 7, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawBubble(ctx: CanvasRenderingContext2D, c: Char) {
  if (!c.bubble || c.bubbleTimer <= 0) return
  const bw = 160, bh = 44
  const bx = Math.max(4, Math.min(c.x - bw / 2, CANVAS_W - bw - 4))
  const by = c.y - 95

  ctx.fillStyle = 'rgba(15,23,42,0.97)'
  ctx.strokeStyle = c.color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 8)
  ctx.fill()
  ctx.stroke()

  // Tail
  ctx.fillStyle = 'rgba(15,23,42,0.97)'
  ctx.beginPath()
  ctx.moveTo(c.x - 5, by + bh)
  ctx.lineTo(c.x, by + bh + 8)
  ctx.lineTo(c.x + 5, by + bh)
  ctx.fill()

  ctx.fillStyle = '#f1f5f9'
  ctx.font = 'bold 9px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(c.name, bx + 8, by + 14)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '8px system-ui, sans-serif'
  const words = c.bubble.split(' ')
  let line1 = '', line2 = ''
  words.forEach(w => {
    if ((line1 + ' ' + w).length < 22) line1 += (line1 ? ' ' : '') + w
    else line2 += (line2 ? ' ' : '') + w
  })
  ctx.fillText(line1, bx + 8, by + 27)
  if (line2) ctx.fillText(line2.slice(0, 28), bx + 8, by + 38)
}

export default function PixelOffice({ agents }: { agents: AgentStatus[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const charsRef = useRef<Char[]>([])
  const animRef = useRef(0)
  const tickRef = useRef(0)
  const [selected, setSelected] = useState<AgentStatus | null>(null)

  // Init characters
  useEffect(() => {
    if (charsRef.current.length > 0) return
    charsRef.current = agents.map(a => {
      const layout = DESK_LAYOUT[a.name]
      const floor = layout?.floor ?? 0
      const dx = layout?.dx ?? 300
      const dy = FLOOR_Y[floor] - 2
      return {
        id: a.id, name: a.name, emoji: a.avatar_emoji,
        color: AGENT_COLORS[a.name] ?? '#6366f1',
        isOnline: a.isOnline, lastAction: a.lastAction,
        x: dx, y: dy, tx: dx, ty: dy,
        walkFrame: 0, walkTick: 0, facing: 1, moving: false,
        idleTick: Math.random() * 200,
        state: 'at_desk', deskX: dx, deskY: dy,
        stateTimer: 100 + Math.random() * 200,
        bubble: null, bubbleTimer: 0,
      } as Char
    })
  }, [agents])

  // Sync online status
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

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    drawOffice(ctx, CANVAS_W, CANVAS_H, t)

    // Draw desks (behind characters)
    agents.forEach(a => {
      const layout = DESK_LAYOUT[a.name]
      if (!layout) return
      drawDesk(ctx, layout.dx, FLOOR_Y[layout.floor], AGENT_COLORS[a.name] ?? '#6366f1', a.isOnline, t)
    })

    // Update + draw characters
    charsRef.current.forEach(c => {
      // State machine
      c.stateTimer--
      if (c.stateTimer <= 0) {
        if (c.state === 'at_desk') {
          if (c.isOnline && Math.random() < 0.4) {
            // Wander to nearby spot on same floor
            const layout = DESK_LAYOUT[c.name]
            const floor = layout?.floor ?? 0
            const wanderX = 30 + Math.random() * (CANVAS_W - 60)
            c.tx = wanderX
            c.ty = FLOOR_Y[floor] - 2
            c.state = 'wandering'
            c.stateTimer = 80 + Math.random() * 120
          } else {
            c.stateTimer = 120 + Math.random() * 200
          }
        } else if (c.state === 'wandering') {
          // Go back to desk
          c.tx = c.deskX
          c.ty = c.deskY
          c.state = 'to_desk'
          c.stateTimer = 150
        } else if (c.state === 'to_desk') {
          if (Math.abs(c.x - c.deskX) < 4) {
            c.state = 'at_desk'
            c.stateTimer = 200 + Math.random() * 300
          }
        }

        // Bubble
        if (c.isOnline && c.lastAction && Math.random() < 0.15) {
          c.bubble = c.lastAction.slice(0, 60)
          c.bubbleTimer = 180
        }
      }

      // Move toward target
      const dx = c.tx - c.x
      const dy = c.ty - c.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const speed = c.isOnline ? 1.2 : 0
      if (dist > 2 && speed > 0) {
        c.x += (dx / dist) * speed
        c.y += (dy / dist) * speed
        c.facing = dx > 0 ? 1 : -1
        c.moving = true
      } else {
        c.moving = false
      }

      // Walk frame
      if (c.moving) {
        c.walkTick++
        if (c.walkTick % 6 === 0) c.walkFrame++
      } else {
        c.walkFrame = 0
      }

      // Idle bob
      c.idleTick += 0.05
      if (!c.moving) c.y = c.ty + Math.sin(c.idleTick) * 1.5

      // Bubble timer
      if (c.bubbleTimer > 0) c.bubbleTimer--

      drawCharacter(ctx, c, t)
    })

    // Draw bubbles on top
    charsRef.current.forEach(c => drawBubble(ctx, c))

    // Trigger random bubble every ~5s
    if (t % 300 === 0) {
      const online = charsRef.current.filter(c => c.isOnline && c.lastAction)
      if (online.length) {
        const pick = online[Math.floor(Math.random() * online.length)]
        pick.bubble = pick.lastAction!.slice(0, 55)
        pick.bubbleTimer = 200
      }
    }

    ctx.restore()
    animRef.current = requestAnimationFrame(draw)
  }, [agents])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr
    canvas.style.width = `${CANVAS_W}px`
    canvas.style.height = `${CANVAS_H}px`
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY

    let closest: Char | null = null
    let closestDist = Infinity
    charsRef.current.forEach(c => {
      const d = Math.hypot(c.x - mx, c.y - my)
      if (d < closestDist) { closestDist = d; closest = c }
    })
    if (closestDist < 40 && closest) {
      const agent = agents.find(a => a.id === (closest as Char).id) ?? null
      setSelected(s => s?.id === agent?.id ? null : agent)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-800" style={{ background: '#0f172a' }}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="w-full cursor-pointer block"
          style={{ maxWidth: CANVAS_W, display: 'block', margin: '0 auto' }}
        />

        {/* Selected agent panel */}
        {selected && (() => {
          const a = selected as AgentStatus
          const color = AGENT_COLORS[a.name] ?? '#6366f1'
          return (
            <div
              className="absolute top-3 right-3 w-60 rounded-xl p-4 backdrop-blur-sm border"
              style={{ background: 'rgba(15,23,42,0.95)', borderColor: `${color}55` }}
            >
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
                className="absolute top-2 right-2 text-zinc-600 hover:text-zinc-400 text-sm leading-none">✕</button>
            </div>
          )
        })()}
      </div>

      {/* Mini legend */}
      <div className="flex flex-wrap gap-2">
        {agents.filter(a => a.isOnline).map(a => (
          <button
            key={a.id}
            onClick={() => setSelected(s => s?.id === a.id ? null : a)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
            style={{
              background: selected?.id === a.id ? `${AGENT_COLORS[a.name] ?? '#6366f1'}22` : 'transparent',
              borderColor: `${AGENT_COLORS[a.name] ?? '#6366f1'}44`,
              color: AGENT_COLORS[a.name] ?? '#6366f1',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: AGENT_COLORS[a.name] ?? '#6366f1' }} />
            {a.avatar_emoji} {a.name}
          </button>
        ))}
      </div>
    </div>
  )
}
