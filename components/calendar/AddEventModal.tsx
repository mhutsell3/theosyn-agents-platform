'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddEventModal({ defaultDate }: { defaultDate?: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        event_date: form.get('event_date'),
        event_time: form.get('event_time') || null,
        type: form.get('type'),
        notes: form.get('notes') || null,
        color: form.get('color') || 'indigo',
      }),
    })
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
        + Add Event
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-4">New Event</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Title *</label>
                <input name="title" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Date *</label>
                  <input name="event_date" type="date" required defaultValue={defaultDate} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Time</label>
                  <input name="event_time" type="time" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Type</label>
                  <select name="type" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    <option value="event">Event</option>
                    <option value="meeting">Meeting</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Color</label>
                  <select name="color" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    <option value="indigo">Indigo</option>
                    <option value="emerald">Green</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Red</option>
                    <option value="sky">Blue</option>
                    <option value="purple">Purple</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Notes</label>
                <textarea name="notes" rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors">{loading ? 'Saving...' : 'Add Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
