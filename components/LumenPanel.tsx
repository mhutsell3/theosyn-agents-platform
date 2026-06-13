'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { InvoiceAlert } from '@/lib/lumen'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export default function LumenPanel() {
  const [overdue, setOverdue] = useState<InvoiceAlert[]>([])
  const [summary, setSummary] = useState<{
    collectedMTD: number
    outstandingTotal: number
    overdueTotal: number
    expensesMTD: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceAlert | null>(null)
  const [reminder, setReminder] = useState<string | null>(null)
  const [generatingReminder, setGeneratingReminder] = useState(false)
  const [runningHeartbeat, setRunningHeartbeat] = useState(false)
  const [runningMonthEnd, setRunningMonthEnd] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => { scan() }, [])

  async function scan() {
    setLoading(true)
    const res = await fetch('/api/lumen/scan')
    if (res.ok) {
      const data = await res.json()
      setOverdue(data.overdue ?? [])
      setSummary({
        collectedMTD: data.collectedMTD,
        outstandingTotal: data.outstandingTotal,
        overdueTotal: data.overdueTotal,
        expensesMTD: data.expensesMTD,
      })
    }
    setLoading(false)
  }

  async function handleReminder(invoice: InvoiceAlert) {
    setSelectedInvoice(invoice)
    setReminder(null)
    setGeneratingReminder(true)
    const res = await fetch('/api/lumen/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: invoice.id }),
    })
    const data = await res.json()
    setReminder(data.email)
    setGeneratingReminder(false)
  }

  async function handleHeartbeat() {
    setRunningHeartbeat(true)
    setResult(null)
    const res = await fetch('/api/lumen/heartbeat', { method: 'POST' })
    const data = await res.json()
    setResult(`💡 Lumen wrote her weekly finance report. ${data.overdueCount} overdue invoices flagged.`)
    setRunningHeartbeat(false)
    router.refresh()
  }

  async function handleMonthEnd() {
    setRunningMonthEnd(true)
    setResult(null)
    await fetch('/api/lumen/month-end', { method: 'POST' })
    setResult('💡 Month-end report written to the activity feed.')
    setRunningMonthEnd(false)
    router.refresh()
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">💡</span>
          <div>
            <h3 className="text-white font-semibold text-sm">Lumen — Finance & Admin</h3>
            <p className="text-zinc-500 text-xs">Revenue, invoices, financial health</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMonthEnd}
            disabled={runningMonthEnd}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {runningMonthEnd ? '📊 Running...' : '📊 Month-End'}
          </button>
          <button
            onClick={handleHeartbeat}
            disabled={runningHeartbeat}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {runningHeartbeat ? '💡 Running...' : '💡 Weekly Report'}
          </button>
        </div>
      </div>

      {result && <p className="text-emerald-400 text-xs">{result}</p>}

      {/* Finance snapshot */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Collected MTD',  value: fmt(summary.collectedMTD),    color: 'text-emerald-400' },
            { label: 'Outstanding',    value: fmt(summary.outstandingTotal), color: 'text-amber-400' },
            { label: 'Overdue',        value: fmt(summary.overdueTotal),     color: 'text-rose-400' },
            { label: 'Expenses MTD',   value: fmt(summary.expensesMTD),      color: 'text-zinc-300' },
          ].map(s => (
            <div key={s.label} className="bg-zinc-800 rounded-lg p-2.5 text-center">
              <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-zinc-600 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Overdue invoices */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Overdue Invoices</span>
          <button onClick={scan} className="text-zinc-600 hover:text-zinc-400 text-xs">↻ Refresh</button>
        </div>

        {loading ? (
          <p className="text-zinc-600 text-xs">Scanning invoices...</p>
        ) : overdue.length === 0 ? (
          <p className="text-emerald-400 text-xs">✓ No overdue invoices</p>
        ) : (
          <div className="flex flex-col gap-2">
            {overdue.map(invoice => (
              <div
                key={invoice.id}
                className={`bg-zinc-800 border rounded-lg p-3 flex items-center gap-3 ${selectedInvoice?.id === invoice.id ? 'border-indigo-700' : 'border-transparent'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{invoice.client_name ?? 'Unknown Client'}</p>
                    {invoice.invoice_number && (
                      <span className="text-zinc-600 text-xs">#{invoice.invoice_number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-rose-400 text-sm font-bold">{fmt(invoice.amount)}</span>
                    {invoice.daysOverdue !== null && invoice.daysOverdue > 0 && (
                      <span className="text-rose-400 text-xs">{invoice.daysOverdue}d overdue</span>
                    )}
                    {invoice.due_date && (
                      <span className="text-zinc-600 text-xs">Due {new Date(invoice.due_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleReminder(invoice)}
                  disabled={generatingReminder && selectedInvoice?.id === invoice.id}
                  className="text-xs bg-rose-800 hover:bg-rose-700 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors flex-shrink-0"
                >
                  ✉️ Reminder
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generating state */}
      {generatingReminder && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <span className="animate-spin">⏳</span>
          Lumen is writing an invoice reminder...
        </div>
      )}

      {/* Reminder output */}
      {reminder && selectedInvoice && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">
              Reminder — {selectedInvoice.client_name}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(reminder)}
              className="text-zinc-600 hover:text-indigo-400 text-xs transition-colors"
            >
              Copy ↗
            </button>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 max-h-56 overflow-y-auto">
            <p className="text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed">{reminder}</p>
          </div>
        </div>
      )}
    </div>
  )
}
