'use client'

import { useState, useEffect } from 'react'

type Tab = 'competitors' | 'pain_points' | 'reviews' | 'ad_matrix' | 'hooks' | 'competitor_ads'

interface Job { id: string; product_url: string; product_name: string; brand: string; status: string; created_at: string }

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'competitors',    label: 'Top 10 Competitors',   icon: '🏆' },
  { key: 'pain_points',   label: 'Pain Points',           icon: '😤' },
  { key: 'reviews',       label: 'Customer Reviews',      icon: '⭐' },
  { key: 'ad_matrix',     label: 'Ad Matrix',             icon: '📢' },
  { key: 'hooks',         label: 'Creative Hooks',        icon: '🎣' },
  { key: 'competitor_ads',label: 'Competitor Ads',        icon: '👀' },
]

const SEVERITY_COLOR: Record<string, string> = {
  High:   'bg-red-950 text-red-400 border-red-800',
  Medium: 'bg-amber-950 text-amber-400 border-amber-800',
  Low:    'bg-zinc-800 text-zinc-400 border-zinc-700',
}

const PLATFORM_COLOR: Record<string, string> = {
  Etsy:        'bg-orange-950 text-orange-400',
  eBay:        'bg-blue-950 text-blue-400',
  Shopify:     'bg-green-950 text-green-400',
  'TikTok Shop': 'bg-pink-950 text-pink-400',
  Facebook:    'bg-indigo-950 text-indigo-400',
  TikTok:      'bg-fuchsia-950 text-fuchsia-400',
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

export default function OrionPanel() {
  const [url, setUrl] = useState('')
  const [brand, setBrand] = useState('Blessed Bling Co')
  const [researching, setResearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, unknown[]> | null>(null)
  const [tab, setTab] = useState<Tab>('competitors')
  const [loadingJob, setLoadingJob] = useState(false)

  useEffect(() => {
    fetch('/api/orion/jobs').then(r => r.json()).then(d => setJobs(d.jobs ?? []))
  }, [])

  async function runResearch() {
    if (!url.trim()) return
    setResearching(true)
    setError(null)
    setResults(null)
    setSelectedJob(null)
    try {
      const res = await fetch('/api/orion/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl: url, brand }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Research failed'); return }
      // Load the job results
      await loadJob(data.jobId)
      // Refresh job list
      fetch('/api/orion/jobs').then(r => r.json()).then(d => setJobs(d.jobs ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setResearching(false)
    }
  }

  async function loadJob(id: string) {
    setLoadingJob(true)
    setSelectedJob(id)
    const res = await fetch(`/api/orion/jobs?id=${id}`)
    const data = await res.json()
    setResults({
      competitors:    data.competitors ?? [],
      pain_points:    data.painPoints ?? [],
      reviews:        data.reviews ?? [],
      ad_matrix:      data.adMatrix ?? [],
      hooks:          data.hooks ?? [],
      competitor_ads: data.competitorAds ?? [],
    })
    setTab('competitors')
    setLoadingJob(false)
  }

  const currentRows = results?.[tab] ?? []

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">🔭 Orion <span className="text-zinc-500 font-normal text-base">Product Research Intelligence</span></h1>
        <p className="text-zinc-500 text-sm mt-1">Competitors · Pain Points · Reviews · Ad Matrix · Creative Hooks · Competitor Ads</p>
      </div>

      {/* Input */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[300px]">
            <label className="text-zinc-500 text-xs">Product URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runResearch()}
              placeholder="https://www.amazon.com/dp/... or Etsy/Shopify link"
              className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">Brand</label>
            <select
              value={brand}
              onChange={e => setBrand(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
            >
              <option>Blessed Bling Co</option>
              <option>Ever Elan</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button
              onClick={runResearch}
              disabled={researching || !url.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-6 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {researching ? '🔭 Researching... (30-60s)' : '🔭 Research Product'}
            </button>
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">⚠ {error}</p>}
      </div>

      <div className="flex gap-4">
        {/* Job History Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Research History</p>
          {jobs.length === 0 ? (
            <p className="text-zinc-600 text-xs">No research yet.</p>
          ) : (
            jobs.map(job => (
              <button
                key={job.id}
                onClick={() => loadJob(job.id)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  selectedJob === job.id
                    ? 'bg-indigo-950 border-indigo-700'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <p className="text-white text-xs font-medium truncate">{job.product_name}</p>
                <p className="text-zinc-500 text-xs">{job.brand}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-zinc-600 text-xs">{new Date(job.created_at).toLocaleDateString()}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    job.status === 'complete' ? 'bg-emerald-950 text-emerald-400' :
                    job.status === 'error' ? 'bg-red-950 text-red-400' :
                    'bg-zinc-800 text-zinc-400'
                  }`}>{job.status}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Results Panel */}
        <div className="flex-1 min-w-0">
          {loadingJob ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <p className="text-zinc-500 text-sm">Loading research...</p>
            </div>
          ) : !results ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <p className="text-zinc-500 text-sm">Enter a product URL above and click Research, or select a past job from the history.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Tab bar */}
              <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
                {TABS.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                      tab === t.key ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {t.icon} {t.label}
                    <span className="ml-1 text-zinc-600 text-xs">({(results[t.key] as unknown[]).length})</span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex flex-col gap-3">

                {/* Competitors */}
                {tab === 'competitors' && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                            <th className="text-left px-4 py-3">Company</th>
                            <th className="text-left px-4 py-3">Platform</th>
                            <th className="text-left px-4 py-3">Listing</th>
                            <th className="text-right px-4 py-3">Price</th>
                            <th className="text-right px-4 py-3">Est. Sales</th>
                            <th className="text-right px-4 py-3">Rating</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {(currentRows as Record<string, string>[]).map((r, i) => (
                            <tr key={i} className="hover:bg-zinc-800/50">
                              <td className="px-4 py-3">
                                <a href={r.store_link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-medium">{r.company_name}</a>
                              </td>
                              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${PLATFORM_COLOR[r.platform] ?? 'bg-zinc-800 text-zinc-400'}`}>{r.platform}</span></td>
                              <td className="px-4 py-3 text-zinc-300 text-xs max-w-[200px] truncate" title={r.listing_title}>{r.listing_title}</td>
                              <td className="px-4 py-3 text-right text-emerald-400 font-medium">{r.price}</td>
                              <td className="px-4 py-3 text-right text-zinc-400 text-xs">{r.est_sales}</td>
                              <td className="px-4 py-3 text-right text-amber-400 text-xs">{r.rating}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pain Points */}
                {tab === 'pain_points' && (
                  <div className="flex flex-col gap-3">
                    {(currentRows as Record<string, string>[]).map((r, i) => (
                      <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-white font-medium">{r.pain_point}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${SEVERITY_COLOR[r.severity] ?? SEVERITY_COLOR.Low}`}>{r.severity}</span>
                        </div>
                        <p className="text-zinc-400 text-sm italic mb-2">"{r.customer_quote}"</p>
                        <div className="bg-indigo-950/50 border border-indigo-900 rounded-lg px-3 py-2">
                          <p className="text-indigo-300 text-xs font-semibold mb-0.5">Counter Angle</p>
                          <p className="text-zinc-300 text-sm">{r.counter_angle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reviews */}
                {tab === 'reviews' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(currentRows as Record<string, string | number>[]).map((r, i) => (
                      <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-white text-sm font-medium">{String(r.reviewer_name)}</p>
                            <Stars rating={Number(r.rating)} />
                          </div>
                          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{String(r.category)}</span>
                        </div>
                        <p className="text-zinc-300 text-sm mb-2">"{String(r.review_snippet)}"</p>
                        {r.core_complaint ? <p className="text-red-400 text-xs">⚠ {String(r.core_complaint)}</p> : null}
                        {r.source_link ? (
                          <a href={String(r.source_link)} target="_blank" rel="noopener noreferrer" className="text-indigo-400 text-xs hover:underline mt-1 inline-block">View Source →</a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {/* Ad Matrix */}
                {tab === 'ad_matrix' && (
                  <div className="flex flex-col gap-4">
                    {['Problem-Aware', 'Desire-Based', 'Social Proof'].map(adset => {
                      const ads = (currentRows as Record<string, string>[]).filter(r => r.adset_name?.includes(adset))
                      if (ads.length === 0) return null
                      return (
                        <div key={adset} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/50">
                            <p className="text-white font-semibold text-sm">📣 {ads[0]?.adset_name}</p>
                            <p className="text-zinc-500 text-xs mt-0.5">Targets: {ads[0]?.meta_targets}</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
                            {ads.map((ad, i) => (
                              <div key={i} className="p-4 flex flex-col gap-2">
                                <p className="text-indigo-400 text-xs font-semibold">{ad.ad_name}</p>
                                <div className="bg-zinc-800 rounded-lg px-3 py-2">
                                  <p className="text-zinc-500 text-xs mb-0.5">Hook</p>
                                  <p className="text-white text-sm font-medium">"{ad.hook}"</p>
                                </div>
                                <p className="text-zinc-300 text-xs leading-relaxed">{ad.primary_text}</p>
                                <div className="mt-auto pt-2 border-t border-zinc-800">
                                  <p className="text-white text-xs font-bold">{ad.headline}</p>
                                  <p className="text-zinc-500 text-xs">{ad.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    {/* Fallback if adsets don't match pattern */}
                    {(currentRows as Record<string, string>[]).filter(r =>
                      !['Problem-Aware', 'Desire-Based', 'Social Proof'].some(a => r.adset_name?.includes(a))
                    ).map((ad, i) => (
                      <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <p className="text-indigo-400 text-xs font-semibold mb-1">{ad.adset_name} — {ad.ad_name}</p>
                        <p className="text-white text-sm font-medium mb-2">"{ad.hook}"</p>
                        <p className="text-zinc-300 text-xs">{ad.primary_text}</p>
                        <p className="text-zinc-500 text-xs mt-2">Targets: {ad.meta_targets}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Creative Hooks */}
                {tab === 'hooks' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(currentRows as Record<string, string>[]).map((r, i) => (
                      <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-white font-semibold text-sm">{r.hook_title}</p>
                          <span className="text-xs bg-purple-950 text-purple-400 px-2 py-0.5 rounded-full flex-shrink-0">{r.hook_type}</span>
                        </div>
                        <p className="text-zinc-500 text-xs mb-3">🎯 {r.target_desire}</p>
                        <div className="bg-zinc-800 rounded-lg px-3 py-2 mb-2">
                          <p className="text-zinc-500 text-xs mb-0.5">On-Screen Text</p>
                          <p className="text-white text-sm font-medium">"{r.on_screen_text}"</p>
                        </div>
                        <p className="text-indigo-300 text-xs font-medium">Headline: {r.headline}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Competitor Ads */}
                {tab === 'competitor_ads' && (
                  <div className="flex flex-col gap-3">
                    {(currentRows as Record<string, string>[]).map((r, i) => (
                      <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-white font-semibold">{r.brand_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${PLATFORM_COLOR[r.platform] ?? 'bg-zinc-800 text-zinc-400'}`}>{r.platform}</span>
                              <span className="text-zinc-500 text-xs">{r.active_days} days active</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                r.est_spend === 'Very High' ? 'bg-red-950 text-red-400' :
                                r.est_spend === 'High' ? 'bg-amber-950 text-amber-400' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>💰 {r.est_spend} spend</span>
                            </div>
                          </div>
                          {r.ad_link && (
                            <a href={r.ad_link} target="_blank" rel="noopener noreferrer"
                              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors">
                              View Ad →
                            </a>
                          )}
                        </div>
                        <p className="text-zinc-300 text-sm leading-relaxed">{r.ad_copy}</p>
                      </div>
                    ))}
                  </div>
                )}

                {currentRows.length === 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                    <p className="text-zinc-500 text-sm">No data for this section.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
