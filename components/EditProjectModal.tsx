'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Project, PROJECT_PHASES, projectTypeColor } from '@/lib/types'

function toDateInput(val: string | Date | null | undefined): string {
  if (!val) return ''
  return new Date(val).toISOString().slice(0, 10)
}

export default function EditProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: form.get('phase'),
        due_date: form.get('due_date') || null,
        notes: form.get('notes') || null,
      }),
    })
    setLoading(false)
    onClose()
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    setDeleting(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg leading-tight">{project.name}</h2>
            {project.client_name && (
              <p className="text-zinc-500 text-sm mt-0.5">{project.client_name}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ml-3 ${projectTypeColor[project.type]}`}>
            {project.type}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Phase</label>
            <select name="phase" defaultValue={project.phase} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
              {PROJECT_PHASES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Due Date</label>
            <input
              name="due_date"
              type="date"
              defaultValue={toDateInput(project.due_date)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Notes</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={project.notes ?? ''}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {project.notion_url && (
            <a
              href={project.notion_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1.5 transition-colors"
            >
              📝 Open in Notion
            </a>
          )}

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
