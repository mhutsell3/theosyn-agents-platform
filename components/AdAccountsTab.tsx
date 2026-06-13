'use client'

import { useEffect, useState } from 'react'

interface AdAccount {
  id: number
  name: string
  account_id: string
  enabled: boolean
  track_cpc: boolean
  track_cpl_like: boolean
  track_cpl_follow: boolean
  track_lpv: boolean
  track_cpp: boolean
  track_roas: boolean
  track_cpl_lead: boolean
}

const METRICS: { key: MetricKey; label: string; description: string }[] = [
  { key: 'track_roas',       label: 'ROAS',              description: 'Return on Ad Spend' },
  { key: 'track_cpc',        label: 'Cost Per Click',    description: 'Spend ÷ link clicks' },
  { key: 'track_cpl_lead',   label: 'Cost Per Lead',     description: 'Spend ÷ lead conversions' },
  { key: 'track_cpp',        label: 'CPP',               description: 'Cost Per Purchase' },
  { key: 'track_lpv',        label: 'Cost Per LPV',      description: 'Spend ÷ landing page views' },
  { key: 'track_cpl_like',   label: 'Cost Per Like',     description: 'Spend ÷ page likes' },
  { key: 'track_cpl_follow', label: 'Cost Per Follow',   description: 'Spend ÷ page follows' },
]

const MAX_ACCOUNTS = 5

const BLANK: Omit<AdAccount, 'id' | 'created_at'> = {
  name: '', account_id: '', enabled: true,
  track_roas: true, track_cpc: true, track_cpl_lead: true, track_cpp: true,
  track_lpv: false, track_cpl_like: false, track_cpl_follow: false,
}

export default function AdAccountsTab() {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<number | 'new' | null>(null)
  const [adding, setAdding]     = useState(false)
  const [newAccount, setNewAccount] = useState({ ...BLANK })
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/ad-accounts')
      .then(r => r.json())
      .then(d => { setAccounts(d); setLoading(false) })
  }, [])

  async function save(id: number, patch: Partial<AdAccount>) {
    setSaving(id)
    const res = await fetch('/api/settings/ad-accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    const updated = await res.json()
    setAccounts(prev => prev.map(a => a.id === id ? updated : a))
    setSaving(null)
  }

  async function create() {
    if (!newAccount.name.trim() || !newAccount.account_id.trim()) {
      setError('Name and Account ID are required')
      return
    }
    setSaving('new')
    setError(null)
    const res = await fetch('/api/settings/ad-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAccount),
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(null); return }
    setAccounts(prev => [...prev, data])
    setNewAccount({ ...BLANK })
    setAdding(false)
    setSaving(null)
  }

  async function remove(id: number) {
    if (!confirm('Remove this ad account?')) return
    await fetch('/api/settings/ad-accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  function updateNew(key: string, value: unknown) {
    setNewAccount(prev => ({ ...prev, [key]: value }))
  }

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Loading ad accounts...</div>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-zinc-500 text-sm">
          Track up to {MAX_ACCOUNTS} Meta ad accounts. Choose which metrics Remi monitors per account.
        </p>
        {!adding && accounts.length < MAX_ACCOUNTS && (
          <button
            onClick={() => setAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg"
          >
            + Add Account
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-950 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Existing accounts */}
      {accounts.map(account => (
        <AccountCard
          key={account.id}
          account={account}
          saving={saving === account.id}
          onSave={(patch) => save(account.id, patch)}
          onDelete={() => remove(account.id)}
        />
      ))}

      {/* New account form */}
      {adding && (
        <div className="bg-zinc-900 border border-indigo-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">New Ad Account</h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Account Name</label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={e => updateNew('name', e.target.value)}
                  placeholder="Blessed Bling Co"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">Ad Account ID</label>
                <input
                  type="text"
                  value={newAccount.account_id}
                  onChange={e => updateNew('account_id', e.target.value)}
                  placeholder="act_1234567890"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-2 block">Track These Metrics</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {METRICS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={newAccount[m.key] as boolean}
                      onChange={e => updateNew(m.key, e.target.checked)}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <div>
                      <div className="text-zinc-300 text-xs font-medium">{m.label}</div>
                      <div className="text-zinc-600 text-xs">{m.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setAdding(false); setError(null) }} className="border border-zinc-700 text-zinc-400 hover:text-white text-sm px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={create} disabled={saving === 'new'} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                {saving === 'new' ? 'Saving...' : 'Save Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {accounts.length === 0 && !adding && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-sm">
          No ad accounts configured yet. Click <strong className="text-zinc-300">+ Add Account</strong> to get started.
        </div>
      )}

      <p className="text-zinc-600 text-xs text-center">
        Account IDs are stored in the database. Format: <code className="bg-zinc-800 px-1 rounded">act_XXXXXXXXXX</code>
      </p>
    </div>
  )
}

type MetricKey = 'track_roas' | 'track_cpc' | 'track_cpl_lead' | 'track_cpp' | 'track_lpv' | 'track_cpl_like' | 'track_cpl_follow'

function AccountCard({ account, saving, onSave, onDelete }: {
  account: AdAccount
  saving: boolean
  onSave: (patch: Partial<AdAccount>) => void
  onDelete: () => void
}) {
  const [name, setName]           = useState(account.name)
  const [accountId, setAccountId] = useState(account.account_id)
  const [dirty, setDirty]         = useState(false)

  function toggleMetric(key: MetricKey) {
    onSave({ [key]: !account[key] })
  }

  function saveText() {
    if (name === account.name && accountId === account.account_id) return
    onSave({ name, account_id: accountId })
    setDirty(false)
  }

  return (
    <div className={`bg-zinc-900 border rounded-xl p-5 transition-opacity ${account.enabled ? 'border-zinc-800' : 'border-zinc-900 opacity-60'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setDirty(true) }}
              onBlur={saveText}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white font-semibold focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={accountId}
              onChange={e => { setAccountId(e.target.value); setDirty(true) }}
              onBlur={saveText}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          {saving && <span className="text-zinc-600 text-xs">Saving...</span>}
          {/* Enable toggle */}
          <button
            onClick={() => onSave({ enabled: !account.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${account.enabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${account.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <button onClick={onDelete} className="text-zinc-600 hover:text-red-400 text-xs transition-colors">Remove</button>
        </div>
      </div>

      {/* Metrics */}
      <div>
        <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Track Metrics</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {METRICS.map(m => (
            <label key={m.key} className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={account[m.key] as boolean}
                onChange={() => toggleMetric(m.key)}
                className="w-4 h-4 mt-0.5 accent-indigo-500 shrink-0"
              />
              <div>
                <div className={`text-xs font-medium transition-colors ${account[m.key] ? 'text-zinc-300' : 'text-zinc-600'}`}>{m.label}</div>
                <div className="text-zinc-600 text-xs">{m.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
