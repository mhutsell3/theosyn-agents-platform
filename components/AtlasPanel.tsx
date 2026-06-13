'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectRisk } from '@/lib/atlas'

const riskColor: Record<string, string> = {
  overdue:  'text-rose-400 border-rose-900',
  at_risk:  'text-amber-400 border-amber-900',
  on_track: 'text-emerald-400 border-zinc-800',
}

const riskBadge: Record<string, string> = {
  overdue:  'bg-rose-900 text-rose-300',
  at_risk:  'bg-amber-900 text-amber-300',
  on_track: 'bg-emerald-900 text-emerald-300',
}

const riskLabel: Record<string, string> = {
  overdue:  'Overdue',
  at_risk:  'At Risk',
  on_track: 'On Track',
}

export default function AtlasPanel() {
  const [risks, setRisks] = useState<ProjectRisk[]>([])
  const [summary, setSummary] = useState<{ overdue: number; atRisk: number; onTrack: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<ProjectRisk | null>(null)
  const [statusUpdate, setStatusUpdate] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [generatingStatus, setGeneratingStatus] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [runningHeartbeat, setRunningHeartbeat] = useState(false)
  const [heartbeatResult, setHeartbeatResult] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => { scan() }, [])

  async function scan() {
    setLoading(true)
    const res = await fetch('/api/atlas/scan')
    if (res.ok) {
      const data = await res.json()
      setRisks(data.risks ?? [])
      setSummary({ overdue: data.overdue, atRisk: data.atRisk, onTrack: data.onTrack })
    }
    setLoading(false)
  }

  async function handleStatusUpdate(project: ProjectRisk) {
    setSelectedProject(project)
    setStatusUpdate(null)
    setPlan(null)
    setGeneratingStatus(true)
    const res = await fetch('/api/atlas/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })
    const data = await res.json()
    setStatusUpdate(data.update)
    setGeneratingStatus(false)
  }

  async function handleGeneratePlan(project: ProjectRisk) {
    setSelectedProject(project)
    setPlan(null)
    setStatusUpdate(null)
    setGeneratingPlan(true)
    const res = await fetch('/api/atlas/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })
    const data = await res.json()
    setPlan(data.plan)
    setGeneratingPlan(false)
  }

  async function handleHeartbeat() {
    setRunningHeartbeat(true)
    setHeartbeatResult(null)
    const res = await fetch('/api/atlas/heartbeat', { method: 'POST' })
    const data = await res.json()
    setHeartbeatResult(`🏗️ Atlas wrote his weekly project report. ${data.overdue} overdue.`)
    setRunningHeartbeat(false)
    router.refresh()
  }

  function renderMarkdown(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <p key={i} className="text-white text-xs font-semibold mt-3 mb-1">{line.slice(3)}</p>
      if (line.startsWith('- ')) return <p key={i} className="text-zinc-300 text-xs pl-2">• {line.slice(2)}</p>
      if (line.trim() === '') return <div key={i} className="h-1" />
      return <p key={i} className="text-zinc-300 text-xs">{line}</p>
    })
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏗️</span>
          <div>
            <h3 className="text-white font-semibold text-sm">Atlas — Project Manager</h3>
            <p className="text-zinc-500 text-xs">Deadlines, risks, deliverables</p>
          </div>
        </div>
        <button
          onClick={handleHeartbeat}
          disabled={runningHeartbeat}
          className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
        >
          {runningHeartbeat ? '🏗️ Running...' : '🏗️ Weekly Report'}
        </button>
      </div>

      {heartbeatResult && <p className="text-emerald-400 text-xs">{heartbeatResult}</p>}

      {/* Summary chips */}
      {summary && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Overdue', value: summary.overdue, color: 'text-rose-400' },
            { label: 'At Risk', value: summary.atRisk, color: 'text-amber-400' },
            { label: 'On Track', value: summary.onTrack, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-zinc-800 rounded-lg p-2 text-center">
              <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-zinc-600 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Project list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Active Projects</span>
          <button onClick={scan} className="text-zinc-600 hover:text-zinc-400 text-xs">↻ Refresh</button>
        </div>

        {loading ? (
          <p className="text-zinc-600 text-xs">Scanning projects...</p>
        ) : risks.length === 0 ? (
          <p className="text-zinc-600 text-xs">No active projects.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {risks.map(project => (
              <div
                key={project.id}
                className={`bg-zinc-800 border rounded-lg p-3 flex items-start gap-3 cursor-pointer transition-colors hover:border-zinc-600 ${selectedProject?.id === project.id ? 'border-indigo-700' : riskColor[project.risk]}`}
                onClick={() => { setSelectedProject(project); setStatusUpdate(null); setPlan(null) }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white text-sm font-medium truncate">{project.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${riskBadge[project.risk]}`}>
                      {riskLabel[project.risk]}
                    </span>
                  </div>
                  {project.client_name && <p className="text-zinc-500 text-xs">{project.client_name}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-zinc-500 text-xs">{project.phase}</span>
                    {project.daysUntilDue !== null ? (
                      <span className={`text-xs ${project.daysUntilDue < 0 ? 'text-rose-400' : project.daysUntilDue <= 3 ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {project.daysUntilDue < 0 ? `${Math.abs(project.daysUntilDue)}d overdue` : `${project.daysUntilDue}d left`}
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-xs">No due date</span>
                    )}
                    <span className="text-zinc-600 text-xs">{project.daysInPhase}d in phase</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); handleStatusUpdate(project) }}
                    disabled={generatingStatus && selectedProject?.id === project.id}
                    className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
                  >
                    📊 Status
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleGeneratePlan(project) }}
                    disabled={generatingPlan && selectedProject?.id === project.id}
                    className="text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 px-2 py-1 rounded transition-colors"
                  >
                    📋 Plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading states */}
      {(generatingStatus || generatingPlan) && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <span className="animate-spin">⏳</span>
          {generatingStatus ? 'Atlas is writing a status update...' : 'Generating project plan...'}
        </div>
      )}

      {/* Status update output */}
      {statusUpdate && selectedProject && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Status — {selectedProject.name}</span>
            <button onClick={() => navigator.clipboard.writeText(statusUpdate)} className="text-zinc-600 hover:text-indigo-400 text-xs">Copy ↗</button>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-zinc-300 text-xs leading-relaxed">{statusUpdate}</p>
          </div>
        </div>
      )}

      {/* Project plan output */}
      {plan && selectedProject && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Plan — {selectedProject.name}</span>
            <button onClick={() => navigator.clipboard.writeText(plan)} className="text-zinc-600 hover:text-indigo-400 text-xs">Copy ↗</button>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 max-h-64 overflow-y-auto">
            {renderMarkdown(plan)}
          </div>
        </div>
      )}
    </div>
  )
}
