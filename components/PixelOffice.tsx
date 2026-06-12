'use client'

import { useEffect, useRef, useState } from 'react'
import type { AgentStatus } from '@/lib/agents'

// ── Colors ─────────────────────────────────────────────────────
const COL: Record<string, { num: number; hex: string }> = {
  Theo:   { num: 0x6366f1, hex: '#6366f1' }, Scout:  { num: 0x10b981, hex: '#10b981' },
  Nova:   { num: 0xf59e0b, hex: '#f59e0b' }, Quill:  { num: 0x8b5cf6, hex: '#8b5cf6' },
  Beacon: { num: 0x06b6d4, hex: '#06b6d4' }, Flow:   { num: 0x3b82f6, hex: '#3b82f6' },
  Piper:  { num: 0xec4899, hex: '#ec4899' }, Remi:   { num: 0xef4444, hex: '#ef4444' },
  Sage:   { num: 0x84cc16, hex: '#84cc16' }, Lumen:  { num: 0xf97316, hex: '#f97316' },
  Atlas:  { num: 0x64748b, hex: '#64748b' }, Scribe: { num: 0xa78bfa, hex: '#a78bfa' },
}

// ── World layout ────────────────────────────────────────────────
const COL_X = [1.5, 4.5, 7.5, 10.5, 13.5]
const ROW_Z = [1.5, 5.5, 9.5]
const DESK_LAYOUT: Record<string, { col: number; row: number }> = {
  Theo:   { col: 0, row: 0 }, Scout:  { col: 1, row: 0 }, Nova:   { col: 2, row: 0 },
  Quill:  { col: 3, row: 0 }, Lumen:  { col: 4, row: 0 },
  Beacon: { col: 0, row: 1 }, Flow:   { col: 1, row: 1 }, Piper:  { col: 2, row: 1 },
  Remi:   { col: 3, row: 1 }, Sage:   { col: 4, row: 1 },
  Atlas:  { col: 0, row: 2 }, Scribe: { col: 1, row: 2 },
}
const CONF_X = 17.2; const CONF_Z = 0.5; const CONF_W = 6.0; const CONF_D = 11.0
const CONF_CX = CONF_X + CONF_W / 2; const CONF_CZ = CONF_Z + CONF_D / 2
const CONF_ENTRY_X = CONF_X - 0.2
const CONF_SEATS = [
  { x: CONF_CX, z: CONF_Z + 1.5 },
  { x: CONF_CX + 1.6, z: CONF_CZ - 1.5 },
  { x: CONF_CX + 1.6, z: CONF_CZ + 1.5 },
  { x: CONF_CX, z: CONF_Z + CONF_D - 1.5 },
  { x: CONF_CX - 1.6, z: CONF_CZ + 1.5 },
  { x: CONF_CX - 1.6, z: CONF_CZ - 1.5 },
]

type CS = 'at_desk' | 'wandering' | 'to_desk' | 'going_to_meeting' | 'in_meeting'
interface Char {
  id: string; name: string; emoji: string; online: boolean; available: boolean; lastAction: string | null
  x: number; z: number; tx: number; tz: number; deskX: number; deskZ: number
  state: CS; timer: number; seatIdx: number; moving: boolean; facing: number
  bubble: string | null; bubbleTimer: number; phase: number
}
interface Meeting { active: boolean; participants: string[]; timer: number; announce: string; announceTick: number }

// ── Component ──────────────────────────────────────────────────
export default function PixelOffice({ agents, onCallMeeting, onMeetingChange }: {
  agents: AgentStatus[]
  onCallMeeting?: (fn: () => void) => void
  onMeetingChange?: (active: boolean) => void
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const charsRef = useRef<Char[]>([])
  const agentsRef = useRef(agents)
  const meetRef = useRef<Meeting>({ active: false, participants: [], timer: 0, announce: '', announceTick: 0 })
  const triggerRef = useRef(false)
  const tickRef = useRef(0)
  const [selected, setSelected] = useState<AgentStatus | null>(null)
  const [announce, setAnnounce] = useState('')
  const [confOn, setConfOn] = useState(false)

  // Keep agents ref in sync
  useEffect(() => { agentsRef.current = agents }, [agents])

  useEffect(() => {
    onCallMeeting?.(() => { triggerRef.current = true })
  }, [onCallMeeting])

  // Main Three.js effect (runs once)
  useEffect(() => {
    if (!mountRef.current) return
    const W = 810, H = 480

    // Init chars from agents at mount time
    const initAgents = agentsRef.current
    charsRef.current = initAgents.map(a => {
      const L = DESK_LAYOUT[a.name]
      const px = L ? COL_X[L.col] : 3
      const pz = L ? ROW_Z[L.row] : 3
      return {
        id: a.id, name: a.name, emoji: a.avatar_emoji,
        online: a.isOnline, available: a.isAvailable, lastAction: a.lastAction,
        x: px, z: pz, tx: px, tz: pz, deskX: px, deskZ: pz,
        state: 'at_desk', timer: 100 + Math.random() * 200, seatIdx: -1,
        moving: false, facing: 0, bubble: null, bubbleTimer: 0,
        phase: Math.random() * Math.PI * 2,
      }
    })

    let THREE: any, renderer: any, scene: any, camera: any
    let rafId: number
    const charMeshes = new Map<string, { grp: any; body: any; head: any; lite: any; lbl: HTMLDivElement }>()
    let confLight: any, ringMesh: any

    const init = async () => {
      THREE = await import('three')

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.1
      renderer.setClearColor(0x070c18)
      mountRef.current!.appendChild(renderer.domElement)

      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x070c18, 0.018)

      // Isometric orthographic camera
      const asp = W / H
      const fH = 9.5
      camera = new THREE.OrthographicCamera(-fH * asp, fH * asp, fH, -fH, 0.1, 200)
      camera.position.set(24, 18, 24)
      camera.lookAt(10, 0, 5.5)

      // ── Lighting ─────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x1a2550, 2))
      const sun = new THREE.DirectionalLight(0xfff0d0, 2.2)
      sun.position.set(12, 22, 8); sun.castShadow = true
      sun.shadow.mapSize.set(2048, 2048)
      sun.shadow.camera.left = -28; sun.shadow.camera.right = 28
      sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22
      sun.shadow.bias = -0.001
      scene.add(sun)
      const fill = new THREE.DirectionalLight(0x3050c0, 0.6)
      fill.position.set(-8, 8, -8); scene.add(fill)

      // ── Floor ─────────────────────────────────────────────────
      const floorGeo = new THREE.PlaneGeometry(32, 22)
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.85, metalness: 0.05 })
      const floor = new THREE.Mesh(floorGeo, floorMat)
      floor.rotation.x = -Math.PI / 2; floor.position.set(11, 0, 6); floor.receiveShadow = true
      scene.add(floor)

      // Floor grid
      const grid = new THREE.GridHelper(32, 32, 0x111f3a, 0x0d1728)
      grid.position.set(11, 0.005, 6); scene.add(grid)

      // Row aisle strips
      ROW_Z.forEach(rz => {
        const stripGeo = new THREE.PlaneGeometry(16, 0.6)
        const stripMat = new THREE.MeshStandardMaterial({ color: 0x0e1a2e, roughness: 0.9 })
        const strip = new THREE.Mesh(stripGeo, stripMat)
        strip.rotation.x = -Math.PI / 2; strip.position.set(8, 0.006, rz + 1.5)
        scene.add(strip)
      })

      // ── Desks & chairs ────────────────────────────────────────
      initAgents.forEach(a => {
        const L = DESK_LAYOUT[a.name]; if (!L) return
        const dx = COL_X[L.col], dz = ROW_Z[L.row]
        const c = COL[a.name] ?? COL.Theo

        // Desk surface
        const dsk = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.07, 0.95),
          new THREE.MeshStandardMaterial({ color: 0x1a2a40, roughness: 0.65, metalness: 0.25 })
        )
        dsk.position.set(dx, 0.235, dz); dsk.castShadow = true; dsk.receiveShadow = true
        scene.add(dsk)

        // Accent strip (front edge)
        const acc = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.03, 0.04),
          new THREE.MeshStandardMaterial({ color: c.num, emissive: c.num, emissiveIntensity: a.isOnline ? 1.2 : 0.08 })
        )
        acc.position.set(dx, 0.255, dz + 0.475); scene.add(acc)

        // Legs
        ;[[-0.55, -0.38], [0.55, -0.38], [-0.55, 0.38], [0.55, 0.38]].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.055, 0.22, 0.055),
            new THREE.MeshStandardMaterial({ color: 0x1e293b })
          )
          leg.position.set(dx + lx, 0.11, dz + lz); scene.add(leg)
        })

        // Monitor
        const mon = new THREE.Mesh(
          new THREE.BoxGeometry(0.78, 0.52, 0.045),
          new THREE.MeshStandardMaterial({ color: 0x080f1c, roughness: 0.2, metalness: 0.5 })
        )
        mon.position.set(dx, 0.55, dz - 0.22); mon.castShadow = true; scene.add(mon)

        // Screen glow
        const scr = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.42, 0.01),
          new THREE.MeshStandardMaterial({
            color: a.isOnline ? c.num : 0x040810,
            emissive: a.isOnline ? c.num : 0x020408,
            emissiveIntensity: a.isOnline ? 1.5 : 0.05,
          })
        )
        scr.position.set(dx, 0.55, dz - 0.198); scene.add(scr)
        if (a.isOnline) {
          const sLight = new THREE.PointLight(c.num, 0.8, 2.5)
          sLight.position.set(dx, 0.55, dz - 0.1); scene.add(sLight)
        }

        // Monitor stand
        const stnd = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.18, 0.055),
          new THREE.MeshStandardMaterial({ color: 0x2d3748 })
        )
        stnd.position.set(dx, 0.37, dz - 0.22); scene.add(stnd)

        // Keyboard
        const kb = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.02, 0.22),
          new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
        )
        kb.position.set(dx, 0.275, dz + 0.18); scene.add(kb)

        // Chair seat
        const chSeat = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.06, 0.62),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 })
        )
        chSeat.position.set(dx, 0.23, dz + 0.72); chSeat.castShadow = true; scene.add(chSeat)

        // Chair back
        const chBack = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.45, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 })
        )
        chBack.position.set(dx, 0.465, dz + 1.02); scene.add(chBack)
      })

      // ── Conference room ───────────────────────────────────────
      // Conf floor
      const cfFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(CONF_W, CONF_D),
        new THREE.MeshStandardMaterial({ color: 0x0d1830, roughness: 0.9 })
      )
      cfFloor.rotation.x = -Math.PI / 2
      cfFloor.position.set(CONF_CX, 0.004, CONF_CZ); cfFloor.receiveShadow = true
      scene.add(cfFloor)

      // Glass wall material
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x6080ff, transparent: true, opacity: 0.1,
        roughness: 0.0, metalness: 0.0,
        transmission: 0.9, ior: 1.5,
        side: THREE.DoubleSide,
      })

      const wallDefs = [
        // left wall (entry gap in middle)
        { pos: [CONF_X, 0.75, CONF_Z + CONF_D * 0.2], size: [0.05, 1.5, CONF_D * 0.38] },
        { pos: [CONF_X, 0.75, CONF_Z + CONF_D * 0.8], size: [0.05, 1.5, CONF_D * 0.38] },
        // right wall
        { pos: [CONF_X + CONF_W, 0.75, CONF_CZ], size: [0.05, 1.5, CONF_D] },
        // front
        { pos: [CONF_CX, 0.75, CONF_Z], size: [CONF_W, 1.5, 0.05] },
        // back
        { pos: [CONF_CX, 0.75, CONF_Z + CONF_D], size: [CONF_W, 1.5, 0.05] },
      ]
      wallDefs.forEach(({ pos, size }) => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(...size), glassMat)
        w.position.set(...pos); scene.add(w)
      })

      // Neon edge lines on conf room
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a3a6a, linewidth: 1 })
      const corners = [
        [CONF_X, CONF_Z], [CONF_X + CONF_W, CONF_Z],
        [CONF_X + CONF_W, CONF_Z + CONF_D], [CONF_X, CONF_Z + CONF_D],
      ]
      corners.forEach(([cx, cz]) => {
        const verts = [new THREE.Vector3(cx, 0, cz), new THREE.Vector3(cx, 1.5, cz)]
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(verts), edgeMat))
      })
      for (let y of [0, 1.5]) {
        const pts = [...corners, corners[0]].map(([cx, cz]) => new THREE.Vector3(cx, y, cz))
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat))
      }

      // Conf table
      const tbl = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 0.09, 32),
        new THREE.MeshStandardMaterial({ color: 0x18243e, roughness: 0.3, metalness: 0.4 })
      )
      tbl.position.set(CONF_CX, 0.245, CONF_CZ); tbl.castShadow = true; tbl.receiveShadow = true
      scene.add(tbl)

      // Table glow ring
      ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.6, 0.035, 8, 64),
        new THREE.MeshStandardMaterial({ color: 0x3355bb, emissive: 0x2244aa, emissiveIntensity: 0.4 })
      )
      ringMesh.rotation.x = -Math.PI / 2; ringMesh.position.set(CONF_CX, 0.295, CONF_CZ)
      scene.add(ringMesh)

      // Conf room overhead light (off by default)
      confLight = new THREE.PointLight(0x7080ff, 0, 10)
      confLight.position.set(CONF_CX, 4, CONF_CZ); scene.add(confLight)

      // ── Plants ────────────────────────────────────────────────
      const plantSpots: [number, number][] = [[0.5, 0.5], [15.5, 0.5], [0.5, 12.5]]
      plantSpots.forEach(([px, pz]) => {
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.14, 0.28, 8),
          new THREE.MeshStandardMaterial({ color: 0x7c4a2a, roughness: 1 })
        )
        pot.position.set(px, 0.14, pz); pot.castShadow = true; scene.add(pot)
        const pl = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x16572e, roughness: 1 })
        )
        pl.position.set(px, 0.5, pz); scene.add(pl)
      })

      // ── Characters ────────────────────────────────────────────
      charsRef.current.forEach(c => {
        const ag = initAgents.find(a => a.id === c.id)
        const col = COL[c.name] ?? COL.Theo

        const grp = new THREE.Group()
        grp.position.set(c.x, 0, c.z)

        // Body cylinder
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.14, 0.48, 12),
          new THREE.MeshStandardMaterial({
            color: col.num, roughness: 0.45, metalness: 0.1,
            emissive: col.num, emissiveIntensity: ag?.isOnline ? 0.2 : 0,
          })
        )
        body.position.y = 0.34; body.castShadow = true; grp.add(body)

        // Neck
        const neck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.09, 0.1, 8),
          new THREE.MeshStandardMaterial({ color: 0xe8c9a8, roughness: 0.7 })
        )
        neck.position.y = 0.63; grp.add(neck)

        // Head sphere
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.21, 16, 12),
          new THREE.MeshStandardMaterial({ color: 0xf0d5b8, roughness: 0.65 })
        )
        head.position.y = 0.85; head.castShadow = true; grp.add(head)

        // Hair dome
        const hair = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, 1.0),
          new THREE.MeshStandardMaterial({ color: col.num, roughness: 0.8 })
        )
        hair.position.y = 0.87; grp.add(hair)

        // Eyes
        for (const ex of [-0.07, 0.07]) {
          const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
          )
          eye.position.set(ex, 0.87, 0.185); grp.add(eye)
        }

        // Agent glow light
        const lite = new THREE.PointLight(col.num, ag?.isOnline ? 1.8 : 0, 2.8)
        lite.position.y = 0.4; grp.add(lite)

        scene.add(grp)

        // HTML name label
        const lbl = document.createElement('div')
        lbl.style.cssText = `
          position:absolute; pointer-events:none; transform:translate(-50%,0);
          background:rgba(6,10,20,0.92); border:1px solid ${col.hex}55;
          color:${ag?.isOnline ? col.hex : '#334466'};
          font:600 9px/1.4 ui-monospace,monospace; padding:2px 7px;
          border-radius:6px; white-space:nowrap;
          opacity:${ag?.isOnline ? '1' : '0.3'};
          box-shadow:${ag?.isOnline ? `0 0 8px ${col.hex}44` : 'none'};
        `
        lbl.textContent = `${c.emoji} ${c.name}`
        labelsRef.current?.appendChild(lbl)

        charMeshes.set(c.id, { grp, body, head, lite, lbl })
      })

      // ── Tick loop ─────────────────────────────────────────────
      const tick = () => {
        rafId = requestAnimationFrame(tick)
        const n = ++tickRef.current
        const chars = charsRef.current
        const meet = meetRef.current

        // Sync online status from latest agents
        const curAgents = agentsRef.current
        chars.forEach(c => {
          const a = curAgents.find(x => x.id === c.id)
          if (a) { c.online = a.isOnline; c.available = a.isAvailable; c.lastAction = a.lastAction }
        })

        // Meeting trigger
        const manual = triggerRef.current
        if (manual) triggerRef.current = false

        if (!meet.active && (manual || n % 1200 === 0)) {
          const theo = chars.find(c => c.name === 'Theo' && (c.online || manual)) ?? chars[0]
          if (theo) {
            const avail = chars.filter(c => c.id !== theo.id && c.available && c.state === 'at_desk')
            const cnt = Math.min(1 + Math.floor(Math.random() * 3), avail.length)
            const invited = avail.sort(() => Math.random() - 0.5).slice(0, cnt)
            const all = [theo, ...invited]
            meet.active = true; meet.participants = all.map(c => c.id)
            meet.timer = 600 + Math.floor(Math.random() * 300)
            meet.announce = `📢 Theo → ${invited.length ? invited.map(c => c.name).join(', ') : 'solo'} meeting`
            meet.announceTick = 240
            setAnnounce(meet.announce); setConfOn(true); onMeetingChange?.(true)
            if (confLight) confLight.intensity = 3.5
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
              if (c) { c.state = 'to_desk'; c.tx = c.deskX; c.tz = c.deskZ; c.timer = 400; c.bubble = '✅ Done!'; c.bubbleTimer = 90 }
            })
            meet.active = false; meet.participants = []
            setConfOn(false); onMeetingChange?.(false)
            if (confLight) confLight.intensity = 0
          }
        }

        // Animate conf ring
        if (ringMesh) {
          ringMesh.material.emissiveIntensity = meet.active ? (0.4 + Math.sin(n * 0.05) * 0.3) : 0.15
        }

        chars.forEach(c => {
          const m = charMeshes.get(c.id)

          if (c.state === 'in_meeting') {
            c.phase += 0.025
            const seat = CONF_SEATS[c.seatIdx] ?? CONF_SEATS[0]
            c.x = seat.x; c.z = seat.z + Math.sin(c.phase) * 0.015
          } else {
            c.timer--
            if (c.timer <= 0) {
              if (c.state === 'at_desk' && !meet.participants.includes(c.id)) {
                if (c.online && Math.random() < 0.3) {
                  const L = DESK_LAYOUT[c.name]; const row = L?.row ?? 0
                  c.tx = 1 + Math.random() * 13.5
                  c.tz = ROW_Z[row] + (Math.random() - 0.5) * 1.2
                  c.state = 'wandering'; c.timer = 80 + Math.random() * 120
                } else { c.timer = 150 + Math.random() * 200 }
              } else if (c.state === 'wandering') {
                c.tx = c.deskX; c.tz = c.deskZ; c.state = 'to_desk'; c.timer = 400
              } else if (c.state === 'to_desk') { c.timer = 400 }
              if (c.online && c.lastAction && Math.random() < 0.07) {
                c.bubble = c.lastAction.slice(0, 52); c.bubbleTimer = 170
              }
            }

            // Arrival checks
            if (c.state === 'to_desk' && Math.abs(c.x - c.deskX) < 0.08 && Math.abs(c.z - c.deskZ) < 0.08) {
              c.state = 'at_desk'; c.timer = 150 + Math.random() * 250; c.x = c.deskX; c.z = c.deskZ
            }
            if (c.state === 'going_to_meeting' && Math.abs(c.x - CONF_ENTRY_X) < 0.12) {
              const seat = CONF_SEATS[c.seatIdx] ?? CONF_SEATS[0]
              c.state = 'in_meeting'; c.x = seat.x; c.z = seat.z; c.tx = seat.x; c.tz = seat.z
            }

            // Movement
            const dx = c.tx - c.x, dz = c.tz - c.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            const spd = (c.online || c.state === 'going_to_meeting' || c.state === 'to_desk') ? 0.042 : 0
            if (dist > 0.04 && spd > 0) {
              c.x += dx / dist * spd; c.z += dz / dist * spd
              c.facing = Math.atan2(dx, dz); c.moving = true; c.phase += 0.14
            } else {
              c.moving = false
              if (c.online || c.state === 'in_meeting') c.phase += 0.04
            }
          }

          if (c.bubbleTimer > 0) c.bubbleTimer--

          // Update Three.js mesh
          if (m) {
            m.grp.position.x = c.x; m.grp.position.z = c.z
            m.grp.rotation.y = c.facing
            if (c.moving) {
              m.grp.position.y = Math.abs(Math.sin(c.phase)) * 0.09
              m.body.rotation.z = Math.sin(c.phase) * 0.12
            } else {
              m.grp.position.y = Math.sin(c.phase * 0.4) * 0.022
              m.body.rotation.z *= 0.85
            }
            // Fade light for online state
            m.lite.intensity += ((c.online ? 1.8 : 0) - m.lite.intensity) * 0.05

            // Project to screen for label
            const v = new THREE.Vector3(c.x, 1.25, c.z).project(camera)
            const lx = (v.x * 0.5 + 0.5) * W
            const ly = (-v.y * 0.5 + 0.5) * H
            m.lbl.style.left = lx + 'px'
            m.lbl.style.top = (ly - 4) + 'px'
            m.lbl.style.display = v.z < 1 ? 'block' : 'none'
          }
        })

        // Random activity bubble
        if (n % 280 === 0) {
          const pool = chars.filter(c => c.online && c.lastAction && c.state !== 'in_meeting')
          if (pool.length) { const c = pool[Math.floor(Math.random() * pool.length)]; c.bubble = c.lastAction!.slice(0, 52); c.bubbleTimer = 190 }
        }

        renderer.render(scene, camera)
      }
      tick()
    }

    init()

    return () => {
      cancelAnimationFrame(rafId)
      renderer?.dispose()
      if (mountRef.current && renderer?.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement)
      }
      charMeshes.forEach(({ lbl }) => lbl.remove())
      charMeshes.clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-0">
      {announce && (
        <div className="flex justify-center mb-3">
          <div className="px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 24px rgba(99,102,241,0.5)' }}>
            {announce}
          </div>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden border border-zinc-800/60"
        style={{ width: 810, height: 480, boxShadow: '0 0 60px rgba(10,20,60,0.8)' }}>
        <div ref={mountRef} className="w-full h-full" />
        <div ref={labelsRef} className="absolute inset-0 pointer-events-none" />

        {/* Conf room badge */}
        <div className="absolute top-3 right-3 pointer-events-none">
          <div className="px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider" style={{
            background: confOn ? 'rgba(99,102,241,0.18)' : 'rgba(10,18,35,0.85)',
            border: `1px solid ${confOn ? 'rgba(99,102,241,0.55)' : 'rgba(25,40,70,0.6)'}`,
            color: confOn ? '#a5b4fc' : '#2a3a60',
            boxShadow: confOn ? '0 0 16px rgba(99,102,241,0.3)' : 'none',
          }}>
            {confOn ? '● MEETING ACTIVE' : '○ CONFERENCE'}
          </div>
        </div>

        {/* Speech bubbles (positioned over 3D canvas) */}
        {charsRef.current.filter(c => c.bubble && c.bubbleTimer > 0).map(c => {
          // We'll render these via a React state update — but we need positions.
          // For now they render via the label system above; skip here to avoid stale state.
          return null
        })}

        {/* Agent info panel */}
        {selected && (() => {
          const a = selected; const col = COL[a.name]?.hex ?? '#6366f1'
          return (
            <div className="absolute bottom-3 left-3 rounded-2xl p-4 w-56" style={{
              background: 'rgba(6,10,20,0.97)', border: `1px solid ${col}44`,
              backdropFilter: 'blur(20px)', boxShadow: `0 0 30px ${col}20, 0 8px 32px rgba(0,0,0,0.6)`,
              zIndex: 30,
            }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{
                  background: `radial-gradient(135deg at 30% 30%, ${col}cc, ${col}44)`,
                  border: `2px solid ${col}`,
                  boxShadow: `0 0 12px ${col}55`,
                }}>
                  {a.avatar_emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold text-sm leading-none">{a.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 truncate">{a.role}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${col}22`, color: col }}>
                  {a.isOnline ? 'Online' : a.isAvailable ? 'Recent' : 'Idle'}
                </span>
              </div>
              {a.lastAction && <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">{a.lastAction}</p>}
              {a.minutesAgo !== null && (
                <p className="text-zinc-700 text-xs mt-2">{a.minutesAgo < 1 ? 'Active just now' : `${a.minutesAgo}m ago`}</p>
              )}
              <button onClick={() => setSelected(null)} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-all text-xs">✕</button>
            </div>
          )
        })()}
      </div>

      {/* Agent pills */}
      <div className="flex flex-wrap gap-2 mt-3">
        {agents.map(a => {
          const col = COL[a.name]?.hex ?? '#6366f1'
          return (
            <button key={a.id} onClick={() => setSelected(s => s?.id === a.id ? null : a)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                background: selected?.id === a.id ? `${col}20` : 'rgba(8,12,22,0.85)',
                borderColor: `${col}${a.isOnline ? '55' : '1a'}`,
                color: a.isOnline ? col : '#2a3a55',
                boxShadow: a.isOnline && selected?.id === a.id ? `0 0 10px ${col}33` : 'none',
              }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: a.isOnline ? col : '#1a2540', boxShadow: a.isOnline ? `0 0 5px ${col}` : 'none' }} />
              {a.avatar_emoji} {a.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
