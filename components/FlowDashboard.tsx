'use client'

import { useState, useEffect } from 'react'

interface Stage {
  id: string
  name: string
  position: number
}

interface Opportunity {
  id: string
  name: string
  contactId: string
  pipelineStageId: string
  status: string
  monetaryValue?: number
  contact?: { name: string; email: string }
}

interface Pipeline {
  id: string
  name: string
  stages: Stage[]
  opportunities: Opportunity[]
}

interface Workflow {
  id: string
  name: string
  status: string
}

interface GHLContact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  companyName?: string
  tags: string[]
  source?: string
  dateAdded: string
}

interface ScoutLead {
  id: string
  name: string
  email: string
  company: string | null
  grade: string
  approval_status: string
  ghl_contact_id: string | null
}

export default function FlowDashboard() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [leads, setLeads] = useState<ScoutLead[]>([])
  const [contacts, setContacts] = useState<GHLContact[]>([])
  const [contactTotal, setContactTotal] = useState(0)
  const [contactSearch, setContactSearch] = useState('')
  const [contactsLoading, setContactsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pipelines' | 'workflows' | 'contacts' | 'scout'>('pipelines')

  // Push lead state
  const [selectedLead, setSelectedLead] = useState('')
  const [selectedPipeline, setSelectedPipeline] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [pRes, wRes, lRes] = await Promise.all([
        fetch('/api/flow/pipelines'),
        fetch('/api/flow/workflows'),
        fetch('/api/flow/leads'),
      ])
      if (pRes.ok) { const d = await pRes.json(); setPipelines(d.pipelines ?? []) }
      if (wRes.ok) { const d = await wRes.json(); setWorkflows(d.workflows ?? []) }
      if (lRes.ok) { const d = await lRes.json(); setLeads(Array.isArray(d) ? d : (d.leads ?? [])) }
      setLoading(false)
    }
    load()
  }, [])

  async function loadContacts(query?: string) {
    setContactsLoading(true)
    const url = `/api/flow/contacts?limit=50${query ? `&query=${encodeURIComponent(query)}` : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const d = await res.json()
      setContacts(d.contacts ?? [])
      setContactTotal(d.total ?? 0)
    }
    setContactsLoading(false)
  }

  const activePipeline = pipelines.find(p => p.id === selectedPipeline)

  async function pushLead(leadId?: string) {
    const id = leadId ?? selectedLead
    if (!id || !selectedPipeline || !selectedStage) return
    setSelectedLead(id)
    setPushing(true)
    setPushResult(null)
    const res = await fetch('/api/flow/push-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: id, pipelineId: selectedPipeline, stageId: selectedStage }),
    })
    const data = await res.json()
    if (data.ok) {
      setPushResult(`✅ Pushed to GHL — Contact ID: ${data.contactId}`)
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ghl_contact_id: data.contactId } : l))
    } else {
      setPushResult(`❌ Failed: ${data.error ?? 'Unknown error'}`)
    }
    setPushing(false)
  }

  const statusColor = (s: string) =>
    s === 'published' || s === 'active' ? 'text-emerald-400' :
    s === 'draft' ? 'text-amber-400' : 'text-zinc-500'

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🌊</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Flow</h1>
          <p className="text-zinc-500 text-sm">GHL Funnel & Marketing Automation</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">Pipelines</p>
          <p className="text-white text-2xl font-bold">{pipelines.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">Workflows</p>
          <p className="text-white text-2xl font-bold">{workflows.length}</p>
          <p className="text-emerald-400 text-xs">{workflows.filter(w => w.status === 'published').length} active</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">Approved Leads</p>
          <p className="text-white text-2xl font-bold">{leads.length}</p>
          <p className="text-amber-400 text-xs">{leads.filter(l => !l.ghl_contact_id).length} not in GHL</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-0">
        {(['pipelines', 'workflows', 'contacts', 'scout'] as const).map(t => (
          <button key={t} onClick={() => {
            setActiveTab(t)
            if (t === 'contacts' && contacts.length === 0) loadContacts()
          }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            {t === 'contacts'
              ? `GHL Contacts${contactTotal ? ` (${contactTotal.toLocaleString()})` : ''}`
              : t === 'scout'
              ? `Scout Leads (${leads.length})`
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="text-zinc-500 text-sm text-center py-8">Loading GHL data...</p>}

      {/* Pipelines tab */}
      {!loading && activeTab === 'pipelines' && (
        <div className="flex flex-col gap-6">
          {pipelines.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">No pipelines found. Make sure GHL_API_KEY and GHL_LOCATION_ID are set.</p>
          )}
          {pipelines.map(p => (
            <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">{p.name}</h3>
                <span className="text-zinc-500 text-xs">{p.opportunities.length} opportunities</span>
              </div>
              {/* Kanban-style stage columns */}
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(p.stages?.length ?? 1, 5)}, 1fr)` }}>
                {(p.stages ?? []).sort((a, b) => a.position - b.position).map(stage => {
                  const stageOpps = p.opportunities.filter(o => o.pipelineStageId === stage.id)
                  return (
                    <div key={stage.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs font-semibold uppercase mb-2 truncate">{stage.name}</p>
                      <p className="text-white text-lg font-bold">{stageOpps.length}</p>
                      {stageOpps.slice(0, 3).map(o => (
                        <div key={o.id} className="mt-2 text-xs text-zinc-500 truncate">{o.name}</div>
                      ))}
                      {stageOpps.length > 3 && <p className="text-xs text-zinc-600 mt-1">+{stageOpps.length - 3} more</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workflows tab */}
      {!loading && activeTab === 'workflows' && (
        <div className="flex flex-col gap-3">
          {workflows.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">No workflows found in this GHL location.</p>
          )}
          {workflows.map(w => (
            <div key={w.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{w.name}</p>
                <p className="text-zinc-600 text-xs font-mono">{w.id}</p>
              </div>
              <span className={`text-xs font-semibold capitalize ${statusColor(w.status)}`}>{w.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Contacts tab */}
      {activeTab === 'contacts' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Search contacts by name, email, or company..."
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadContacts(contactSearch)}
              className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-4 py-2 placeholder-zinc-500"
            />
            <button onClick={() => loadContacts(contactSearch)}
              disabled={contactsLoading}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              {contactsLoading ? 'Searching...' : 'Search'}
            </button>
            {contactSearch && (
              <button onClick={() => { setContactSearch(''); loadContacts() }}
                className="text-zinc-500 hover:text-zinc-300 text-sm px-3 py-2">
                Clear
              </button>
            )}
          </div>

          {contactsLoading && <p className="text-zinc-500 text-sm text-center py-8">Loading contacts...</p>}

          {!contactsLoading && contacts.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">No contacts found.</p>
          )}

          {!contactsLoading && contacts.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Name</th>
                    <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Email</th>
                    <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Company</th>
                    <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Tags</th>
                    <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={c.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950'}`}>
                      <td className="px-4 py-3 text-white font-medium">{c.firstName} {c.lastName}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.email}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.companyName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags ?? []).slice(0, 3).map(tag => (
                            <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                          {(c.tags ?? []).length > 3 && <span className="text-xs text-zinc-600">+{c.tags.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{new Date(c.dateAdded).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Scout Leads tab */}
      {!loading && activeTab === 'scout' && (
        <div className="flex flex-col gap-4">
          {/* Pipeline + Stage selectors at top */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1.5 flex-1 min-w-40">
              <label className="text-zinc-500 text-xs font-semibold uppercase">Pipeline</label>
              <select value={selectedPipeline} onChange={e => { setSelectedPipeline(e.target.value); setSelectedStage('') }}
                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2">
                <option value="">Select pipeline...</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {activePipeline && (
              <div className="flex flex-col gap-1.5 flex-1 min-w-40">
                <label className="text-zinc-500 text-xs font-semibold uppercase">Stage</label>
                <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2">
                  <option value="">Select stage...</option>
                  {(activePipeline.stages ?? []).sort((a, b) => a.position - b.position).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-zinc-600 text-xs self-end pb-2">
              {leads.filter(l => l.ghl_contact_id).length} of {leads.length} already in GHL
            </p>
          </div>

          {pushResult && (
            <p className="text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3">{pushResult}</p>
          )}

          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Name</th>
                  <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Email</th>
                  <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Company</th>
                  <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">Grade</th>
                  <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3">GHL Status</th>
                  <th className="text-left text-zinc-500 text-xs font-semibold uppercase px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l, i) => (
                  <tr key={l.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950'}`}>
                    <td className="px-4 py-3 text-white font-medium">{l.name}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{l.email}</td>
                    <td className="px-4 py-3 text-zinc-400">{l.company ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${l.grade === 'A' ? 'text-emerald-400' : l.grade === 'B' ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {l.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {l.ghl_contact_id
                        ? <span className="text-xs text-emerald-400 font-medium">✓ In GHL</span>
                        : <span className="text-xs text-zinc-600">Not pushed</span>}
                    </td>
                    <td className="px-4 py-3">
                      {!l.ghl_contact_id && (
                        <button
                          disabled={pushing || !selectedPipeline || !selectedStage}
                          onClick={() => pushLead(l.id)}
                          className="text-xs bg-indigo-800 hover:bg-indigo-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {pushing && selectedLead === l.id ? 'Pushing...' : '🌊 Push'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
