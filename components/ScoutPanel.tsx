'use client'

import { useState, useEffect } from 'react'
import { BUSINESS_CATEGORIES, SEARCH_CENTERS } from '@/lib/scout'
import { TARGET_JOB_ROLES } from '@/lib/scout-config'
import { useRouter } from 'next/navigation'

interface Lead {
  id: string
  name: string
  address: string
  phone: string | null
  website: string | null
  category: string
  rating: number | null
  review_count: number | null
  gmb_has_hours: boolean
  gmb_has_photos: boolean
  gmb_has_description: boolean
  has_website: boolean
  website_score: number | null
  grade: string
  score: number
  outreach_status: string
  outreach_email: string | null
  contact_email: string | null
  email_source: string | null
  social_facebook: string | null
  notes: string | null
}

const gradeColor: Record<string, string> = {
  A: 'bg-emerald-900 text-emerald-300 border-emerald-700',
  B: 'bg-amber-900 text-amber-300 border-amber-700',
  C: 'bg-zinc-800 text-zinc-400 border-zinc-700',
}

const statusColor: Record<string, string> = {
  new:        'bg-zinc-800 text-zinc-400',
  contacted:  'bg-blue-900 text-blue-300',
  responded:  'bg-purple-900 text-purple-300',
  converted:  'bg-emerald-900 text-emerald-300',
  dismissed:  'bg-zinc-900 text-zinc-600',
}

type PanelView = 'leads' | 'log'

interface OutreachEvent {
  lead_id: string
  name: string
  address: string
  category: string
  grade: string
  contact_email: string | null
  outreach_status: string
  email_type: 'initial' | 'followup1' | 'followup2'
  email_type_label: string
  sent_at: string
  body: string | null
  timestamp_estimated: boolean
}

const EMAIL_TYPE_STYLE: Record<string, string> = {
  initial:   'bg-indigo-950 text-indigo-300 border-indigo-800',
  followup1: 'bg-amber-950 text-amber-300 border-amber-800',
  followup2: 'bg-zinc-800 text-zinc-400 border-zinc-700',
}

export default function ScoutPanel() {
  const [view, setView] = useState<PanelView>('leads')
  // Outreach log state
  const [logEvents, setLogEvents] = useState<OutreachEvent[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<OutreachEvent | null>(null)
  const [logSince, setLogSince] = useState('') // ISO date filter

  const [searchMode, setSearchMode] = useState<'places' | 'linkedin'>('places')
  const [category, setCategory] = useState('restaurant')
  const [auditWebsites, setAuditWebsites] = useState(true)
  const [centerIndex, setCenterIndex] = useState(0)
  const [jobRole, setJobRole] = useState('social media manager')
  const [generateOutreach, setGenerateOutreach] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState<'new' | 'contacted' | 'responded' | 'converted' | 'dismissed'>('new')
  const [gradeFilter, setGradeFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [generatingOutreach, setGeneratingOutreach] = useState(false)
  const [converting, setConverting] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; channel: string; error?: string } | null>(null)
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [editingWebsite, setEditingWebsite] = useState(false)
  const [websiteInput, setWebsiteInput] = useState('')
  const [auditingWebsite, setAuditingWebsite] = useState(false)
  const [auditResult, setAuditResult] = useState<{ score: number; mobile: boolean } | null>(null)
  const router = useRouter()

  useEffect(() => { loadLeads() }, [filter, gradeFilter])
  useEffect(() => { if (view === 'log') loadLog() }, [view])

  async function loadLog() {
    setLogLoading(true)
    setSelectedEvent(null)
    const params = new URLSearchParams()
    if (logSince) params.set('since', new Date(logSince).toISOString())
    const res = await fetch(`/api/scout/outreach-log?${params}`)
    const data = await res.json()
    setLogEvents(data.events ?? [])
    setLogLoading(false)
  }

  async function loadLeads() {
    const params = new URLSearchParams({ status: filter, limit: '100' })
    if (gradeFilter !== 'all') params.set('grade', gradeFilter)
    const res = await fetch(`/api/scout/leads?${params}`)
    if (res.ok) setLeads(await res.json())
  }

  async function handleSearch() {
    setSearching(true)
    setSearchResult(null)
    try {
      if (searchMode === 'linkedin') {
        const res = await fetch('/api/scout/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: jobRole, generateOutreach }),
        })
        const data = await res.json()
        setSearchResult(`Found ${data.jobs?.length ?? 0} hiring companies · ${data.saved} saved · ${data.jobs?.filter((j: { grade: string }) => j.grade === 'A').length ?? 0} Grade A`)
      } else {
        const res = await fetch('/api/scout/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, audit: auditWebsites, center: SEARCH_CENTERS[centerIndex] }),
        })
        const data = await res.json()
        if (data.error) {
          setSearchResult(`Search failed: ${data.error}`)
          return
        }
        setSearchResult(`Found ${data.leads?.length ?? 0} businesses · ${data.saved} new leads saved · ${data.leads?.filter((l: Lead) => l.grade === 'A').length ?? 0} Grade A`)
      }
      await loadLeads()
      router.refresh()
    } catch (err) {
      setSearchResult(`Search failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSearching(false)
    }
  }

  async function handleGenerateOutreach(lead: Lead) {
    setGeneratingOutreach(true)
    const res = await fetch('/api/scout/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id }),
    })
    const data = await res.json()
    setSelectedLead({ ...lead, outreach_email: data.email })
    setGeneratingOutreach(false)
    await loadLeads()
  }

  async function handleSaveEmail(id: string, email: string) {
    if (!email.trim()) return
    const res = await fetch('/api/scout/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, contact_email: email.trim() }),
    })
    if (res.ok) {
      const updated = await res.json()
      setSelectedLead(prev => prev ? {
        ...prev,
        contact_email: (updated as { contact_email: string }).contact_email,
        email_source: 'manual'
      } : null)
      setEditingEmail(false)
      setEmailInput('')
      await loadLeads()
    }
  }

  async function handleAuditWebsite(id: string, website: string) {
    if (!website.trim()) return
    setAuditingWebsite(true)
    setAuditResult(null)
    const res = await fetch('/api/scout/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, website: website.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setAuditResult(data.audit)
      setSelectedLead(data.lead as Lead)
      setEditingWebsite(false)
      setWebsiteInput('')
      await loadLeads()
    }
    setAuditingWebsite(false)
  }

  async function handleStatusUpdate(id: string, status: string) {
    await fetch('/api/scout/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, outreach_status: status }),
    })
    await loadLeads()
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, outreach_status: status } : null)
  }

  function getBestChannel(lead: Lead): { channel: string; label: string; icon: string } {
    if (lead.contact_email) return { channel: 'email', label: `Email ${lead.contact_email}`, icon: '✉️' }
    if (lead.website) return { channel: 'contact_form', label: 'Submit Contact Form', icon: '📝' }
    if (lead.social_facebook) return { channel: 'facebook', label: 'Facebook Messenger', icon: '💬' }
    return { channel: 'manual', label: 'Manual outreach required', icon: '⚠️' }
  }

  async function handleSend(lead: Lead) {
    setSending(true)
    setSendResult(null)
    const res = await fetch('/api/scout/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id }),
    })
    const data = await res.json()
    setSendResult(data)
    if (data.success) {
      setSelectedLead(prev => prev ? { ...prev, outreach_status: 'contacted' } : null)
      await loadLeads()
      router.refresh()
    }
    setSending(false)
  }

  async function handleConvert(lead: Lead) {
    setConverting(true)
    const res = await fetch('/api/scout/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id }),
    })
    if (res.ok) {
      setSelectedLead(null)
      await loadLeads()
      router.refresh()
    }
    setConverting(false)
  }

  return (
    <div className="flex flex-col gap-4">
    {/* View toggle */}
    <div className="flex gap-1 border-b border-zinc-800 -mb-2">
      {([
        { key: 'leads', label: '🔭 Leads' },
        { key: 'log',   label: '📬 Outreach Log' },
      ] as { key: PanelView; label: string }[]).map(v => (
        <button key={v.key} onClick={() => setView(v.key)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${view === v.key ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}>
          {v.label}
        </button>
      ))}
    </div>

    {/* ── OUTREACH LOG VIEW ── */}
    {view === 'log' && (
      <div className="flex flex-col gap-4">
        {/* Filters */}
        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-zinc-500 text-xs">Since:</label>
          <input type="date" value={logSince} onChange={e => setLogSince(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500" />
          <button onClick={loadLog} disabled={logLoading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
            {logLoading ? 'Loading...' : '↺ Refresh'}
          </button>
          {logEvents.length > 0 && (
            <span className="text-zinc-500 text-xs ml-2">{logEvents.length} emails sent</span>
          )}
        </div>

        {logLoading ? (
          <p className="text-zinc-500 text-sm text-center py-12">Loading outreach log…</p>
        ) : logEvents.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">No emails sent yet in this date range.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Event list */}
            <div className="flex flex-col gap-2 max-h-[700px] overflow-y-auto pr-1">
              {logEvents.map((evt, i) => {
                const sentDate = new Date(evt.sent_at)
                const isToday = sentDate.toDateString() === new Date().toDateString()
                const isSelected = selectedEvent?.lead_id === evt.lead_id && selectedEvent?.email_type === evt.email_type
                return (
                  <div key={`${evt.lead_id}-${evt.email_type}-${i}`}
                    onClick={() => setSelectedEvent(evt)}
                    className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-colors hover:border-indigo-700 ${isSelected ? 'border-indigo-600' : 'border-zinc-800'}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-white text-sm font-medium leading-tight">{evt.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${gradeColor[evt.grade]}`}>{evt.grade}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded border ${EMAIL_TYPE_STYLE[evt.email_type]}`}>
                        {evt.email_type_label}
                      </span>
                      <span className={`text-xs ${isToday ? 'text-emerald-400 font-medium' : 'text-zinc-500'}`}>
                        {isToday ? 'Today ' : ''}{sentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {sentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        {evt.timestamp_estimated && <span className="text-zinc-600 ml-1">(est.)</span>}
                      </span>
                    </div>
                    <p className="text-zinc-600 text-xs mt-1 truncate">
                      {evt.contact_email ? `✉️ ${evt.contact_email}` : '📝 Contact form'}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Email preview */}
            <div className="sticky top-4">
              {selectedEvent ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-white font-semibold text-sm">{selectedEvent.name}</h3>
                      <p className="text-zinc-500 text-xs mt-0.5">{selectedEvent.address}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${gradeColor[selectedEvent.grade]}`}>{selectedEvent.grade}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded border ${EMAIL_TYPE_STYLE[selectedEvent.email_type]}`}>
                      {selectedEvent.email_type_label}
                    </span>
                    <span className="text-zinc-500 text-xs">{selectedEvent.email_type_label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500">Sent:</span>
                    <span className="text-zinc-300">
                      {new Date(selectedEvent.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                      {selectedEvent.timestamp_estimated && <span className="text-zinc-600 ml-1">— timestamp estimated from last update (sent before tracking was added)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500">To:</span>
                    <span className="text-zinc-300">{selectedEvent.contact_email ?? 'Contact form submission'}</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-3">
                    <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">Email Body</p>
                    {selectedEvent.body ? (
                      <div className="bg-zinc-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{selectedEvent.body}</p>
                      </div>
                    ) : (
                      <p className="text-zinc-600 text-sm italic">Email body not saved.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500">Current status:</span>
                    <span className={`px-2 py-0.5 rounded-full ${statusColor[selectedEvent.outreach_status]}`}>
                      {selectedEvent.outreach_status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <p className="text-zinc-600 text-sm">Select an email to read it.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )}

    {/* ── LEADS VIEW ── */}
    {view === 'leads' &&
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left — Search + filters */}
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">🔭 Prospect Search</h3>

          <div className="flex flex-col gap-3">
            {/* Mode toggle */}
            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setSearchMode('places')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${searchMode === 'places' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                📍 Google Places
              </button>
              <button
                onClick={() => setSearchMode('linkedin')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${searchMode === 'linkedin' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                💼 LinkedIn Jobs
              </button>
            </div>

            {searchMode === 'places' ? (
              <>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Search Area</label>
                  <select
                    value={centerIndex}
                    onChange={e => setCenterIndex(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {SEARCH_CENTERS.map((c, i) => (
                      <option key={c.label} value={i}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Business Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {BUSINESS_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={auditWebsites} onChange={e => setAuditWebsites(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-zinc-400 text-sm">Audit websites (slower)</span>
                </label>
              </>
            ) : (
              <>
                <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-lg p-3">
                  <p className="text-indigo-300 text-xs leading-relaxed">
                    💼 Finds Indiana businesses currently hiring — then enriches with Google Places for contact info. Strong outreach hook: <em>"I noticed you're hiring a {"{role}"}..."</em>
                  </p>
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Hiring Role to Target</label>
                  <select
                    value={jobRole}
                    onChange={e => setJobRole(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {TARGET_JOB_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={generateOutreach} onChange={e => setGenerateOutreach(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-zinc-400 text-sm">Auto-generate outreach emails</span>
                </label>
              </>
            )}

            <button
              onClick={handleSearch}
              disabled={searching}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors font-medium"
            >
              {searching ? '🔍 Searching...' : '🔍 Search for Leads'}
            </button>

            {searchResult && (
              <p className="text-emerald-400 text-xs">{searchResult}</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-zinc-400 text-xs font-mono uppercase tracking-widest mb-3">Filter Leads</h3>
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-zinc-600 text-xs mb-1">Status</p>
              <div className="flex flex-wrap gap-1">
                {(['new', 'contacted', 'responded', 'converted', 'dismissed'] as const).map(s => (
                  <button key={s} onClick={() => setFilter(s)}
                    className={`text-xs px-2 py-1 rounded-md capitalize transition-colors ${filter === s ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-zinc-600 text-xs mb-1">Grade</p>
              <div className="flex gap-1">
                {(['all', 'A', 'B', 'C'] as const).map(g => (
                  <button key={g} onClick={() => setGradeFilter(g)}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${gradeFilter === g ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center — Lead list */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-semibold text-sm">{leads.length} leads</h3>
        </div>
        <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto">
          {leads.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-zinc-600 text-sm">No leads found. Run a search to prospect.</p>
            </div>
          ) : (
            leads.map(lead => (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-colors hover:border-indigo-700 ${selectedLead?.id === lead.id ? 'border-indigo-600' : 'border-zinc-800'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-white text-sm font-medium leading-tight">{lead.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded border font-bold flex-shrink-0 ${gradeColor[lead.grade]}`}>
                    {lead.grade}
                  </span>
                </div>
                <p className="text-zinc-500 text-xs truncate mb-2">{lead.address}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[lead.outreach_status]}`}>
                    {lead.outreach_status}
                  </span>
                  {!lead.has_website && <span className="text-xs text-rose-400">No website</span>}
                  {lead.contact_email
                    ? <span className="text-xs text-emerald-400">✉️ Email found</span>
                    : <span className="text-xs text-zinc-600">No email</span>}
                  {lead.rating && <span className="text-xs text-zinc-500">⭐ {lead.rating}</span>}
                  {lead.website_score && (
                    <span className={`text-xs ${lead.website_score < 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      PageSpeed: {lead.website_score}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right — Lead detail */}
      <div>
        {selectedLead ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 sticky top-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold">{selectedLead.name}</h3>
                <p className="text-zinc-500 text-xs mt-0.5">{selectedLead.category.replace(/_/g, ' ')}</p>
              </div>
              <span className={`text-sm px-3 py-1 rounded border font-bold ${gradeColor[selectedLead.grade]}`}>
                Grade {selectedLead.grade}
              </span>
            </div>

            {/* Details */}
            <div className="flex flex-col gap-1.5 text-xs">
              <p className="text-zinc-400">📍 {selectedLead.address}</p>
              {selectedLead.phone && <p className="text-zinc-400">📞 {selectedLead.phone}</p>}
              {selectedLead.website ? (
                <div className="flex items-center gap-2">
                  <a href={selectedLead.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 truncate">🌐 {selectedLead.website}</a>
                  <button onClick={() => { setEditingWebsite(true); setWebsiteInput(selectedLead.website ?? '') }}
                    className="text-zinc-600 hover:text-zinc-400 text-xs">edit</button>
                </div>
              ) : (
                <button onClick={() => { setEditingWebsite(true); setWebsiteInput('') }}
                  className="text-zinc-600 hover:text-amber-400 text-xs flex items-center gap-1">
                  🌐 <span>No website — add manually</span>
                </button>
              )}

              {editingWebsite && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={websiteInput}
                      onChange={e => setWebsiteInput(e.target.value)}
                      placeholder="https://business.com"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleAuditWebsite(selectedLead.id, websiteInput)}
                      disabled={auditingWebsite || !websiteInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                    >
                      {auditingWebsite ? '⏳ Auditing...' : '🔍 Save & Audit'}
                    </button>
                    <button onClick={() => setEditingWebsite(false)}
                      className="bg-zinc-800 text-zinc-400 text-xs px-2 py-1 rounded">✕</button>
                  </div>
                  <p className="text-zinc-600 text-xs">Will run PageSpeed audit and regenerate outreach email.</p>
                </div>
              )}

              {auditResult && selectedLead.website && (
                <div className="bg-zinc-800 rounded-lg px-3 py-2 flex items-center gap-3 text-xs">
                  <span className={auditResult.score < 50 ? 'text-rose-400' : auditResult.score < 70 ? 'text-amber-400' : 'text-emerald-400'}>
                    PageSpeed: {auditResult.score}
                  </span>
                  <span className={auditResult.mobile ? 'text-emerald-400' : 'text-rose-400'}>
                    Mobile: {auditResult.mobile ? '✓' : '✗'}
                  </span>
                  <span className="text-zinc-500">✓ Outreach regenerated</span>
                </div>
              )}
              {selectedLead.rating && <p className="text-zinc-400">⭐ {selectedLead.rating} ({selectedLead.review_count} reviews)</p>}

              {/* Email */}
              <div className="flex items-center gap-2">
                {selectedLead.contact_email ? (
                  <>
                    <span className="text-emerald-400">✉️ {selectedLead.contact_email}</span>
                    {selectedLead.email_source && (
                      <span className="text-zinc-600 text-xs">({selectedLead.email_source})</span>
                    )}
                    <button onClick={() => { setEditingEmail(true); setEmailInput(selectedLead.contact_email ?? '') }}
                      className="text-zinc-600 hover:text-zinc-400 text-xs">edit</button>
                  </>
                ) : (
                  <button onClick={() => { setEditingEmail(true); setEmailInput('') }}
                    className="text-zinc-600 hover:text-amber-400 text-xs flex items-center gap-1">
                    ✉️ <span>No email found — add manually</span>
                  </button>
                )}
              </div>

              {editingEmail && (
                <div className="flex gap-2 mt-1">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="contact@business.com"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button onClick={() => handleSaveEmail(selectedLead.id, emailInput)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded">Save</button>
                  <button onClick={() => setEditingEmail(false)}
                    className="bg-zinc-800 text-zinc-400 text-xs px-2 py-1 rounded">Cancel</button>
                </div>
              )}
            </div>

            {/* GMB checklist */}
            <div className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-1">
              <p className="text-zinc-400 text-xs font-semibold mb-1">Google Business Profile</p>
              {[
                { label: 'Has hours',      val: selectedLead.gmb_has_hours },
                { label: 'Has photos',     val: selectedLead.gmb_has_photos },
                { label: 'Has description', val: selectedLead.gmb_has_description },
                { label: 'Has website',    val: selectedLead.has_website },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className={item.val ? 'text-emerald-400' : 'text-rose-400'}>{item.val ? '✓' : '✗'}</span>
                  <span className="text-zinc-400 text-xs">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Status actions */}
            <div className="flex flex-wrap gap-1">
              {['new', 'contacted', 'responded', 'dismissed'].map(s => (
                <button key={s} onClick={() => handleStatusUpdate(selectedLead.id, s)}
                  className={`text-xs px-2 py-1 rounded-md capitalize transition-colors ${selectedLead.outreach_status === s ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>

            {/* Outreach email */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleGenerateOutreach(selectedLead)}
                disabled={generatingOutreach}
                className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm py-2 rounded-lg transition-colors"
              >
                {generatingOutreach ? '✍️ Writing email...' : selectedLead.outreach_email ? '✍️ Regenerate Outreach Email' : '✍️ Generate Outreach Email'}
              </button>

              {selectedLead.outreach_email && (
                <div className="bg-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <p className="text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed">{selectedLead.outreach_email}</p>
                </div>
              )}

              {/* Send button */}
              {selectedLead.outreach_email && selectedLead.outreach_status !== 'contacted' && (() => {
                const best = getBestChannel(selectedLead)
                return best.channel !== 'manual' ? (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleSend(selectedLead)}
                      disabled={sending}
                      className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      {sending ? '📤 Sending...' : <>{best.icon} Send via {best.channel === 'email' ? 'Gmail' : best.channel === 'contact_form' ? 'Contact Form' : 'Facebook'}</>}
                    </button>
                    <p className="text-zinc-600 text-xs text-center">{best.label}</p>
                  </div>
                ) : (
                  <p className="text-amber-500 text-xs text-center">⚠️ No automated channel available — outreach manually</p>
                )
              })()}

              {sendResult && (
                <p className={`text-xs text-center ${sendResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {sendResult.success ? `✓ Sent via ${sendResult.channel} — lead marked as contacted` : `✗ ${sendResult.error}`}
                </p>
              )}
            </div>

            {/* Convert to client */}
            {selectedLead.outreach_status !== 'converted' && (
              <button
                onClick={() => handleConvert(selectedLead)}
                disabled={converting}
                className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors font-medium"
              >
                {converting ? 'Converting...' : '🤝 Send to Piper → Add to Pipeline'}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-600 text-sm">Select a lead to view details and generate outreach.</p>
          </div>
        )}
      </div>
    </div>
    } {/* end leads view */}
    </div>
  )
}
