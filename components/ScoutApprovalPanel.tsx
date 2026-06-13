'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface PendingLead {
  id: string
  name: string
  address: string
  category: string
  grade: string
  score: number
  contact_email: string | null
  website: string | null
  social_facebook: string | null
  outreach_email: string | null
  website_score: number | null
  has_website: boolean
}

const gradeColor: Record<string, string> = {
  A: 'bg-emerald-900 text-emerald-300 border-emerald-700',
  B: 'bg-amber-900 text-amber-300 border-amber-700',
  C: 'bg-zinc-800 text-zinc-400 border-zinc-700',
}

export default function ScoutApprovalPanel() {
  const [leads, setLeads] = useState<PendingLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PendingLead | null>(null)
  const [editedEmail, setEditedEmail] = useState('')
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ id: string; success: boolean; message: string } | null>(null)
  const router = useRouter()

  useEffect(() => { loadPending() }, [])

  async function loadPending() {
    setLoading(true)
    const res = await fetch('/api/scout/approve')
    if (res.ok) setLeads(await res.json())
    setLoading(false)
  }

  function selectLead(lead: PendingLead) {
    setSelected(lead)
    setEditedEmail(lead.outreach_email ?? '')
    setEditing(false)
    setResult(null)
  }

  function getChannel(lead: PendingLead): { label: string; icon: string; available: boolean } {
    if (lead.contact_email) return { label: `Email: ${lead.contact_email}`, icon: '✉️', available: true }
    if (lead.website) return { label: 'Contact Form', icon: '📝', available: true }
    if (lead.social_facebook) return { label: 'Facebook Messenger', icon: '💬', available: true }
    return { label: 'No channel available', icon: '⚠️', available: false }
  }

  async function handleAction(action: 'approve' | 'dismiss') {
    if (!selected) return
    setSending(true)
    setResult(null)

    const res = await fetch('/api/scout/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        action,
        editedEmail: editing ? editedEmail : undefined,
      }),
    })
    const data = await res.json()

    if (action === 'dismiss') {
      setResult({ id: selected.id, success: true, message: `Dismissed — ${selected.name} will be skipped.` })
    } else {
      setResult({
        id: selected.id,
        success: data.success,
        message: data.success
          ? `✓ Sent via ${data.channel} to ${selected.name}`
          : `✗ Failed: ${data.error}`,
      })
    }

    // Remove from pending list
    setLeads(prev => prev.filter(l => l.id !== selected.id))
    setSelected(null)
    setSending(false)
    router.refresh()
  }

  async function handleApproveAll() {
    if (!confirm(`Send outreach to all ${leads.length} pending leads?`)) return
    setSending(true)
    let sent = 0
    let failed = 0
    for (const lead of leads) {
      const res = await fetch('/api/scout/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) sent++
      else failed++
    }
    setLeads([])
    setSelected(null)
    setResult({ id: 'all', success: true, message: `Sent ${sent} emails. ${failed > 0 ? failed + ' failed.' : ''}` })
    setSending(false)
    router.refresh()
  }

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p className="text-zinc-600 text-sm">Loading pending approvals...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            ✋ Pending Approval
            {leads.length > 0 && (
              <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">{leads.length}</span>
            )}
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">Review Scout's outreach emails before they go out</p>
        </div>
        {leads.length > 1 && (
          <button
            onClick={handleApproveAll}
            disabled={sending}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            ✓ Approve All ({leads.length})
          </button>
        )}
      </div>

      {result && (
        <p className={`text-xs ${result.success ? 'text-emerald-400' : 'text-rose-400'}`}>{result.message}</p>
      )}

      {leads.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
          <p className="text-zinc-600 text-sm">✓ No emails pending approval. Scout will notify you when new outreach is ready.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lead list */}
          <div className="flex flex-col gap-2">
            {leads.map(lead => {
              const channel = getChannel(lead)
              return (
                <div
                  key={lead.id}
                  onClick={() => selectLead(lead)}
                  className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-colors hover:border-indigo-700 ${selected?.id === lead.id ? 'border-indigo-600' : 'border-zinc-800'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-white text-sm font-medium">{lead.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded border font-bold flex-shrink-0 ${gradeColor[lead.grade]}`}>
                      {lead.grade}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs truncate mb-1">{lead.address}</p>
                  <p className={`text-xs ${channel.available ? 'text-zinc-600' : 'text-amber-600'}`}>{channel.icon} {channel.label}</p>
                </div>
              )
            })}
          </div>

          {/* Email preview + actions */}
          {selected ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 sticky top-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{selected.name}</p>
                  <p className="text-zinc-500 text-xs">{getChannel(selected).icon} {getChannel(selected).label}</p>
                </div>
                <button
                  onClick={() => setEditing(e => !e)}
                  className="text-zinc-500 hover:text-indigo-400 text-xs transition-colors"
                >
                  {editing ? 'Cancel edit' : '✏️ Edit'}
                </button>
              </div>

              {/* Email body */}
              {editing ? (
                <textarea
                  value={editedEmail}
                  onChange={e => setEditedEmail(e.target.value)}
                  rows={10}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-300 text-xs focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              ) : (
                <div className="bg-zinc-800 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <p className="text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed">
                    {selected.outreach_email ?? 'No email generated yet.'}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {getChannel(selected).available ? (
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={sending || !selected.outreach_email}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors font-medium"
                  >
                    {sending ? 'Sending...' : '✓ Approve & Send'}
                  </button>
                ) : (
                  <div className="flex-1 bg-zinc-800 text-zinc-600 text-sm py-2.5 rounded-lg text-center">
                    No send channel available
                  </div>
                )}
                <button
                  onClick={() => handleAction('dismiss')}
                  disabled={sending}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-400 text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-zinc-600 text-sm">Select a lead to review its email.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
