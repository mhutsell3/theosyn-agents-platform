'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { AgentStatus } from '@/lib/agents'

const COL: Record<string, { num: number; hex: string }> = {
  Theo:      { num: 0x6366f1, hex: '#6366f1' },
  Scout:     { num: 0x10b981, hex: '#10b981' },
  Nova:      { num: 0xf59e0b, hex: '#f59e0b' },
  Quill:     { num: 0x8b5cf6, hex: '#8b5cf6' },
  Beacon:    { num: 0x06b6d4, hex: '#06b6d4' },
  Flow:      { num: 0x3b82f6, hex: '#3b82f6' },
  Piper:     { num: 0xec4899, hex: '#ec4899' },
  Remi:      { num: 0xef4444, hex: '#ef4444' },
  Sage:      { num: 0x84cc16, hex: '#84cc16' },
  Lumen:     { num: 0xf97316, hex: '#f97316' },
  Atlas:     { num: 0x64748b, hex: '#64748b' },
  Scribe:    { num: 0xa78bfa, hex: '#a78bfa' },
  Forge:     { num: 0xd97706, hex: '#d97706' },
  Gather:    { num: 0x059669, hex: '#059669' },
  Grant:     { num: 0x7c3aed, hex: '#7c3aed' },
  Herald:    { num: 0xe11d48, hex: '#e11d48' },
  Missions:  { num: 0x0284c7, hex: '#0284c7' },
  Orion:     { num: 0x9333ea, hex: '#9333ea' },
  Pulse:     { num: 0xf43f5e, hex: '#f43f5e' },
  Reach:     { num: 0x14b8a6, hex: '#14b8a6' },
  Serve:     { num: 0x22c55e, hex: '#22c55e' },
  Shepherd:  { num: 0xeab308, hex: '#eab308' },
  Steward:   { num: 0x6366f1, hex: '#6366f1' },
  Flock:     { num: 0xa855f7, hex: '#a855f7' },
  Welcome:   { num: 0x38bdf8, hex: '#38bdf8' },
}
const DEFAULT_COL = { num: 0x6366f1, hex: '#6366f1' }

// Build desk grid dynamically from agents list
function buildLayout(agents: AgentStatus[]) {
  const COLS = 5
  const rows: { x: number; z: number }[][] = []
  const map: Record<string, { col: number; row: number }> = {}
  agents.forEach((a, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    if (!rows[row]) rows[row] = []
    const x = 1.5 + col * 3.2
    const z = 1.8 + row * 4.5
    rows[row][col] = { x, z }
    map[a.name] = { col, row }
  })
  return { map, rows }
}

const CONF_X = 0; const CONF_Z = 0; const CONF_W = 6.5; const CONF_D = 14
const CONF_CX = CONF_X + CONF_W / 2; const CONF_CZ = CONF_Z + CONF_D / 2
const CONF_ENTRY_X = CONF_X + CONF_W + 0.2
const CONF_SEATS = [
  { x: CONF_CX, z: CONF_Z + 2.2 },
  { x: CONF_CX + 1.8, z: CONF_CZ - 1.5 },
  { x: CONF_CX + 1.8, z: CONF_CZ + 1.5 },
  { x: CONF_CX, z: CONF_Z + CONF_D - 2.2 },
  { x: CONF_CX - 1.8, z: CONF_CZ + 1.5 },
  { x: CONF_CX - 1.8, z: CONF_CZ - 1.5 },
]

type CS = 'at_desk' | 'wandering' | 'to_desk' | 'going_to_meeting' | 'in_meeting'
interface Char {
  id: string; name: string; emoji: string; online: boolean; available: boolean; lastAction: string | null
  x: number; z: number; tx: number; tz: number; deskX: number; deskZ: number
  state: CS; timer: number; seatIdx: number; moving: boolean; facing: number
  bubble: string | null; bubbleTimer: number; phase: number
}
interface Meeting { active: boolean; participants: string[]; timer: number; announce: string; announceTick: number }

export default function PixelOffice({ agents, onCallMeeting, onMeetingChange }: {
  agents: AgentStatus[]
  onCallMeeting?: (fn: () => void) => void
  onMeetingChange?: (active: boolean) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => { agentsRef.current = agents }, [agents])
  useEffect(() => { onCallMeeting?.(() => { triggerRef.current = true }) }, [onCallMeeting])

  useEffect(() => {
    if (!mountRef.current || !containerRef.current) return
    const W = containerRef.current.clientWidth || 1200
    const H = Math.round(W * 0.52)

    const initAgents = agentsRef.current
    const { map: deskMap, rows: deskRows } = buildLayout(initAgents)

    charsRef.current = initAgents.map(a => {
      const L = deskMap[a.name]
      const row = L ? deskRows[L.row] : deskRows[0]
      const pos = (row && L) ? row[L.col] : { x: 5, z: 5 }
      // Offset for conference room on left side: shift desks right
      const px = pos.x + CONF_W + 2.5
      const pz = pos.z
      return {
        id: a.id, name: a.name, emoji: a.avatar_emoji,
        online: a.isOnline, available: a.isAvailable, lastAction: a.lastAction,
        x: px, z: pz, tx: px, tz: pz, deskX: px, deskZ: pz,
        state: 'at_desk', timer: 80 + Math.random() * 180, seatIdx: -1,
        moving: false, facing: 0, bubble: null, bubbleTimer: 0,
        phase: Math.random() * Math.PI * 2,
      }
    })

    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene, camera: THREE.OrthographicCamera
    let rafId: number
    const charMeshes = new Map<string, { grp: THREE.Group; body: THREE.Mesh; lite: THREE.PointLight; lbl: HTMLDivElement }>()
    let confLight: THREE.PointLight | null = null
    let ringMesh: THREE.Mesh | null = null
    let hologram: THREE.Group | null = null

    const init = () => {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.6
      renderer.setClearColor(0x220033)
      mountRef.current!.appendChild(renderer.domElement)

      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x030710, 0.005)

      // Compute office bounds to center camera
      const allX = charsRef.current.map(c => c.deskX)
      const allZ = charsRef.current.map(c => c.deskZ)
      const minX = Math.min(CONF_X, ...allX) - 1
      const maxX = Math.max(...allX) + 2
      const minZ = Math.min(CONF_Z, ...allZ) - 1
      const maxZ = Math.max(...allZ) + 2
      const cx = (minX + maxX) / 2
      const cz = (minZ + maxZ) / 2
      const spanX = maxX - minX + 4
      const spanZ = maxZ - minZ + 4

      // Isometric orthographic camera fitting the scene
      const asp = W / H
      const fH = Math.max(spanX / asp, spanZ) * 0.65
      camera = new THREE.OrthographicCamera(-fH * asp, fH * asp, fH, -fH, 0.1, 300)
      camera.position.set(cx + spanX * 0.7, spanX * 0.55, cz + spanZ * 0.7)
      camera.lookAt(cx, 0, cz)

      // ── Lighting ───────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x334477, 6.0))
      scene.add(new THREE.HemisphereLight(0x2255aa, 0x001133, 3.0))
      const sun = new THREE.DirectionalLight(0xaabbff, 4.0)
      sun.position.set(cx + 10, 25, cz + 5); sun.castShadow = true
      sun.shadow.mapSize.set(2048, 2048)
      sun.shadow.camera.left = -40; sun.shadow.camera.right = 40
      sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30
      sun.shadow.bias = -0.001
      scene.add(sun)
      const fill = new THREE.DirectionalLight(0x6699ff, 2.5)
      fill.position.set(cx - 15, 10, cz - 10); scene.add(fill)
      const rim = new THREE.DirectionalLight(0xff44ff, 1.2)
      rim.position.set(cx + 5, 8, cz - 20); scene.add(rim)

      // ── Floor ──────────────────────────────────────────────
      const floorW = maxX - minX + 8
      const floorD = maxZ - minZ + 8
      const floorGeo = new THREE.PlaneGeometry(floorW, floorD)
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x080e1c, roughness: 0.9, metalness: 0.15, emissive: 0x050a15, emissiveIntensity: 0.5 })
      const floor = new THREE.Mesh(floorGeo, floorMat)
      floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true
      scene.add(floor)
      const grid = new THREE.GridHelper(Math.max(floorW, floorD) + 4, Math.round(Math.max(floorW, floorD) + 4), 0x1a3a6e, 0x0f2044)
      grid.position.set(cx, 0.006, cz); scene.add(grid)

      // Row lanes
      const maxRow = Math.max(...Object.values(deskMap).map(d => d.row))
      for (let r = 0; r <= maxRow; r++) {
        const rz = 1.8 + r * 4.5
        const laneGeo = new THREE.PlaneGeometry(maxX - CONF_W - 2, 0.7)
        const laneMat = new THREE.MeshStandardMaterial({ color: 0x0e1e35, roughness: 0.9 })
        const lane = new THREE.Mesh(laneGeo, laneMat)
        lane.rotation.x = -Math.PI / 2
        lane.position.set((CONF_W + 2.5 + maxX) / 2, 0.007, rz + 1.5)
        scene.add(lane)
      }

      // ── Desks ─────────────────────────────────────────────
      initAgents.forEach(a => {
        const L = deskMap[a.name]; if (!L) return
        const rowArr = deskRows[L.row]; if (!rowArr) return
        const p = rowArr[L.col]; if (!p) return
        const dx = p.x + CONF_W + 2.5, dz = p.z
        const c = COL[a.name] ?? DEFAULT_COL

        const deskGroup = new THREE.Group(); deskGroup.position.set(dx, 0, dz)

        // Desk top
        const top = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.08, 1.0),
          new THREE.MeshStandardMaterial({ color: 0x1e3050, roughness: 0.55, metalness: 0.3 })
        )
        top.position.y = 0.24; top.castShadow = true; top.receiveShadow = true
        deskGroup.add(top)

        // Colored accent edge
        const acc = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.025, 0.035),
          new THREE.MeshStandardMaterial({ color: c.num, emissive: c.num, emissiveIntensity: a.isOnline ? 4.0 : 1.5 })
        )
        acc.position.set(0, 0.265, 0.5175); deskGroup.add(acc)

        // Legs
        for (const [lx, lz] of [[-0.62, -0.42], [0.62, -0.42], [-0.62, 0.42], [0.62, 0.42]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06),
            new THREE.MeshStandardMaterial({ color: 0x1a2a40 }))
          leg.position.set(lx, 0.11, lz); deskGroup.add(leg)
        }

        // Monitor
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.56, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x080f1c, roughness: 0.2, metalness: 0.6 }))
        mon.position.set(0, 0.56, -0.22); mon.castShadow = true; deskGroup.add(mon)

        // Screen
        const scr = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.45, 0.01),
          new THREE.MeshStandardMaterial({
            color: a.isOnline ? c.num : 0x1a2e50,
            emissive: a.isOnline ? c.num : 0x0d1f40,
            emissiveIntensity: a.isOnline ? 4.0 : 1.0,
          }))
        scr.position.set(0, 0.56, -0.197); deskGroup.add(scr)
        if (a.isOnline) {
          const sl = new THREE.PointLight(c.num, 3.5, 5.0)
          sl.position.set(0, 0.56, -0.1); deskGroup.add(sl)
        }

        // Stand
        deskGroup.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x2a3a50 })), { position: new (THREE.Vector3)(0, 0.38, -0.22) }))

        // Keyboard
        deskGroup.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.018, 0.24),
          new THREE.MeshStandardMaterial({ color: 0x101e30, roughness: 0.9 })), { position: new (THREE.Vector3)(0, 0.278, 0.18) }))

        // Chair
        const chMat = new THREE.MeshStandardMaterial({ color: 0x0c1a2e, roughness: 0.95 })
        deskGroup.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.065, 0.65), chMat), { position: new (THREE.Vector3)(0, 0.235, 0.75) }))
        deskGroup.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.52, 0.055), chMat), { position: new (THREE.Vector3)(0, 0.495, 1.08) }))

        scene.add(deskGroup)
      })

      // ── Conference room ────────────────────────────────────
      // Floor
      const cfFloor = new THREE.Mesh(new THREE.PlaneGeometry(CONF_W, CONF_D),
        new THREE.MeshStandardMaterial({ color: 0x0d1e36, roughness: 0.85 }))
      cfFloor.rotation.x = -Math.PI / 2
      cfFloor.position.set(CONF_CX, 0.004, CONF_CZ); cfFloor.receiveShadow = true
      scene.add(cfFloor)

      // Glass walls
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xaaccff, transparent: true, opacity: 0.35,
        roughness: 0.0, metalness: 0.1, side: THREE.DoubleSide,
        emissive: 0x2244aa, emissiveIntensity: 0.4,
      })
      const wallSpecs: { pos: [number,number,number]; size: [number,number,number] }[] = [
        { pos: [CONF_X + CONF_W, 0.75, CONF_Z + CONF_D * 0.22], size: [0.05, 1.5, CONF_D * 0.42] },
        { pos: [CONF_X + CONF_W, 0.75, CONF_Z + CONF_D * 0.78], size: [0.05, 1.5, CONF_D * 0.42] },
        { pos: [CONF_X, 0.75, CONF_CZ], size: [0.05, 1.5, CONF_D] },
        { pos: [CONF_CX, 0.75, CONF_Z], size: [CONF_W, 1.5, 0.05] },
        { pos: [CONF_CX, 0.75, CONF_Z + CONF_D], size: [CONF_W, 1.5, 0.05] },
      ]
      wallSpecs.forEach(({ pos, size }) => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(...size), glassMat)
        w.position.set(...pos); scene.add(w)
      })

      // Glowing edge lines
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x4488ff, linewidth: 2 })
      const corners: [number, number][] = [[CONF_X, CONF_Z], [CONF_X + CONF_W, CONF_Z], [CONF_X + CONF_W, CONF_Z + CONF_D], [CONF_X, CONF_Z + CONF_D]]
      corners.forEach(([ex, ez]) => {
        const pts = [new THREE.Vector3(ex, 0, ez), new THREE.Vector3(ex, 1.5, ez)]
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat))
      })
      for (const ey of [0, 1.5]) {
        const pts = [...corners, corners[0]].map(([ex, ez]) => new THREE.Vector3(ex, ey, ez))
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat))
      }

      // Table
      const tbl = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.1, 32),
        new THREE.MeshStandardMaterial({ color: 0x1a2e50, roughness: 0.25, metalness: 0.5 }))
      tbl.position.set(CONF_CX, 0.25, CONF_CZ); tbl.castShadow = true; scene.add(tbl)

      // Table rim
      ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05, 8, 64),
        new THREE.MeshStandardMaterial({ color: 0x6688ff, emissive: 0x4466ff, emissiveIntensity: 3.0 }))
      ringMesh.rotation.x = -Math.PI / 2; ringMesh.position.set(CONF_CX, 0.31, CONF_CZ); scene.add(ringMesh)

      // Hologram above table (torus rings, hidden by default)
      hologram = new THREE.Group(); hologram.position.set(CONF_CX, 0.8, CONF_CZ); hologram.visible = false
      for (let i = 0; i < 3; i++) {
        const hr = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.3, 0.02, 6, 32),
          new THREE.MeshStandardMaterial({ color: 0x6688ff, emissive: 0x4466ff, emissiveIntensity: 1.5, transparent: true, opacity: 0.7 }))
        hr.rotation.x = Math.PI / 2 + i * 0.4; hologram.add(hr)
      }
      scene.add(hologram)

      // Overhead conf light
      confLight = new THREE.PointLight(0x8899ff, 0, 12); confLight.position.set(CONF_CX, 4, CONF_CZ)
      scene.add(confLight)

      // Wall-mounted screens inside conf room
      for (let i = 0; i < 2; i++) {
        const scrPanel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x0a1428, emissive: 0x0a2060, emissiveIntensity: 0.3 }))
        scrPanel.position.set(CONF_CX, 1.0, CONF_Z + 0.1 + i * (CONF_D - 0.2))
        scene.add(scrPanel)
      }

      // Chairs around table
      CONF_SEATS.forEach(seat => {
        const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8),
          new THREE.MeshStandardMaterial({ color: 0x0f1e32, roughness: 0.95 }))
        ch.position.set(seat.x, 0.23, seat.z); scene.add(ch)
      })

      // ── Characters ─────────────────────────────────────────
      charsRef.current.forEach(c => {
        const ag = initAgents.find(a => a.id === c.id)
        const col = COL[c.name] ?? DEFAULT_COL
        const grp = new THREE.Group(); grp.position.set(c.x, 0, c.z)

        // Body
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.5, 12),
          new THREE.MeshStandardMaterial({
            color: col.num, roughness: 0.3, metalness: 0.1,
            emissive: col.num, emissiveIntensity: ag?.isOnline ? 2.0 : 0.6,
          }))
        body.position.y = 0.35; body.castShadow = true; grp.add(body)

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10),
          new THREE.MeshStandardMaterial({ color: 0xf0d5b8, roughness: 0.65 }))
        head.position.y = 0.84; head.castShadow = true; grp.add(head)

        // Hair
        const hair = new THREE.Mesh(
          new THREE.SphereGeometry(0.23, 14, 8, 0, Math.PI * 2, 0, 1.05),
          new THREE.MeshStandardMaterial({ color: col.num, roughness: 0.85 }))
        hair.position.y = 0.85; grp.add(hair)

        // Eyes
        for (const ex of [-0.08, 0.08]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5),
            new THREE.MeshStandardMaterial({ color: 0x0a0a0a }))
          eye.position.set(ex, 0.86, 0.19); grp.add(eye)
        }

        // Glow light
        const lite = new THREE.PointLight(col.num, ag?.isOnline ? 4.0 : 0.5, 4.0)
        lite.position.y = 0.4; grp.add(lite)

        scene.add(grp)

        // HTML label
        const lbl = document.createElement('div')
        lbl.style.cssText = `position:absolute;pointer-events:none;transform:translate(-50%,0);
          background:rgba(4,8,18,0.93);border:1px solid ${col.hex}66;
          color:${ag?.isOnline ? col.hex : '#5a7ab0'};
          font:600 9px/1.4 ui-monospace,monospace;padding:2px 7px;border-radius:6px;
          white-space:nowrap;box-shadow:${ag?.isOnline ? `0 0 10px ${col.hex}88` : 'none'};
          opacity:${ag?.isOnline ? '1' : '0.6'}`
        lbl.textContent = `${c.emoji} ${c.name}`
        labelsRef.current?.appendChild(lbl)

        charMeshes.set(c.id, { grp, body, lite, lbl })
      })

      // ── Plants ─────────────────────────────────────────────
      const plantSpots: [number, number][] = [
        [CONF_X - 0.8, CONF_Z - 0.8],
        [CONF_X - 0.8, CONF_Z + CONF_D + 0.8],
        [maxX + 1.5, 0.8],
        [maxX + 1.5, maxZ],
      ]
      plantSpots.forEach(([px, pz]) => {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8),
          new THREE.MeshStandardMaterial({ color: 0x6b3a1f, roughness: 1 }))
        pot.position.set(px, 0.15, pz); pot.castShadow = true; scene.add(pot)
        const pl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x1a5e30, roughness: 1 }))
        pl.position.set(px, 0.52, pz); scene.add(pl)
      })

      // ── Tick ───────────────────────────────────────────────
      const tick = () => {
        rafId = requestAnimationFrame(tick)
        const n = ++tickRef.current
        const chars = charsRef.current
        const meet = meetRef.current

        // Sync status
        const cur = agentsRef.current
        chars.forEach(c => {
          const a = cur.find(x => x.id === c.id)
          if (a) { c.online = a.isOnline; c.available = a.isAvailable; c.lastAction = a.lastAction }
        })

        const manual = triggerRef.current; if (manual) triggerRef.current = false
        if (!meet.active && (manual || n % 1400 === 0)) {
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
            if (confLight) confLight.intensity = 4
            if (hologram) hologram.visible = true
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
          if (hologram) { hologram.children.forEach((h: any, i: number) => { h.rotation.z = n * 0.02 + i * 1.2 }) }
          if (meet.timer <= 0) {
            meet.participants.forEach(id => {
              const c = chars.find(x => x.id === id)
              if (c) { c.state = 'to_desk'; c.tx = c.deskX; c.tz = c.deskZ; c.timer = 500; c.bubble = '✅ Done!'; c.bubbleTimer = 90 }
            })
            meet.active = false; meet.participants = []
            setConfOn(false); onMeetingChange?.(false)
            if (confLight) confLight.intensity = 0
            if (hologram) hologram.visible = false
          }
        }

        if (ringMesh) (ringMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = meet.active ? 3.0 + Math.sin(n * 0.06) * 1.5 : 1.5

        chars.forEach(c => {
          const m = charMeshes.get(c.id)
          if (c.state === 'in_meeting') {
            c.phase += 0.025
            const seat = CONF_SEATS[c.seatIdx] ?? CONF_SEATS[0]
            c.x = seat.x; c.z = seat.z + Math.sin(c.phase) * 0.012
          } else {
            c.timer--
            if (c.timer <= 0) {
              if (c.state === 'at_desk' && !meet.participants.includes(c.id)) {
                if (c.online && Math.random() < 0.28) {
                  const L = deskMap[c.name]; const row = L?.row ?? 0
                  const rz = 1.8 + row * 4.5
                  c.tx = CONF_W + 3 + Math.random() * (maxX - CONF_W - 1)
                  c.tz = rz + (Math.random() - 0.5) * 1.2
                  c.state = 'wandering'; c.timer = 90 + Math.random() * 130
                } else { c.timer = 160 + Math.random() * 220 }
              } else if (c.state === 'wandering') {
                c.tx = c.deskX; c.tz = c.deskZ; c.state = 'to_desk'; c.timer = 500
              } else if (c.state === 'to_desk') { c.timer = 500 }
              if (c.online && c.lastAction && Math.random() < 0.07) {
                c.bubble = c.lastAction.slice(0, 52); c.bubbleTimer = 180
              }
            }
            if (c.state === 'to_desk' && Math.abs(c.x - c.deskX) < 0.1 && Math.abs(c.z - c.deskZ) < 0.1) {
              c.state = 'at_desk'; c.timer = 160 + Math.random() * 260; c.x = c.deskX; c.z = c.deskZ
            }
            if (c.state === 'going_to_meeting' && Math.abs(c.x - CONF_ENTRY_X) < 0.15) {
              const seat = CONF_SEATS[c.seatIdx] ?? CONF_SEATS[0]
              c.state = 'in_meeting'; c.x = seat.x; c.z = seat.z; c.tx = seat.x; c.tz = seat.z
            }
            const dx = c.tx - c.x, dz = c.tz - c.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            const spd = (c.online || c.state === 'going_to_meeting' || c.state === 'to_desk') ? 0.044 : 0
            if (dist > 0.04 && spd > 0) {
              c.x += dx / dist * spd; c.z += dz / dist * spd
              c.facing = Math.atan2(dx, dz); c.moving = true; c.phase += 0.14
            } else {
              c.moving = false
              if (c.online) c.phase += 0.04
            }
          }
          if (c.bubbleTimer > 0) c.bubbleTimer--

          if (m) {
            m.grp.position.x = c.x; m.grp.position.z = c.z
            m.grp.rotation.y = c.facing
            m.grp.position.y = c.moving ? Math.abs(Math.sin(c.phase)) * 0.1 : Math.sin(c.phase * 0.35) * 0.024
            if (c.moving) m.body.rotation.z = Math.sin(c.phase) * 0.12
            else m.body.rotation.z *= 0.88
            m.lite.intensity += ((c.online ? 4.0 : 0.5) - m.lite.intensity) * 0.05

            // Project label
            const v = new THREE.Vector3(c.x, 1.28, c.z).project(camera)
            m.lbl.style.left = ((v.x * 0.5 + 0.5) * W) + 'px'
            m.lbl.style.top = ((-v.y * 0.5 + 0.5) * H - 5) + 'px'
            m.lbl.style.display = v.z < 1 ? 'block' : 'none'
          }
        })

        if (n % 300 === 0) {
          const pool = chars.filter(c => c.online && c.lastAction && c.state !== 'in_meeting')
          if (pool.length) { const c = pool[Math.floor(Math.random() * pool.length)]; c.bubble = c.lastAction!.slice(0, 52); c.bubbleTimer = 200 }
        }

        renderer!.render(scene, camera)
      }
      tick()
    }

    console.log('THREE available:', typeof THREE, Object.keys(THREE).slice(0,5))
    try { init() } catch (e) { console.error('Three.js init error:', e, (e as Error).stack) }
    return () => {
      cancelAnimationFrame(rafId)
      renderer?.dispose()
      if (mountRef.current && renderer?.domElement?.parentNode === mountRef.current) mountRef.current.removeChild(renderer.domElement)
      charMeshes.forEach(({ lbl }) => lbl.remove())
      charMeshes.clear()
    }
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
        <div ref={mountRef} className="w-full" style={{ lineHeight: 0 }} />
        <div ref={labelsRef} className="absolute inset-0 pointer-events-none" />

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
          const a = selected; const col = COL[a.name]?.hex ?? '#6366f1'
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
          const col = COL[a.name]?.hex ?? '#6366f1'
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
