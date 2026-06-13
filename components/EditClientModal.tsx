'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Client, STAGES, CLIENT_TYPES, typeColor } from '@/lib/types'

export default function EditClientModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: form.get('stage'),
        contact_name: form.get('contact_name') || null,
        contact_email: form.get('contact_email') || null,
        notes: form.get('notes') || null,
      }),
    })
    setLoading(false)
    onClose()
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${client.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    setDeleting(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg leading-tight">{client.name}</h2>
            <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block ${typeColor[client.type]}`}>
              {client.type}
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors ml-4">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Stage</label>
            <select name="stage" defaultValue={client.stage} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Contact Name</label>
            <input
              name="contact_name"
              defaultValue={client.contact_name ?? ''}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Contact Email</label>
            <input
              name="contact_email"
              type="email"
              defaultValue={client.contact_email ?? ''}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Notes</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={client.notes ?? ''}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-900/50 hover:bg-rose-900 disabled:opacity-50 text-rose-400 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              {deleting ? '...' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
