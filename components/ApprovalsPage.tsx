'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Approval {
  id: string
  client_id: string | null
  lead_id: string | null
  client_name: string | null
  lead_name: string | null
  approval_type: string
  to_email: string | null
  to_name: string | null
  subject: string | null
  body: string
  status: string
  created_at: string
}

interface InboxItem {
  id: string
  lead_id: string
  lead_name: string | null
  sender_email: string
  subject: string | null
  body: string | null
  reply_draft: string | null
  status: string
  received_at: string
}

const typeColor: Record<string, string> = {
  followup:    'text-indigo-400 bg-indigo-950',
  nurture:     'text-purple-400 bg-purple-950',
  task_output: 'text-blue-400 bg-blue-950',
}

const typeLabel: Record<string, string> = {
  followup:    '✉️ Follow-up',
  nurture:     '🌱 Nurture',
  task_output: '🤖 Task Output',
}

export default function ApprovalsPage({ approvals: initialApprovals, inbox: initialInbox }: {
  approvals: Approval[]
  inbox: InboxItem[]
}) {
  const router = useRouter()
  const [approvals, setApprovals] = useState(initialApprovals)
  const [inbox, setInbox] = useState(initialInbox)
  const [sending, setSending] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedBody, setEditedBody] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'emails' | 'inbox'>('emails')

  const totalPending = approvals.length + inbox.filter(i => i.status === 'pending').length

  async function sendApproval(id: string, body?: string) {
    setSending(id)
    if (body) {
      await fetch('/api/piper/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, body }),
      })
    }
    const res = await fetch(`/api/piper/approvals/${id}/send`, { method: 'POST' })
    if (res.ok) {
      setApprovals(prev => prev.filter(a => a.id !== id))
      setEditingId(null)
    } else {
      const data = await res.json()
      alert(data.error ?? 'Failed to send')
    }
    setSending(null)
    router.refresh()
  }

  async function rejectApproval(id: string) {
    await fetch('/api/piper/approvals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'rejected' }),
    })
    setApprovals(prev => prev.filter(a => a.id !== id))
  }

  async function dismissInbox(id: string) {
    await fetch('/api/piper/lead-inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'dismissed' }),
    })
    setInbox(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">✋</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Approvals</h1>
          <p className="text-zinc-500 text-sm">All pending agent actions waiting for your sign-off</p>
        </div>
        {totalPending > 0 && (
          <span className="ml-auto bg-amber-600 text-white text-sm px-3 py-1 rounded-full font-medium">
            {totalPending} pending
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {([['emails', '✉️ Emails'], ['inbox', '📬 Lead Inbox']] as ['emails' | 'inbox', string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            {label}
            {t === 'emails' && approvals.length > 0 && (
              <span className="ml-2 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">{approvals.length}</span>
            )}
            {t === 'inbox' && inbox.length > 0 && (
              <span className="ml-2 bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">{inbox.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Emails tab */}
      {tab === 'emails' && (
        <div className="flex flex-col gap-3">
          {approvals.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-emerald-400 text-sm">✓ No pending email approvals</p>
            </div>
          ) : (
            approvals.map(approval => (
              <div key={approval.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {/* Header row */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor[approval.approval_type] ?? 'text-zinc-400 bg-zinc-800'}`}>
                        {typeLabel[approval.approval_type] ?? approval.approval_type}
                      </span>
                      <span className="text-white text-sm font-medium">
                        {approval.client_name ?? approval.lead_name ?? approval.to_name ?? 'Unknown'}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">To: {approval.to_email ?? 'no email'}</p>
                    {approval.subject && <p className="text-zinc-600 text-xs">Subject: {approval.subject}</p>}
                  </div>
                  <span className="text-zinc-600 text-xs flex-shrink-0">
                    {new Date(approval.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-zinc-600 text-xs">{expandedId === approval.id ? '▲' : '▼'}</span>
                </div>

                {/* Expanded */}
                {expandedId === approval.id && (
                  <div className="border-t border-zinc-800 p-4 flex flex-col gap-3">
                    {editingId === approval.id ? (
                      <textarea
                        value={editedBody}
                        onChange={e => setEditedBody(e.target.value)}
                        rows={10}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <div className="bg-zinc-800 rounded-lg p-3 max-h-64 overflow-y-auto">
                        <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{approval.body}</p>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {editingId === approval.id ? (
                        <>
                          <button onClick={() => setEditingId(null)} className="text-zinc-400 text-sm px-3 py-1.5 border border-zinc-700 rounded-lg">Cancel</button>
                          <button
                            onClick={() => sendApproval(approval.id, editedBody)}
                            disabled={sending === approval.id}
                            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg"
                          >
                            {sending === approval.id ? 'Sending...' : '📤 Send Edited'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => sendApproval(approval.id)}
                            disabled={sending === approval.id}
                            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                          >
                            {sending === approval.id ? '📤 Sending...' : '📤 Approve & Send'}
                          </button>
                          <button
                            onClick={() => { setEditingId(approval.id); setEditedBody(approval.body) }}
                            className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm px-3 py-1.5 rounded-lg transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => rejectApproval(approval.id)}
                            className="text-zinc-600 hover:text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Lead Inbox tab */}
      {tab === 'inbox' && (
        <div className="flex flex-col gap-3">
          {inbox.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-emerald-400 text-sm">✓ No new lead replies</p>
            </div>
          ) : (
            inbox.map(item => (
              <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full text-purple-400 bg-purple-950">🌱 Lead Reply</span>
                      <span className="text-white text-sm font-medium">{item.lead_name ?? item.sender_email}</span>
                    </div>
                    <p className="text-zinc-500 text-xs">From: {item.sender_email}</p>
                    {item.subject && <p className="text-zinc-600 text-xs">"{item.subject}"</p>}
                  </div>
                  <span className="text-zinc-600 text-xs flex-shrink-0">
                    {new Date(item.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-zinc-600 text-xs">{expandedId === item.id ? '▲' : '▼'}</span>
                </div>

                {expandedId === item.id && (
                  <div className="border-t border-zinc-800 p-4 flex flex-col gap-3">
                    {item.body && (
                      <div>
                        <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-1">Their message</p>
                        <div className="bg-zinc-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                          <p className="text-zinc-300 text-sm whitespace-pre-wrap">{item.body}</p>
                        </div>
                      </div>
                    )}
                    {item.reply_draft && (
                      <div>
                        <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-1">Piper's draft reply</p>
                        <div className="bg-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                          <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{item.reply_draft}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-zinc-600 text-xs">A send approval has been created in the Emails tab.</p>
                    <button
                      onClick={() => dismissInbox(item.id)}
                      className="text-zinc-600 hover:text-zinc-400 text-sm w-fit"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
