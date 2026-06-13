'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContentPost, ContentVariant, CONTENT_STATUSES, CONTENT_CHANNELS, channelColor } from '@/lib/types'

export default function PostDrawer({ post, onClose }: { post: ContentPost; onClose: () => void }) {
  const [draft, setDraft] = useState(post.draft_content ?? '')
  const [status, setStatus] = useState(post.status)
  const [scheduledDate, setScheduledDate] = useState(
    post.scheduled_date ? new Date(post.scheduled_date).toISOString().slice(0, 10) : ''
  )
  const [postTime, setPostTime] = useState(post.post_time ?? '')
  const [variants, setVariants] = useState<ContentVariant[]>([])
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [loadingRepurpose, setLoadingRepurpose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'draft' | 'variants'>('draft')
  const router = useRouter()

  async function handleGenerateDraft() {
    setLoadingDraft(true)
    const res = await fetch('/api/nova/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id }),
    })
    const data = await res.json()
    setDraft(data.draft)
    setLoadingDraft(false)
  }

  async function handleRepurpose() {
    setLoadingRepurpose(true)
    const res = await fetch('/api/nova/repurpose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id }),
    })
    const data = await res.json()
    const variantList = Object.entries(data.variants).map(([channel, content]) => ({
      id: crypto.randomUUID(),
      post_id: post.id,
      channel: channel as ContentVariant['channel'],
      draft_content: content as string,
      status: 'Draft' as const,
      scheduled_date: null,
      post_time: null,
      posted_at: null,
      created_at: new Date().toISOString(),
    }))
    setVariants(variantList)
    setActiveTab('variants')
    setLoadingRepurpose(false)
  }

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/content/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_content: draft,
        status,
        scheduled_date: scheduledDate || null,
        post_time: postTime || null,
      }),
    })
    setSaving(false)
    onClose()
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${post.title}"?`)) return
    await fetch(`/api/content/posts/${post.id}`, { method: 'DELETE' })
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-white font-semibold leading-tight">{post.title}</h2>
            <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block ${channelColor[post.channel]}`}>
              {post.channel}
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors ml-4">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button onClick={() => setActiveTab('draft')} className={`px-5 py-3 text-sm transition-colors ${activeTab === 'draft' ? 'text-white border-b-2 border-indigo-500' : 'text-zinc-500 hover:text-white'}`}>
            Draft
          </button>
          <button onClick={() => setActiveTab('variants')} className={`px-5 py-3 text-sm transition-colors ${activeTab === 'variants' ? 'text-white border-b-2 border-indigo-500' : 'text-zinc-500 hover:text-white'}`}>
            Channel Variants {variants.length > 0 && <span className="ml-1 text-xs bg-indigo-600 px-1.5 rounded-full">{variants.length}</span>}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'draft' ? (
            <div className="flex flex-col gap-4">
              {/* Nova actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateDraft}
                  disabled={loadingDraft}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  {loadingDraft ? '✨ Writing...' : '✨ Write with Nova'}
                </button>
                <button
                  onClick={handleRepurpose}
                  disabled={loadingRepurpose || !draft}
                  className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  {loadingRepurpose ? '↗ Repurposing...' : '↗ Repurpose for all channels'}
                </button>
              </div>

              {/* Draft editor */}
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Draft content will appear here. Click 'Write with Nova' to generate, or type manually."
                rows={12}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none font-mono"
              />

              {/* Scheduling */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    {CONTENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Publish Date</label>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Publish Time</label>
                  <input type="time" value={postTime} onChange={e => setPostTime(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {variants.length === 0 ? (
                <p className="text-zinc-600 text-sm">No variants yet. Click "Repurpose for all channels" on the Draft tab.</p>
              ) : (
                variants.map(v => (
                  <div key={v.id} className="bg-zinc-800 rounded-lg p-4">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full mb-2 inline-block ${channelColor[v.channel]}`}>
                      {v.channel}
                    </span>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap mt-2">{v.draft_content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-zinc-800">
          <button onClick={handleDelete} className="bg-rose-900/50 hover:bg-rose-900 text-rose-400 text-sm px-3 py-2 rounded-lg transition-colors">
            Delete
          </button>
          <button onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
