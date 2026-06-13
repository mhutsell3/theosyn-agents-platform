'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Topic {
  id: string
  title: string
  category: string
  scripture: string
  description: string
}

interface Guide {
  id: string
  title: string
  scripture: string
  reflection: string
  prayer: string
  application: string
  drive_url: string | null
  drive_file_id: string | null
  topic_title: string | null
  custom_topic: string | null
  category: string | null
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  'faith-life':  'Faith & Life',
  'devotional':  'Devotional',
  'seasonal':    'Seasonal',
  'small-group': 'Small Group',
  'faith-work':  'Faith & Work',
}

const CATEGORY_COLORS: Record<string, string> = {
  'faith-life':  'text-indigo-400 bg-indigo-950 border-indigo-800',
  'devotional':  'text-violet-400 bg-violet-950 border-violet-800',
  'seasonal':    'text-amber-400 bg-amber-950 border-amber-800',
  'small-group': 'text-emerald-400 bg-emerald-950 border-emerald-800',
  'faith-work':  'text-blue-400 bg-blue-950 border-blue-800',
}

export default function LogosPanel({ topics, guides: initialGuides }: { topics: Topic[]; guides: Guide[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'generate' | 'library'>('library')
  const [guides, setGuides] = useState(initialGuides)
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [customTopic, setCustomTopic] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<Guide | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const grouped = topics.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, Topic[]>)

  async function generate() {
    setGenerating(true)
    setError(null)
    setResult(null)

    const res = await fetch('/api/logos/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: useCustom ? null : (selectedTopic || null),
        customTopic: useCustom ? customTopic : null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Generation failed')
    } else {
      setResult(data.guide)
      setGuides(prev => [data.guide, ...prev])
      setTab('library')
    }
    setGenerating(false)
  }

  const filteredGuides = filterCategory === 'all'
    ? guides
    : guides.filter(g => g.category === filterCategory || g.custom_topic)

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📖</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Logos</h1>
            <p className="text-zinc-500 text-sm">Devotional & Faith Content Agent — generates scripture-rooted guides for Christians</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Mon · Wed · Fri · Sun @ 6am
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {(['library', 'generate'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
              tab === t ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'library' ? `📚 Guide Library (${guides.length})` : '✨ Generate Guide'}
          </button>
        ))}
      </div>

      {/* Generate tab */}
      {tab === 'generate' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUseCustom(false)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${!useCustom ? 'bg-indigo-700 text-white' : 'text-zinc-400 border border-zinc-700'}`}
            >
              Pick from Library
            </button>
            <button
              onClick={() => setUseCustom(true)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${useCustom ? 'bg-indigo-700 text-white' : 'text-zinc-400 border border-zinc-700'}`}
            >
              Custom Topic
            </button>
          </div>

          {!useCustom ? (
            <div>
              <label className="text-zinc-400 text-xs mb-2 block">Select Topic</label>
              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">— Choose a topic —</option>
                {Object.entries(grouped).map(([cat, items]) => (
                  <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
                    {items.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.title} {t.scripture ? `(${t.scripture})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-zinc-400 text-xs mb-2 block">Custom Topic</label>
              <input
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                placeholder="e.g. Dealing with grief as a Christian..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={generate}
            disabled={generating || (!useCustom && !selectedTopic) || (useCustom && !customTopic.trim())}
            className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-6 py-2.5 rounded-lg transition-colors w-fit"
          >
            {generating ? '⏳ Generating with Gemini...' : '📖 Generate Devotional Guide'}
          </button>

          <p className="text-zinc-600 text-xs">Guide will be saved to the library and uploaded to Google Drive automatically.</p>
        </div>
      )}

      {/* Library tab */}
      {tab === 'library' && (
        <div className="flex flex-col gap-4">
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', ...Object.keys(CATEGORY_LABELS)].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterCategory === cat
                    ? 'bg-indigo-700 border-indigo-600 text-white'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {filteredGuides.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500 text-sm">No guides yet. Generate your first devotional above.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredGuides.map(guide => (
                <div key={guide.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  {/* Guide header */}
                  <button
                    className="w-full text-left p-5 flex items-start justify-between gap-4"
                    onClick={() => setExpandedId(expandedId === guide.id ? null : guide.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-white font-semibold text-sm">{guide.title}</p>
                        {guide.category && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[guide.category] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                            {CATEGORY_LABELS[guide.category] ?? guide.category}
                          </span>
                        )}
                        {guide.drive_url && (
                          <a
                            href={guide.drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            📄 View in Drive →
                          </a>
                        )}
                      </div>
                      <p className="text-zinc-500 text-xs italic">{guide.scripture}</p>
                      <p className="text-zinc-600 text-xs mt-1">
                        {new Date(guide.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {(guide.topic_title || guide.custom_topic) && ` · ${guide.topic_title ?? guide.custom_topic}`}
                      </p>
                    </div>
                    <span className="text-zinc-600 text-xs">{expandedId === guide.id ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded content */}
                  {expandedId === guide.id && (
                    <div className="px-5 pb-5 border-t border-zinc-800 flex flex-col gap-4 pt-4">
                      <div>
                        <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-1">Scripture</p>
                        <p className="text-white/80 text-sm italic">{guide.scripture}</p>
                      </div>
                      <div>
                        <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-1">Reflection</p>
                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{guide.reflection}</p>
                      </div>
                      <div>
                        <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-1">Prayer</p>
                        <p className="text-zinc-300 text-sm leading-relaxed italic">{guide.prayer}</p>
                      </div>
                      <div>
                        <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-1">Application</p>
                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{guide.application}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
