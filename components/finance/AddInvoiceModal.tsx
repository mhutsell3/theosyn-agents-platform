'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Client, INVOICE_STATUSES } from '@/lib/types'

export default function AddInvoiceModal({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const clientId = form.get('client_id') as string
    const client = clients.find(c => c.id === clientId)
    await fetch('/api/finance/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId || null,
        client_name: client?.name || form.get('client_name') || null,
        amount: parseFloat(form.get('amount') as string),
        status: form.get('status'),
        description: form.get('description') || null,
        issue_date: form.get('issue_date') || null,
        due_date: form.get('due_date') || null,
        invoice_number: form.get('invoice_number') || null,
      }),
    })
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
        + New Invoice
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-4">New Invoice</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Client</label>
                <select name="client_id" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">— Select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Amount ($) *</label>
                  <input name="amount" type="number" step="0.01" min="0" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Status</label>
                  <select name="status" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Invoice #</label>
                <input name="invoice_number" placeholder="INV-001" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Issue Date</label>
                  <input name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Due Date</label>
                  <input name="due_date" type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Description</label>
                <textarea name="description" rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors">{loading ? 'Saving...' : 'Create Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
