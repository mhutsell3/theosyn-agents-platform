'use client'

import { useState, useEffect, useCallback } from 'react'

interface AccountSummary {
  account_id: string
  account_name: string
  total_spend: number
  total_conversions: number
  total_conversion_value: number
  roas: number
  cpa: number
}

interface Campaign {
  account_id: string
  account_name: string
  campaign_id: string
  campaign_name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversion_value: number
  roas: number
  cpa: number
  frequency: number
  ctr: number
  cpm: number
}

interface ActionData {
  what_is_wrong?: string
  what_will_happen?: string
  expected_outcome?: string
  execution?: 'automatic' | 'manual'
  metrics?: Record<string, number>
  recommended_action?: string
  recommended_budget?: string
  budget_increase?: string
  budget_reduction?: string
  projected_added_revenue?: string
  projected_savings?: string
}

interface Recommendation {
  id: number
  account_name: string
  campaign_name: string
  type: string
  priority: string
  reason: string
  status: string
  created_at: string
  action_data?: ActionData
}

const REC_TYPE_LABEL: Record<string, string> = {
  pause:           '⏸ Pause Campaign',
  reduce_budget:   '📉 Reduce Budget',
  scale:           '🚀 Scale Budget',
  refresh_creative:'🎨 Refresh Creative',
  review:          '🔍 Review',
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   'bg-red-900 text-red-300 border border-red-700',
  medium: 'bg-amber-900 text-amber-300 border border-amber-700',
  low:    'bg-zinc-800 text-zinc-400 border border-zinc-700',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:  'text-emerald-400',
  PAUSED:  'text-zinc-500',
  UNKNOWN: 'text-zinc-600',
}

function roasColor(roas: number) {
  if (roas <= 0)  return 'text-zinc-500'
  if (roas < 1.0) return 'text-red-400'
  if (roas < 2.0) return 'text-amber-400'
  if (roas >= 3.0) return 'text-emerald-400'
  return 'text-blue-400'
}

function fmt(n: number, prefix = '') {
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface ConfiguredAccount {
  id: number
  name: string
  account_id: string
  enabled: boolean
}

const today = new Date().toISOString().slice(0, 10)
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

interface AdSetRow {
  account_name: string; campaign_name: string
  adset_id: string; adset_name: string
  spend: number; impressions: number; clicks: number
  conversions: number; roas: number; cpa: number; frequency: number; ctr: number; cpm: number
}

interface AdRow {
  account_name: string; campaign_name: string; adset_name: string
  ad_id: string; ad_name: string
  spend: number; impressions: number; clicks: number
  conversions: number; roas: number; cpa: number; frequency: number; ctr: number; cpm: number
}

export default function RemiPanel() {
  const [accounts, setAccounts]               = useState<AccountSummary[]>([])
  const [campaigns, setCampaigns]             = useState<Campaign[]>([])
  const [adSets, setAdSets]                   = useState<AdSetRow[]>([])
  const [ads, setAds]                         = useState<AdRow[]>([])
  const [recs, setRecs]                       = useState<Recommendation[]>([])
  const [configuredAccounts, setConfiguredAccounts] = useState<ConfiguredAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [since, setSince]                     = useState(sevenDaysAgo)
  const [until, setUntil]                     = useState(today)
  const [syncing, setSyncing]                 = useState(false)
  const [syncResult, setSyncResult]           = useState<string | null>(null)
  const [loading, setLoading]                 = useState(true)
  const [acting, setActing]                   = useState<number | null>(null)
  const [tab, setTab]                         = useState<'campaigns' | 'adsets' | 'ads' | 'recommendations'>('campaigns')

  useEffect(() => {
    fetch('/api/settings/ad-accounts')
      .then(r => r.json())
      .then(d => setConfiguredAccounts(Array.isArray(d) ? d : []))
  }, [])

  const days = Math.round((new Date(until).getTime() - new Date(since).getTime()) / 86400000) + 1

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ since, until })
    if (selectedAccount !== 'all') params.set('account', selectedAccount)

    const [campRes, adsetRes, adRes, recRes] = await Promise.all([
      fetch(`/api/remi/campaigns?${params}`).then(r => r.json()),
      fetch(`/api/remi/campaigns?${params}&level=adset`).then(r => r.json()),
      fetch(`/api/remi/campaigns?${params}&level=ad`).then(r => r.json()),
      fetch('/api/remi/recommendations').then(r => r.json()),
    ])

    setAccounts(campRes.accounts ?? [])
    setCampaigns(campRes.campaigns ?? [])
    setAdSets(adsetRes.rows ?? [])
    setAds(adRes.rows ?? [])
    setRecs(Array.isArray(recRes) ? recRes : [])
    setLoading(false)
  }, [days, selectedAccount, since])

  useEffect(() => { load() }, [load])

  async function sync() {
    setSyncing(true)
    setSyncResult(null)
    const body: Record<string, string> = { since, until }
    if (selectedAccount !== 'all') body.accountId = selectedAccount

    const res = await fetch('/api/remi/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) {
      setSyncResult(`Error: ${data.error}`)
    } else {
      const errorStr = data.errors?.length
        ? ` · ⚠ ${data.errors.map((e: { account: string; level: string; error: string }) => `${e.account} (${e.level}): ${e.error}`).join(' | ')}`
        : ''
      setSyncResult(`✓ ${data.accounts} account${data.accounts !== 1 ? 's' : ''} · ${data.campaigns} campaigns · ${data.adsets ?? 0} ad sets · ${data.ads ?? 0} ads · ${data.recommendations} recommendations${errorStr}`)
      await load()
    }
    setSyncing(false)
  }

  async function approve(id: number) {
    setActing(id)
    await fetch('/api/remi/recommendations/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setRecs(prev => prev.filter(r => r.id !== id))
    setActing(null)
  }

  async function reject(id: number) {
    setActing(id)
    await fetch('/api/remi/recommendations/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setRecs(prev => prev.filter(r => r.id !== id))
    setActing(null)
  }

  const totalSpend = accounts.reduce((s, a) => s + Number(a.total_spend), 0)
  const totalValue = accounts.reduce((s, a) => s + Number(a.total_conversion_value), 0)
  const blendedRoas = totalSpend > 0 ? totalValue / totalSpend : 0
  const pendingRecs = recs.filter(r => r.status === 'pending')

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">📊 Remi <span className="text-zinc-500 font-normal text-base">Meta Ads Intelligence</span></h1>
          <p className="text-zinc-500 text-sm mt-1">ROAS · CPA · Creative Fatigue · Campaign Recommendations</p>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-end gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          {/* Account selector */}
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">Ad Account</label>
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 min-w-[180px]"
            >
              <option value="all">All Accounts</option>
              {configuredAccounts.map(a => (
                <option key={a.id} value={a.account_id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">From</label>
            <input
              type="date"
              value={since}
              max={until}
              onChange={e => setSince(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">To</label>
            <input
              type="date"
              value={until}
              min={since}
              max={today}
              onChange={e => setUntil(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
            />
          </div>

          {/* Quick presets */}
          <div className="flex gap-1 flex-wrap">
            {[
              { label: 'Today', s: today, u: today },
              { label: '7D',   s: new Date(Date.now() -   6 * 86400000).toISOString().slice(0, 10), u: today },
              { label: '14D',  s: new Date(Date.now() -  13 * 86400000).toISOString().slice(0, 10), u: today },
              { label: '30D',  s: new Date(Date.now() -  29 * 86400000).toISOString().slice(0, 10), u: today },
              { label: '90D',  s: new Date(Date.now() -  89 * 86400000).toISOString().slice(0, 10), u: today },
              { label: '180D', s: new Date(Date.now() - 179 * 86400000).toISOString().slice(0, 10), u: today },
              { label: '365D', s: new Date(Date.now() - 364 * 86400000).toISOString().slice(0, 10), u: today },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => { setSince(p.s); setUntil(p.u) }}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  since === p.s && until === p.u
                    ? 'bg-indigo-700 border-indigo-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={sync}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg ml-auto"
          >
            {syncing ? 'Syncing...' : '🔄 Sync'}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`rounded-xl px-4 py-3 text-sm ${syncResult.startsWith('Error') ? 'bg-red-950 border border-red-700 text-red-300' : 'bg-emerald-950 border border-emerald-700 text-emerald-300'}`}>
          {syncResult}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-500 text-xs mb-1">Total Spend</div>
          <div className="text-white text-2xl font-bold">${totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-500 text-xs mb-1">Blended ROAS</div>
          <div className={`text-2xl font-bold ${roasColor(blendedRoas)}`}>{blendedRoas.toFixed(2)}x</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-500 text-xs mb-1">Total Revenue</div>
          <div className="text-white text-2xl font-bold">${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-500 text-xs mb-1">Pending Actions</div>
          <div className={`text-2xl font-bold ${pendingRecs.length > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>{pendingRecs.length}</div>
        </div>
      </div>

      {/* Account cards */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.map(a => (
            <div
              key={a.account_id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <div className="font-semibold text-white mb-3">{a.account_name}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-zinc-500 text-xs">Spend</div>
                  <div className="text-white text-sm font-medium">${Number(a.total_spend).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs">ROAS</div>
                  <div className={`text-sm font-bold ${roasColor(Number(a.roas))}`}>{Number(a.roas).toFixed(2)}x</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs">CPA</div>
                  <div className="text-white text-sm font-medium">{Number(a.cpa) > 0 ? '$' + Number(a.cpa).toFixed(2) : '—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        {([
          { key: 'campaigns',       label: 'Campaigns',   count: campaigns.length },
          { key: 'adsets',          label: 'Ad Sets',     count: adSets.length },
          { key: 'ads',             label: 'Ads',         count: ads.length },
          { key: 'recommendations', label: 'Recommendations', count: pendingRecs.length, badge: true },
        ] as { key: typeof tab; label: string; count: number; badge?: boolean }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${tab === t.key ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
            {t.count > 0 && (
              t.badge
                ? <span className="ml-1 bg-red-600 text-white text-xs rounded-full px-1.5">{t.count}</span>
                : <span className="ml-1 text-zinc-600 text-xs">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Campaign table */}
      {tab === 'campaigns' && (
        <MetricsTable
          loading={loading}
          rows={campaigns}
          nameCol="campaign_name"
          nameLabel="Campaign"
          subCols={[{ key: 'account_name', label: 'Account' }]}
          emptyMsg="No campaign data yet. Click Sync to pull from Meta."
        />
      )}

      {/* Ad Set table */}
      {tab === 'adsets' && (
        <MetricsTable
          loading={loading}
          rows={adSets}
          nameCol="adset_name"
          nameLabel="Ad Set"
          subCols={[{ key: 'campaign_name', label: 'Campaign' }, { key: 'account_name', label: 'Account' }]}
          emptyMsg="No ad set data yet. Click Sync to pull from Meta."
        />
      )}

      {/* Ad table */}
      {tab === 'ads' && (
        <MetricsTable
          loading={loading}
          rows={ads}
          nameCol="ad_name"
          nameLabel="Ad"
          subCols={[{ key: 'adset_name', label: 'Ad Set' }, { key: 'campaign_name', label: 'Campaign' }]}
          emptyMsg="No ad data yet. Click Sync to pull from Meta."
        />
      )}

      {/* Recommendations */}
      {tab === 'recommendations' && (
        <div className="flex flex-col gap-3">
          {pendingRecs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-sm">
              No pending recommendations. Sync to generate new ones.
            </div>
          ) : (
            pendingRecs.map(r => (
              <RecommendationCard
                key={r.id}
                rec={r}
                acting={acting === r.id}
                onApprove={() => approve(r.id)}
                onReject={() => reject(r.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function MetricsTable({ loading, rows, nameCol, nameLabel, subCols, emptyMsg }: {
  loading: boolean
  rows: unknown[]
  nameCol: string
  nameLabel: string
  subCols: { key: string; label: string }[]
  emptyMsg: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {loading ? (
        <div className="text-zinc-500 text-sm p-6 text-center">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-zinc-500 text-sm p-8 text-center">{emptyMsg}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                <th className="text-left px-4 py-3">{nameLabel}</th>
                {subCols.map(c => (
                  <th key={c.key} className="text-left px-4 py-3 hidden lg:table-cell">{c.label}</th>
                ))}
                <th className="text-right px-4 py-3">Spend</th>
                <th className="text-right px-4 py-3">ROAS</th>
                <th className="text-right px-4 py-3">CPA</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Purchases</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">ATC</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Freq.</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">CTR</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">CPM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {(rows as Record<string, unknown>[]).map((r, i) => (
                <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate" title={String(r[nameCol])}>{String(r[nameCol])}</td>
                  {subCols.map(c => (
                    <td key={c.key} className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell max-w-[150px] truncate" title={String(r[c.key])}>{String(r[c.key])}</td>
                  ))}
                  <td className="px-4 py-3 text-right text-white">${Number(r.spend).toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${roasColor(Number(r.roas))}`}>
                    {Number(r.roas) > 0 ? Number(r.roas).toFixed(2) + 'x' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300">{Number(r.cpa) > 0 ? '$' + Number(r.cpa).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 hidden md:table-cell">{Number(r.conversions)}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 hidden md:table-cell">{Number(r.add_to_cart ?? 0)}</td>
                  <td className={`px-4 py-3 text-right hidden md:table-cell ${Number(r.frequency) > 3.5 ? 'text-amber-400' : 'text-zinc-400'}`}>
                    {Number(r.frequency).toFixed(1)}x
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 hidden md:table-cell">{Number(r.ctr).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-zinc-400 hidden md:table-cell">${Number(r.cpm).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecommendationCard({ rec, acting, onApprove, onReject }: {
  rec: Recommendation
  acting: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const ad = rec.action_data
  const isAuto = ad?.execution === 'automatic'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[rec.priority]}`}>
                {rec.priority.toUpperCase()}
              </span>
              <span className="text-zinc-400 text-xs font-medium">{REC_TYPE_LABEL[rec.type] ?? rec.type}</span>
              <span className="text-zinc-700 text-xs">·</span>
              <span className="text-zinc-500 text-xs">{rec.account_name}</span>
              {isAuto
                ? <span className="text-xs bg-red-950 border border-red-800 text-red-400 px-2 py-0.5 rounded-full">⚡ Auto-executes on approval</span>
                : <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">✋ Manual action required</span>
              }
            </div>
            <div className="text-white font-semibold mb-1">{rec.campaign_name}</div>
            <div className="text-zinc-400 text-sm">{rec.reason}</div>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-indigo-400 hover:text-indigo-300 text-xs border border-indigo-800 px-3 py-1.5 rounded-lg shrink-0"
          >
            {expanded ? 'Hide Plan ▲' : 'View Plan ▼'}
          </button>
        </div>
      </div>

      {/* Expanded plan */}
      {expanded && ad && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-5 py-4 flex flex-col gap-4">
          {/* Key metrics */}
          {ad.metrics && (
            <div>
              <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Key Metrics</div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(ad.metrics).map(([k, v]) => {
                  const labels: Record<string, string> = { spend: 'Spend', roas: 'ROAS', cpa: 'CPA', conversions: 'Conversions', conversion_value: 'Revenue', frequency: 'Frequency', impressions: 'Impressions', reach: 'Reach', ctr: 'CTR', cpm: 'CPM' }
                  const formatted = k === 'spend' || k === 'cpa' || k === 'conversion_value' || k === 'cpm' ? `$${Number(v).toFixed(2)}`
                    : k === 'roas' ? `${Number(v).toFixed(2)}x`
                    : k === 'frequency' ? `${Number(v).toFixed(1)}x`
                    : k === 'ctr' ? `${Number(v).toFixed(2)}%`
                    : Number(v).toLocaleString()
                  return (
                    <div key={k} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-center min-w-[80px]">
                      <div className="text-zinc-500 text-xs">{labels[k] ?? k}</div>
                      <div className="text-white text-sm font-semibold">{formatted}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Budget recommendation callout */}
          {ad.recommended_action && (
            <div className={`border rounded-xl px-4 py-3 ${ad.budget_reduction ? 'bg-amber-950 border-amber-700' : 'bg-emerald-950 border-emerald-700'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${ad.budget_reduction ? 'text-amber-400' : 'text-emerald-400'}`}>
                {ad.budget_reduction ? '📉 Recommended Action' : '📈 Recommended Action'}
              </div>
              <div className={`font-semibold text-sm mb-2 ${ad.budget_reduction ? 'text-amber-200' : 'text-emerald-200'}`}>{ad.recommended_action}</div>
              <div className="flex flex-wrap gap-4 text-sm">
                {ad.budget_increase && (
                  <div>
                    <span className="text-emerald-600 text-xs">Budget Increase</span>
                    <div className="text-emerald-300 font-semibold">+${ad.budget_increase}/day</div>
                  </div>
                )}
                {ad.budget_reduction && (
                  <div>
                    <span className="text-amber-600 text-xs">Budget Reduction</span>
                    <div className="text-amber-300 font-semibold">-${ad.budget_reduction}/day</div>
                  </div>
                )}
                {ad.recommended_budget && (
                  <div>
                    <span className={`text-xs ${ad.budget_reduction ? 'text-amber-600' : 'text-emerald-600'}`}>New Daily Budget</span>
                    <div className={`font-semibold ${ad.budget_reduction ? 'text-amber-300' : 'text-emerald-300'}`}>~${ad.recommended_budget}/day</div>
                  </div>
                )}
                {ad.projected_added_revenue && (
                  <div>
                    <span className="text-emerald-600 text-xs">Projected Added Revenue</span>
                    <div className="text-emerald-300 font-semibold">~${ad.projected_added_revenue}/day</div>
                  </div>
                )}
                {ad.projected_savings && (
                  <div>
                    <span className="text-amber-600 text-xs">Daily Savings</span>
                    <div className="text-amber-300 font-semibold">~${ad.projected_savings}/day</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Three sections */}
          {[
            { label: '🔍 What\'s Wrong', text: ad.what_is_wrong },
            { label: isAuto ? '⚡ What Will Happen (Automatic)' : '✋ What Will Happen (Manual)', text: ad.what_will_happen },
            { label: '🎯 Expected Outcome', text: ad.expected_outcome },
          ].map(s => s.text && (
            <div key={s.label}>
              <div className="text-zinc-400 text-xs font-semibold mb-1">{s.label}</div>
              <p className="text-zinc-300 text-sm leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 py-3 border-t border-zinc-800 flex justify-end gap-2">
        <button
          onClick={onReject}
          disabled={acting}
          className="border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={onApprove}
          disabled={acting}
          className={`disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors ${
            isAuto ? 'bg-red-700 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          {acting ? 'Working...' : isAuto ? '⏸ Approve & Execute' : '✓ Mark Approved'}
        </button>
      </div>
    </div>
  )
}
