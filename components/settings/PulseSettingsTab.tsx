'use client'

import { useEffect, useState } from 'react'

const TONES = ['Faith-informed', 'Professional', 'Casual', 'Friendly'] as const
const MONITOR_DAYS_OPTIONS = [7, 14, 30] as const

interface PageSetting {
  id: string
  social_account_id: string
  page_name: string
  page_id: string
  platform: string
  enabled: boolean
  reply_tone: string
  auto_reply_simple: boolean
  sign_off_name: string
  monitor_days: number
  flag_negative: boolean
  flag_questions: boolean
  dead_post_alert: boolean
  spike_threshold: number
}

interface UnmonitoredAccount {
  id: string
  page_name: string
  page_id: string
  platform: string
}

export default function PulseSettingsTab() {
  const [settings, setSettings] = useState<PageSetting[]>([])
  const [unmonitored, setUnmonitored] = useState<UnmonitoredAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<PageSetting>>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/pulse/settings')
    const data = await res.json()
    setSettings(data.settings ?? [])
    setUnmonitored(data.unmonitored ?? [])
    setLoading(false)
  }

  function edit(accountId: string, key: string, value: unknown) {
    setEdits(prev => ({ ...prev, [accountId]: { ...prev[accountId], [key]: value } }))
  }

  async function save(accountId: string) {
    setSaving(accountId)
    const updates = edits[accountId] ?? {}
    await fetch('/api/pulse/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ social_account_id: accountId, ...updates }),
    })
    setEdits(prev => { const n = { ...prev }; delete n[accountId]; return n })
    setSaving(null)
    setSaved(accountId)
    setTimeout(() => setSaved(null), 2000)
    load()
  }

  async function addPage(accountId: string) {
    await fetch('/api/pulse/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ social_account_id: accountId }),
    })
    load()
  }

  async function removePage(accountId: string) {
    if (!confirm('Stop monitoring this page?')) return
    await fetch('/api/pulse/settings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ social_account_id: accountId }),
    })
    load()
  }

  function val<T>(setting: PageSetting, key: keyof PageSetting, accountId: string): T {
    return ((edits[accountId]?.[key] ?? setting[key]) as T)
  }

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Loading Pulse settings...</div>

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">Pulse — Monitored Pages</h2>
        <p className="text-zinc-500 text-sm">Configure which Facebook pages Pulse monitors for comments, engagement, and flags.</p>
      </div>

      {/* Monitored pages */}
      {settings.length === 0 ? (
        <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No pages being monitored yet. Add one below.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {settings.map(setting => {
            const isDirty = Object.keys(edits[setting.social_account_id] ?? {}).length > 0
            const isExpanded = expanded === setting.social_account_id

            return (
              <div key={setting.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm">{setting.page_name}</p>
                      <span className="text-blue-400 text-xs">{setting.platform}</span>
                      <span className="text-zinc-600 text-xs font-mono">{setting.page_id}</span>
                    </div>
                  </div>

                  {/* Enable toggle */}
                  <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                    <span className="text-zinc-400 text-xs">Active</span>
                    <div
                      onClick={() => {
                        edit(setting.social_account_id, 'enabled', !val<boolean>(setting, 'enabled', setting.social_account_id))
                      }}
                      className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${val<boolean>(setting, 'enabled', setting.social_account_id) ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${val<boolean>(setting, 'enabled', setting.social_account_id) ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </label>

                  <button
                    onClick={() => setExpanded(isExpanded ? null : setting.social_account_id)}
                    className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 border border-zinc-700 rounded-lg"
                  >
                    {isExpanded ? 'Collapse' : 'Configure'}
                  </button>
                  <button onClick={() => removePage(setting.social_account_id)} className="text-zinc-600 hover:text-red-400 text-xs transition-colors">Remove</button>
                </div>

                {/* Expanded config */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-4 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Reply tone */}
                      <div>
                        <label className="text-zinc-400 text-xs mb-1 block">Reply Tone</label>
                        <select
                          value={val<string>(setting, 'reply_tone', setting.social_account_id)}
                          onChange={e => edit(setting.social_account_id, 'reply_tone', e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                          {TONES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>

                      {/* Sign-off name */}
                      <div>
                        <label className="text-zinc-400 text-xs mb-1 block">Sign-off Name</label>
                        <input
                          value={val<string>(setting, 'sign_off_name', setting.social_account_id)}
                          onChange={e => edit(setting.social_account_id, 'sign_off_name', e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Monitor days */}
                      <div>
                        <label className="text-zinc-400 text-xs mb-1 block">Monitor Posts From Last</label>
                        <select
                          value={val<number>(setting, 'monitor_days', setting.social_account_id)}
                          onChange={e => edit(setting.social_account_id, 'monitor_days', Number(e.target.value))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                          {MONITOR_DAYS_OPTIONS.map(d => <option key={d} value={d}>{d} days</option>)}
                        </select>
                      </div>

                      {/* Spike threshold */}
                      <div>
                        <label className="text-zinc-400 text-xs mb-1 block">Spike Alert Threshold (comments)</label>
                        <input
                          type="number"
                          min={1}
                          value={val<number>(setting, 'spike_threshold', setting.social_account_id)}
                          onChange={e => edit(setting.social_account_id, 'spike_threshold', Number(e.target.value))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {([
                        ['auto_reply_simple', 'Auto-reply Simple Comments'],
                        ['flag_negative',     'Flag Negative Comments'],
                        ['flag_questions',    'Flag Questions'],
                        ['dead_post_alert',   'Dead Post Alert (24h)'],
                      ] as [keyof PageSetting, string][]).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <div
                            onClick={() => edit(setting.social_account_id, key, !val<boolean>(setting, key, setting.social_account_id))}
                            className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 cursor-pointer ${val<boolean>(setting, key, setting.social_account_id) ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                          >
                            <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${val<boolean>(setting, key, setting.social_account_id) ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-zinc-400 text-xs">{label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Save */}
                    <div className="flex items-center gap-3">
                      {isDirty && (
                        <button
                          onClick={() => save(setting.social_account_id)}
                          disabled={saving === setting.social_account_id}
                          className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                        >
                          {saving === setting.social_account_id ? 'Saving...' : 'Save Changes'}
                        </button>
                      )}
                      {saved === setting.social_account_id && (
                        <p className="text-emerald-400 text-xs">✓ Saved</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add unmonitored pages */}
      {unmonitored.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-3">Add a Page to Monitor</h3>
          <div className="flex flex-col gap-2">
            {unmonitored.map(account => (
              <div key={account.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-zinc-300 text-sm">{account.page_name}</p>
                  <p className="text-zinc-600 text-xs">{account.platform} · {account.page_id}</p>
                </div>
                <button
                  onClick={() => addPage(account.id)}
                  className="text-indigo-400 hover:text-indigo-300 text-xs border border-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Monitor
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {settings.length === 0 && unmonitored.length === 0 && (
        <p className="text-zinc-600 text-xs text-center">No Facebook pages connected. Add one in the Social Media tab first.</p>
      )}
    </div>
  )
}
