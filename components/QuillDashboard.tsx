'use client'

import { useState } from 'react'

interface VoiceProfile {
  tone: { formal_casual: number; warmth: number; faith_level: number; confidence: number } | null
  vocabulary: { signature_phrases: string[]; preferred_words: string[]; avoid_words: string[] } | null
  structure: { avg_sentence_length: string; uses_questions: boolean; paragraph_style: string; uses_bullet_points: boolean } | null
  opening_style: string | null
  closing_style: string | null
  cta_style: string | null
  themes: string[] | null
  do_list: string[] | null
  dont_list: string[] | null
  example_sentences: string[] | null
  summary: string | null
  sample_count: number
  last_analyzed_at: string | null
}

interface Sample {
  id: string
  source: string
  account: string | null
  subject: string
  preview: string
  created_at: string
}

interface Props {
  profile: VoiceProfile | null
  sampleCount: number
}

const SOURCE_COLOR: Record<string, string> = {
  gmail:    'bg-red-900 text-red-300',
  scout:    'bg-blue-900 text-blue-300',
  nova:     'bg-purple-900 text-purple-300',
  beacon:   'bg-indigo-900 text-indigo-300',
  manual:   'bg-zinc-700 text-zinc-300',
}

function ToneBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function QuillDashboard({ profile: initialProfile, sampleCount: initialCount }: Props) {
  const [profile, setProfile] = useState(initialProfile)
  const [sampleCount, setSampleCount] = useState(initialCount)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<{ gmail: number; internal: number } | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [showSamples, setShowSamples] = useState(false)
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [manualText, setManualText] = useState('')
  const [manualSubject, setManualSubject] = useState('')
  const [addingManual, setAddingManual] = useState(false)
  const [showAddManual, setShowAddManual] = useState(false)
  const [showAddUrl, setShowAddUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlResult, setUrlResult] = useState<{ ok?: boolean; skipped?: boolean; title?: string; message?: string; error?: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'vocabulary' | 'examples' | 'samples'>('profile')

  // jsonb columns may come back as strings if double-encoded — normalize once
  function safeParse<T>(val: unknown): T | null {
    if (!val) return null
    if (typeof val === 'string') { try { return JSON.parse(val) as T } catch { return null } }
    return val as T
  }
  const tone = safeParse<VoiceProfile['tone']>(profile?.tone)
  const vocabulary = safeParse<VoiceProfile['vocabulary']>(profile?.vocabulary)
  const structure = safeParse<VoiceProfile['structure']>(profile?.structure)

  async function runAnalysis() {
    setAnalyzing(true)
    setAnalyzeResult(null)
    const res = await fetch('/api/quill/analyze', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setAnalyzeResult(data)
      // Reload profile
      const profileRes = await fetch('/api/quill/profile')
      const profileData = await profileRes.json()
      setProfile(profileData.profile)
      setSampleCount(profileData.sampleCount)
    }
    setAnalyzing(false)
  }

  async function loadSamples() {
    setLoadingSamples(true)
    const res = await fetch('/api/quill/samples')
    const data = await res.json()
    setSamples(data.samples ?? [])
    setShowSamples(true)
    setLoadingSamples(false)
  }

  async function addUrlSample() {
    if (!urlInput.trim().startsWith('http')) return
    setAddingUrl(true)
    setUrlResult(null)
    const res = await fetch('/api/quill/ingest-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput.trim() }),
    })
    const data = await res.json()
    setUrlResult(data)
    if (data.ok) {
      setSampleCount(c => c + (data.skipped ? 0 : 1))
      setUrlInput('')
    }
    setAddingUrl(false)
  }

  async function addManualSample() {
    if (!manualText.trim()) return
    setAddingManual(true)
    await fetch('/api/quill/samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: manualText, subject: manualSubject }),
    })
    setManualText('')
    setManualSubject('')
    setShowAddManual(false)
    setAddingManual(false)
    setSampleCount(c => c + 1)
  }

  const hasProfile = profile?.summary && profile.summary !== 'Not yet analyzed.'

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🖊️</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Quill</h1>
            <p className="text-zinc-500 text-sm">Brand Voice Agent — analyzes your writing to build a living voice profile</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setShowAddUrl(v => !v); setShowAddManual(false); setUrlResult(null) }}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            🔗 Add URL
          </button>
          <button
            onClick={() => { setShowAddManual(v => !v); setShowAddUrl(false) }}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + Add Sample
          </button>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {analyzing ? '⏳ Analyzing...' : '🔍 Run Analysis'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Writing Samples', value: sampleCount, color: 'text-white' },
          { label: 'Last Analyzed', value: profile?.last_analyzed_at ? new Date(profile.last_analyzed_at).toLocaleDateString() : 'Never', color: 'text-zinc-400' },
          { label: 'Themes Found', value: profile?.themes?.length ?? 0, color: 'text-indigo-400' },
          { label: 'Signature Phrases', value: vocabulary?.signature_phrases?.length ?? 0, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-zinc-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Analyze result */}
      {analyzeResult && (
        <div className="bg-emerald-950 border border-emerald-700 rounded-xl px-5 py-3">
          <p className="text-emerald-300 text-sm font-semibold">✓ Analysis complete</p>
          <p className="text-emerald-600 text-xs mt-0.5">
            Pulled {analyzeResult.gmail} Gmail emails · {analyzeResult.internal} internal samples · Voice profile updated
          </p>
        </div>
      )}

      {/* Add from URL */}
      {showAddUrl && (
        <div className="bg-zinc-900 border border-indigo-700 rounded-xl p-5 flex flex-col gap-3">
          <h2 className="text-white font-semibold text-sm">Add Blog Article by URL</h2>
          <p className="text-zinc-500 text-xs">Quill will fetch the article, strip the HTML, and add the text as a writing sample for voice analysis.</p>
          <input
            type="url"
            placeholder="https://yourblog.com/your-article"
            value={urlInput}
            onChange={e => { setUrlInput(e.target.value); setUrlResult(null) }}
            onKeyDown={e => e.key === 'Enter' && addUrlSample()}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          {urlResult && (
            <p className={`text-xs ${urlResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {urlResult.error ?? (urlResult.skipped ? `Already ingested` : `✓ Added: "${urlResult.title}"`)}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={addUrlSample}
              disabled={addingUrl || !urlInput.startsWith('http')}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {addingUrl ? '⏳ Fetching...' : '🔗 Fetch & Add'}
            </button>
            <button onClick={() => { setShowAddUrl(false); setUrlResult(null) }} className="text-zinc-500 text-sm px-4 py-2 hover:text-zinc-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add manual sample */}
      {showAddManual && (
        <div className="bg-zinc-900 border border-indigo-700 rounded-xl p-5 flex flex-col gap-3">
          <h2 className="text-white font-semibold text-sm">Add Writing Sample</h2>
          <p className="text-zinc-500 text-xs">Paste any email, post, or message you've written. The more samples, the better the analysis.</p>
          <input
            value={manualSubject}
            onChange={e => setManualSubject(e.target.value)}
            placeholder="Subject / label (optional)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <textarea
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            placeholder="Paste your writing here..."
            rows={6}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowAddManual(false)} className="text-zinc-400 text-sm px-4 py-2 border border-zinc-700 rounded-lg">Cancel</button>
            <button onClick={addManualSample} disabled={addingManual || !manualText.trim()} className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
              {addingManual ? 'Saving...' : 'Save Sample'}
            </button>
          </div>
        </div>
      )}

      {!hasProfile ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center flex flex-col items-center gap-4">
          <span className="text-5xl">🖊️</span>
          <p className="text-white font-semibold">No voice profile yet</p>
          <p className="text-zinc-500 text-sm max-w-sm">Click <strong>Run Analysis</strong> to pull your Gmail sent emails, Scout outreach, Nova posts, and Beacon emails — then Quill will analyze them to build your brand voice profile.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-indigo-950 border border-indigo-700 rounded-xl p-5">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">Voice Summary</p>
            <p className="text-white text-sm leading-relaxed">{profile?.summary}</p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
            {(['profile', 'vocabulary', 'examples', 'samples'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setActiveTab(t); if (t === 'samples' && !showSamples) loadSamples() }}
                className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors ${activeTab === t ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Profile tab */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tone bars */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
                <p className="text-white font-semibold text-sm">Tone Profile</p>
                {tone && (
                  <>
                    <ToneBar label="Casual ← → Formal" value={tone.formal_casual} />
                    <ToneBar label="Warmth" value={tone.warmth} />
                    <ToneBar label="Faith Integration" value={tone.faith_level} />
                    <ToneBar label="Confidence" value={tone.confidence} />
                  </>
                )}
              </div>

              {/* Structure */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
                <p className="text-white font-semibold text-sm">Writing Structure</p>
                {structure && (
                  <div className="flex flex-col gap-2">
                    {[
                      ['Sentence length', structure.avg_sentence_length],
                      ['Paragraph style', structure.paragraph_style],
                      ['Uses questions', structure.uses_questions ? 'Yes' : 'No'],
                      ['Uses bullet points', structure.uses_bullet_points ? 'Yes' : 'No'],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between text-sm border-b border-zinc-800 pb-2">
                        <span className="text-zinc-400">{label}</span>
                        <span className="text-white capitalize">{val}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-col gap-2">
                  <div>
                    <p className="text-zinc-400 text-xs mb-1">Opening style</p>
                    <p className="text-zinc-300 text-xs">{profile?.opening_style}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-xs mb-1">Closing style</p>
                    <p className="text-zinc-300 text-xs">{profile?.closing_style}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-xs mb-1">CTA style</p>
                    <p className="text-zinc-300 text-xs">{profile?.cta_style}</p>
                  </div>
                </div>
              </div>

              {/* Themes */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-white font-semibold text-sm mb-3">Recurring Themes</p>
                <div className="flex flex-wrap gap-2">
                  {profile?.themes?.map(t => (
                    <span key={t} className="bg-indigo-900 text-indigo-300 text-xs px-3 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              </div>

              {/* Do / Don't */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-white font-semibold text-sm mb-3">Do's & Don'ts</p>
                <div className="flex flex-col gap-2">
                  {profile?.do_list?.map(d => (
                    <p key={d} className="text-emerald-400 text-xs">✓ {d}</p>
                  ))}
                  {profile?.dont_list?.map(d => (
                    <p key={d} className="text-red-400 text-xs">✗ {d}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Vocabulary tab */}
          {activeTab === 'vocabulary' && (
            vocabulary ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-white font-semibold text-sm mb-3">Signature Phrases</p>
                  <div className="flex flex-col gap-2">
                    {(vocabulary.signature_phrases ?? []).map(p => (
                      <p key={p} className="text-indigo-300 text-sm italic">"{p}"</p>
                    ))}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-white font-semibold text-sm mb-3">Preferred Words</p>
                  <div className="flex flex-wrap gap-2">
                    {(vocabulary.preferred_words ?? []).map(w => (
                      <span key={w} className="bg-emerald-900 text-emerald-300 text-xs px-2 py-1 rounded-full">{w}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-white font-semibold text-sm mb-3">Words to Avoid</p>
                  <div className="flex flex-wrap gap-2">
                    {(vocabulary.avoid_words ?? []).map(w => (
                      <span key={w} className="bg-red-950 text-red-400 text-xs px-2 py-1 rounded-full line-through">{w}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-zinc-500 text-sm text-center py-10">
                No vocabulary data yet — run an analysis first.
              </div>
            )
          )}

          {/* Examples tab */}
          {activeTab === 'examples' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
              <p className="text-white font-semibold text-sm">Example Sentences in Your Voice</p>
              <p className="text-zinc-500 text-xs">Extracted directly from your writing — these best represent how you communicate.</p>
              {profile?.example_sentences?.map((s, i) => (
                <div key={i} className="border-l-2 border-indigo-600 pl-4">
                  <p className="text-zinc-300 text-sm italic">"{s}"</p>
                </div>
              ))}
            </div>
          )}

          {/* Samples tab */}
          {activeTab === 'samples' && (
            <div className="flex flex-col gap-3">
              {loadingSamples && <p className="text-zinc-500 text-sm">Loading samples...</p>}
              {samples.map(s => (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLOR[s.source] ?? 'bg-zinc-800 text-zinc-400'}`}>{s.source}</span>
                    {s.account && <span className="text-zinc-500 text-xs">{s.account}</span>}
                    <p className="text-white text-sm font-medium truncate">{s.subject || 'Untitled'}</p>
                    <span className="text-zinc-600 text-xs ml-auto flex-shrink-0">{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-zinc-500 text-xs line-clamp-2">{s.preview}...</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
