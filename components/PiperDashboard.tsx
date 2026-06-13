'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  name: string
  stage: string
  type: string
  contact_name: string | null
  contact_email: string | null
  notes: string | null
  updated_at: string
  health: 'green' | 'yellow' | 'red'
}

interface StaleClient extends Client {
  daysInStage: number
}

interface LogEntry {
  id: string
  entry_type: string
  content: string
  created_by: string
  created_at: string
}

interface Props {
  stale: StaleClient[]
  allClients: Client[]
  stageCounts: Record<string, number>
  lastReport: { content: string; created_at: string } | null
  pendingApprovals: number
  pendingInbox: number
}

type Tab = 'pipeline' | 'contact-log' | 'task-piper' | 'report'

const stageColor: Record<string, string> = {
  Discovery:  'text-zinc-400 bg-zinc-800',
  Proposal:   'text-blue-400 bg-blue-950',
  Onboarding: 'text-amber-400 bg-amber-950',
  Active:     'text-emerald-400 bg-emerald-950',
}

const healthDot: Record<string, string> = {
  green:  'bg-emerald-400',
  yellow: 'bg-amber-400',
  red:    'bg-red-500',
}

const entryTypeIcon: Record<string, string> = {
  note:          '📝',
  email_sent:    '📤',
  email_received:'📨',
  call:          '📞',
  meeting:       '🤝',
  piper_action:  '🤖',
}

export default function PiperDashboard({ stale, allClients, stageCounts, lastReport, pendingApprovals, pendingInbox }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pipeline')

  // Pipeline tab state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [output, setOutput] = useState<{ type: string; text: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [runningHeartbeat, setRunningHeartbeat] = useState(false)
  const [heartbeatResult, setHeartbeatResult] = useState<string | null>(null)
  const [freshReport, setFreshReport] = useState<string | null>(null)

  // Contact log state
  const [logClientId, setLogClientId] = useState<string | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [savingNote, setSavingNote] = useState(false)

  // Task Piper state
  const [taskClientId, setTaskClientId] = useState('')
  const [taskRequest, setTaskRequest] = useState('')
  const [taskRunning, setTaskRunning] = useState(false)
  const [taskResult, setTaskResult] = useState<string | null>(null)
  const [taskApprovalCreated, setTaskApprovalCreated] = useState(false)

  async function generate(clientId: string, action: string) {
    setSelectedId(clientId)
    setOutput(null)
    setGenerating(true)
    const endpoint = action === 'suggest' ? '/api/piper/suggest' : `/api/piper/${action}`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })
    const data = await res.json()
    const text = data.email ?? data.checklist ?? data.suggestion ?? ''
    setOutput({ type: action, text })
    setGenerating(false)
  }

  async function runHeartbeat() {
    setRunningHeartbeat(true)
    setHeartbeatResult(null)
    const res = await fetch('/api/piper/heartbeat', { method: 'POST' })
    const data = await res.json()
    setFreshReport(data.report ?? null)
    setHeartbeatResult(`Pipeline report saved — ${data.staleCount} clients need attention.`)
    setRunningHeartbeat(false)
    setTab('report')
    router.refresh()
  }

  async function loadContactLog(clientId: string) {
    setLogClientId(clientId)
    setLoadingLog(true)
    const res = await fetch(`/api/piper/contact-log?clientId=${clientId}`)
    const data = await res.json()
    setLogEntries(data.entries ?? [])
    setLoadingLog(false)
  }

  async function saveNote() {
    if (!newNote.trim() || !logClientId) return
    setSavingNote(true)
    await fetch('/api/piper/contact-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: logClientId, entry_type: noteType, content: newNote.trim() }),
    })
    setNewNote('')
    await loadContactLog(logClientId)
    setSavingNote(false)
    router.refresh()
  }

  async function runTask() {
    if (!taskRequest.trim()) return
    setTaskRunning(true)
    setTaskResult(null)
    setTaskApprovalCreated(false)
    const res = await fetch('/api/piper/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: taskClientId || undefined, request: taskRequest }),
    })
    const data = await res.json()
    setTaskResult(data.task?.output ?? '')
    setTaskApprovalCreated(data.approvalCreated ?? false)
    setTaskRunning(false)
  }

  const reportContent = freshReport ?? lastReport?.content ?? null
  const reportDate = lastReport?.created_at
    ? new Date(lastReport.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const selectedClient = allClients.find(c => c.id === logClientId)

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤝</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Piper</h1>
            <p className="text-zinc-500 text-sm">Client Relations — pipeline health, follow-ups, onboarding</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {(pendingApprovals + pendingInbox) > 0 && (
            <a href="/approvals" className="bg-amber-600 hover:bg-amber-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
              ✋ {pendingApprovals + pendingInbox} pending approvals
            </a>
          )}
          <button
            onClick={runHeartbeat}
            disabled={runningHeartbeat}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {runningHeartbeat ? '💓 Generating...' : '💓 Weekly Report'}
          </button>
        </div>
      </div>

      {heartbeatResult && <p className="text-emerald-400 text-sm">{heartbeatResult}</p>}

      {/* Stage stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(stageCounts).map(([stage, count]) => (
          <div key={stage} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold font-mono ${stageColor[stage]?.split(' ')[0] ?? 'text-white'}`}>{count}</p>
            <p className="text-zinc-500 text-xs mt-1">{stage}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex-wrap">
        {([
          ['pipeline',    'Pipeline Health'],
          ['contact-log', 'Contact Log'],
          ['task-piper',  'Task Piper'],
          ['report',      'Weekly Report'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            {label}
            {t === 'pipeline' && stale.length > 0 && (
              <span className="ml-2 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">{stale.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Pipeline Health tab */}
      {tab === 'pipeline' && (
        <div className="flex flex-col gap-4">
          {stale.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-emerald-400 text-sm">✓ All {allClients.length} clients are on track</p>
            </div>
          ) : (
            <>
              <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">
                {stale.length} client{stale.length !== 1 ? 's' : ''} need attention
              </p>
              <div className="flex flex-col gap-3">
                {stale.map(client => (
                  <div
                    key={client.id}
                    className={`bg-zinc-900 border rounded-xl p-4 flex flex-col gap-3 ${selectedId === client.id ? 'border-indigo-700' : 'border-zinc-800'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${healthDot[client.health]}`} title={`Health: ${client.health}`} />
                          <p className="text-white font-semibold">{client.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor[client.stage] ?? 'text-zinc-400 bg-zinc-800'}`}>
                            {client.stage}
                          </span>
                          <span className="text-amber-400 text-xs">⏰ {client.daysInStage}d</span>
                        </div>
                        {client.contact_name && <p className="text-zinc-500 text-xs mt-0.5">{client.contact_name}</p>}
                        {client.notes && <p className="text-zinc-600 text-xs mt-1 line-clamp-1">{client.notes}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                        <button
                          onClick={() => generate(client.id, 'followup')}
                          disabled={generating && selectedId === client.id}
                          className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                          ✉️ Follow-up
                        </button>
                        <button
                          onClick={() => generate(client.id, 'suggest')}
                          disabled={generating && selectedId === client.id}
                          className="text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          💡 Suggest
                        </button>
                        <button
                          onClick={() => { setLogClientId(client.id); loadContactLog(client.id); setTab('contact-log') }}
                          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          📝 Log
                        </button>
                        {client.stage === 'Onboarding' && (
                          <button
                            onClick={() => generate(client.id, 'onboarding')}
                            disabled={generating && selectedId === client.id}
                            className="text-xs bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                          >
                            📋 Checklist
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedId === client.id && (
                      <>
                        {generating && (
                          <div className="flex items-center gap-2 text-zinc-500 text-xs">
                            <span className="animate-spin">⏳</span> Piper is thinking...
                          </div>
                        )}
                        {output && !generating && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">
                                {output.type === 'followup' ? 'Follow-up email' : output.type === 'onboarding' ? 'Onboarding checklist' : 'Stage suggestion'}
                              </span>
                              <button onClick={() => navigator.clipboard.writeText(output.text)} className="text-zinc-600 hover:text-indigo-400 text-xs">Copy ↗</button>
                            </div>
                            <div className="bg-zinc-800 rounded-lg p-3 max-h-64 overflow-y-auto">
                              <p className="text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed">{output.text}</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* All clients with health scores */}
          <div>
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-3">All Clients</p>
            <div className="flex flex-col gap-2">
              {allClients.map(client => (
                <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${healthDot[client.health]}`} title={`Health: ${client.health}`} />
                  <p className="text-white text-sm flex-1">{client.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor[client.stage] ?? 'text-zinc-400 bg-zinc-800'}`}>{client.stage}</span>
                  <button
                    onClick={() => { loadContactLog(client.id); setTab('contact-log') }}
                    className="text-zinc-600 hover:text-zinc-400 text-xs"
                  >
                    📝
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Log tab */}
      {tab === 'contact-log' && (
        <div className="flex flex-col gap-4">
          {/* Client picker */}
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Select Client</label>
            <select
              value={logClientId ?? ''}
              onChange={e => { setLogClientId(e.target.value); if (e.target.value) loadContactLog(e.target.value) }}
              className="w-full md:w-64 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">— pick a client —</option>
              {allClients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.stage})</option>
              ))}
            </select>
          </div>

          {logClientId && (
            <>
              {/* Add note */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Add Entry</p>
                <div className="flex gap-2">
                  <select
                    value={noteType}
                    onChange={e => setNoteType(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="note">📝 Note</option>
                    <option value="call">📞 Call</option>
                    <option value="meeting">🤝 Meeting</option>
                    <option value="email_sent">📤 Email Sent</option>
                    <option value="email_received">📨 Email Received</option>
                  </select>
                </div>
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="What happened? What was discussed? What are the next steps?"
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
                <button
                  onClick={saveNote}
                  disabled={savingNote || !newNote.trim()}
                  className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg w-fit transition-colors"
                >
                  {savingNote ? 'Saving...' : '+ Add Entry'}
                </button>
              </div>

              {/* Log entries */}
              {loadingLog ? (
                <p className="text-zinc-500 text-sm text-center py-4">Loading...</p>
              ) : logEntries.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  <p className="text-zinc-500 text-sm">No contact log entries yet for {selectedClient?.name}.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {logEntries.map(entry => (
                    <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{entryTypeIcon[entry.entry_type] ?? '📝'}</span>
                        <span className="text-zinc-400 text-xs capitalize">{entry.entry_type.replace(/_/g, ' ')}</span>
                        <span className="text-zinc-600 text-xs ml-auto">
                          {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {entry.created_by === 'piper' && (
                          <span className="text-indigo-400 text-xs">🤖 Piper</span>
                        )}
                      </div>
                      <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Task Piper tab */}
      {tab === 'task-piper' && (
        <div className="flex flex-col gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-white font-semibold mb-1">Task Piper</h2>
              <p className="text-zinc-500 text-sm">Pick a client (optional) and describe what you need. Piper will handle it.</p>
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Client (optional)</label>
              <select
                value={taskClientId}
                onChange={e => setTaskClientId(e.target.value)}
                className="w-full md:w-64 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">No specific client</option>
                {allClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.stage})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Request</label>
              <textarea
                value={taskRequest}
                onChange={e => setTaskRequest(e.target.value)}
                placeholder="e.g. 'Draft a proposal email for this client' or 'Summarize where we stand with this client' or 'Write a check-in message, it's been 2 weeks'"
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <button
              onClick={runTask}
              disabled={taskRunning || !taskRequest.trim()}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg w-fit transition-colors"
            >
              {taskRunning ? '🤖 Piper is working...' : '🤖 Run Task'}
            </button>
          </div>

          {taskResult && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Piper's output</p>
                <div className="flex items-center gap-3">
                  {taskApprovalCreated && (
                    <a href="/approvals" className="text-amber-400 text-xs hover:text-amber-300">✋ Approval created →</a>
                  )}
                  <button onClick={() => navigator.clipboard.writeText(taskResult)} className="text-zinc-600 hover:text-indigo-400 text-xs">Copy ↗</button>
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-h-96 overflow-y-auto">
                <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{taskResult}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setTaskRequest(''); setTaskResult(null); setTaskApprovalCreated(false) }} className="text-zinc-500 text-xs hover:text-zinc-300">Clear</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weekly Report tab */}
      {tab === 'report' && (
        <div className="flex flex-col gap-3">
          {reportContent ? (
            <>
              <div className="flex items-center justify-between">
                {reportDate && !freshReport && <p className="text-zinc-600 text-xs">Last generated: {reportDate}</p>}
                {freshReport && <p className="text-emerald-400 text-xs">✓ Just generated</p>}
                <button onClick={() => navigator.clipboard.writeText(reportContent)} className="text-zinc-600 hover:text-indigo-400 text-xs transition-colors ml-auto">Copy ↗</button>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-h-[600px] overflow-y-auto">
                {reportContent.split('\n').map((line, i) => {
                  if (line.startsWith('# '))  return <h2 key={i} className="text-white text-lg font-bold mb-3 mt-1">{line.slice(2)}</h2>
                  if (line.startsWith('## ')) return <h3 key={i} className="text-white text-sm font-semibold mt-4 mb-1">{line.slice(3)}</h3>
                  if (line.startsWith('- '))  return <p key={i} className="text-zinc-300 text-sm ml-3">• {line.slice(2)}</p>
                  if (line.trim() === '')     return <div key={i} className="h-2" />
                  return <p key={i} className="text-zinc-300 text-sm leading-relaxed">{line}</p>
                })}
              </div>
            </>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center flex flex-col items-center gap-3">
              <span className="text-3xl">💓</span>
              <p className="text-zinc-400 text-sm">No weekly report yet.</p>
              <button onClick={runHeartbeat} disabled={runningHeartbeat} className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                {runningHeartbeat ? 'Generating...' : 'Generate Now'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
