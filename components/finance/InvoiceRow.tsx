'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Invoice, INVOICE_STATUSES, invoiceStatusColor } from '@/lib/types'

function fmt(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysOverdue(due: string | Date | null) {
  if (!due) return 0
  return Math.floor((Date.now() - new Date(due).getTime()) / 86400000)
}

export default function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const [status, setStatus] = useState(invoice.status)
  const [sending, setSending] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState(invoice.stripe_payment_url)
  const router = useRouter()

  async function handleSend() {
    setSending(true)
    const res = await fetch(`/api/finance/invoices/${invoice.id}/send`, { method: 'POST' })
    const data = await res.json()
    if (data.payment_url) {
      setPaymentUrl(data.payment_url)
      setStatus('Sent')
      await navigator.clipboard.writeText(data.payment_url).catch(() => {})
      alert(`Payment link created and copied to clipboard:\n${data.payment_url}`)
    }
    setSending(false)
    router.refresh()
  }

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus as typeof invoice.status)
    const body: Record<string, string> = { status: newStatus }
    if (newStatus === 'Paid') body.paid_date = new Date().toISOString().slice(0, 10)
    await fetch(`/api/finance/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this invoice?')) return
    await fetch(`/api/finance/invoices/${invoice.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const overdue = daysOverdue(invoice.due_date)

  return (
    <div className="flex items-center gap-3 py-3 border-b border-zinc-800 last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{invoice.client_name ?? 'Unknown'}</p>
          {invoice.invoice_number && (
            <span className="text-zinc-600 text-xs flex-shrink-0">{invoice.invoice_number}</span>
          )}
        </div>
        {invoice.description && (
          <p className="text-zinc-500 text-xs truncate">{invoice.description}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-white text-sm font-semibold">${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p className={`text-xs ${status === 'Overdue' ? 'text-rose-400' : 'text-zinc-600'}`}>
          {status === 'Paid' ? `Paid ${fmt(invoice.paid_date)}` : invoice.due_date ? `Due ${fmt(invoice.due_date)}` : '—'}
          {status === 'Overdue' && overdue > 0 ? ` (${overdue}d)` : ''}
        </p>
      </div>
      <select
        value={status}
        onChange={e => handleStatusChange(e.target.value)}
        className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none flex-shrink-0 ${invoiceStatusColor[status]}`}
      >
        {INVOICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <button
        onClick={handleDelete}
        className="text-zinc-700 hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
      >
        ✕
      </button>

      {/* Send / payment link */}
      {status !== 'Paid' && (
        paymentUrl ? (
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 text-xs flex-shrink-0 transition-colors"
          >
            💳 Link
          </a>
        ) : (
          <button
            onClick={handleSend}
            disabled={sending}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-2 py-0.5 rounded transition-colors flex-shrink-0"
          >
            {sending ? '...' : 'Send'}
          </button>
        )
      )}
    </div>
  )
}
