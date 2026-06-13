'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Topic {
  id: string
  track: string
  title: string
  description: string | null
  prerequisites: string[]
  order_index: number
  status: string
  drafts: number
  approved: number
  published: number
  research_count: number
}

interface Material {
  id: string
  topic_id: string
  topic_title: string
  track: string
  material_type: string
  title: string
  body: string | null
  script: string | null
  status: string
  created_at: string
}

interface Research {
  id: string
  topic_title: string | null
  source_type: string
  title: string | null
  summary: string | null
  source_url: string | null
  youtube_video_id: string | null
  created_at: string
}

interface Counts {
  topics: number
  drafts: number
  approved: number
  published: number
  research: number
}

type Tab = 'curriculum' | 'materials' | 'research'

const statusColor: Record<string, string> = {
  planned:     'text-zinc-500 bg-zinc-800',
  in_progress: 'text-amber-400 bg-amber-950',
  complete:    'text-emerald-400 bg-emerald-950',
}

const typeColor: Record<string, string> = {
  playbook:  'text-indigo-400 bg-indigo-950',
  procedure: 'text-blue-400 bg-blue-950',
  module:    'text-purple-400 bg-purple-950',
}

const typeIcon: Record<string, string> = {
  playbook:  '📋',
  procedure: '🔧',
  module:    '🎓',
}

interface SageBrief {
  id: string
  topic: string
  content: string
  created_at: string
}

export default function ScribeDashboard({ topics, materials, recentResearch, sageBriefs, counts }: {
  topics: Topic[]
  materials: Material[]
  recentResearch: Research[]
  sageBriefs: SageBrief[]
  counts: Counts
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('curriculum')
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateType, setGenerateType] = useState<'playbook' | 'procedure' | 'module'>('module')
  const [generateTitle, setGenerateTitle] = useState('')
  const [researching, setResearching] = useState(false)
  const [researchQuery, setResearchQuery] = useState('')
  const [researchType, setResearchType] = useState<'youtube' | 'web' | 'manual'>('youtube')
  const [researchUrl, setResearchUrl] = useState('')
  const [researchContent, setResearchContent] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null)

  // Beacon push state
  const [beaconProducts, setBeaconProducts] = useState<{ _id: string; title: string }[]>([])
  const [beaconProductsLoaded, setBeaconProductsLoaded] = useState(false)
  const [showBeaconModal, setShowBeaconModal] = useState(false)
  const [beaconMaterial, setBeaconMaterial] = useState<Material | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [pushingToBeacon, setPushingToBeacon] = useState(false)
  const [beaconResult, setBeaconResult] = useState<{ success: boolean; msg: string } | null>(null)

  async function loadBeaconProducts() {
    if (beaconProductsLoaded) return
    const res = await fetch('/api/beacon/courses')
    const data = await res.json()
    setBeaconProducts(data.products ?? [])
    setBeaconProductsLoaded(true)
  }

  function openBeaconModal(material: Material) {
    setBeaconMaterial(material)
    setBeaconResult(null)
    setSelectedProduct('')
    setShowBeaconModal(true)
    loadBeaconProducts()
  }

  async function pushToBeacon() {
    if (!beaconMaterial || !selectedProduct) return
    setPushingToBeacon(true)
    setBeaconResult(null)
    const res = await fetch(`/api/beacon/courses/${selectedProduct}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: beaconMaterial.title,
        description: beaconMaterial.body ? beaconMaterial.body.slice(0, 500) : '',
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setBeaconResult({ success: true, msg: `✓ "${beaconMaterial.title}" pushed to GHL Community` })
      // Approve the material if still draft
      if (beaconMaterial.status === 'draft') await approveMaterial(beaconMaterial.id)
    } else {
      setBeaconResult({ success: false, msg: data.error ?? 'Push to GHL failed' })
    }
    setPushingToBeacon(false)
  }

  const tracks = [...new Set(topics.map(t => t.track))]

  async function seedCurriculum() {
    setSeeding(true)
    await fetch('/api/scribe/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: true }),
    })
    setSeeding(false)
    router.refresh()
  }

  async function generate() {
    if (!selectedTopic || !generateTitle) return
    setGenerating(true)
    setGenerateError(null)
    setGenerateSuccess(null)
    try {
      const res = await fetch('/api/scribe/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: selectedTopic.id, materialType: generateType, title: generateTitle }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error ?? `Generation failed (${res.status}) — Ollama may be offline`)
      } else {
        setGenerateSuccess(`✓ "${data.material?.title}" created — switching to Materials tab`)
        setGenerateTitle('')
        setSelectedTopic(null)
        router.refresh()
        // Switch to materials tab after a short delay so router.refresh() has time to update
        setTimeout(() => {
          setTab('materials')
          setGenerateSuccess(null)
          if (data.material) setViewingMaterial(data.material)
        }, 800)
      }
    } catch (err) {
      setGenerateError(`Network error — ${String(err)}`)
    }
    setGenerating(false)
  }

  async function doResearch() {
    if (!selectedTopic) return
    setResearching(true)
    await fetch('/api/scribe/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: selectedTopic.id,
        sourceType: researchType,
        query: researchQuery || selectedTopic.title,
        sourceUrl: researchUrl || undefined,
        manualContent: researchContent || undefined,
        title: researchQuery || selectedTopic.title,
      }),
    })
    setResearching(false)
    setResearchQuery('')
    setResearchUrl('')
    setResearchContent('')
    router.refresh()
  }


  async function approveMaterial(id: string) {
    setApproving(id)
    await fetch('/api/scribe/materials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'approved' }),
    })
    setApproving(null)
    router.refresh()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📜</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Scribe</h1>
            <p className="text-zinc-500 text-sm">Curriculum & Training Agent — research, write, and publish course materials</p>
          </div>
        </div>
        {topics.length === 0 && (
          <button
            onClick={seedCurriculum}
            disabled={seeding}
            className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {seeding ? '⏳ Seeding...' : '🌱 Seed Default Curriculum'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Topics',    value: counts.topics,    color: 'text-white' },
          { label: 'Drafts',    value: counts.drafts,    color: 'text-amber-400' },
          { label: 'Approved',  value: counts.approved,  color: 'text-blue-400' },
          { label: 'Published', value: counts.published, color: 'text-emerald-400' },
          { label: 'Research',  value: counts.research,  color: 'text-purple-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-zinc-500 text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {([['curriculum', '📚 Curriculum'], ['materials', '📄 Materials'], ['research', '🔍 Research']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            {label}
            {t === 'materials' && counts.drafts > 0 && (
              <span className="ml-2 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">{counts.drafts}</span>
            )}
          </button>
        ))}
      </div>

      {/* Curriculum tab */}
      {tab === 'curriculum' && (
        <div className="flex flex-col gap-6">
          {topics.length === 0 ? (
            <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-10 text-center">
              <p className="text-zinc-400 text-sm mb-3">No curriculum yet. Seed the default TheoSYN Command Center curriculum to get started.</p>
              <button onClick={seedCurriculum} disabled={seeding} className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                {seeding ? 'Seeding...' : '🌱 Seed Curriculum'}
              </button>
            </div>
          ) : (
            tracks.map(track => (
              <div key={track}>
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <span className="text-indigo-400">▸</span> {track}
                </h2>
                <div className="flex flex-col gap-2">
                  {topics.filter(t => t.track === track).map(topic => (
                    <div
                      key={topic.id}
                      onClick={() => setSelectedTopic(selectedTopic?.id === topic.id ? null : topic)}
                      className={`bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all ${selectedTopic?.id === topic.id ? 'border-indigo-700' : 'border-zinc-800 hover:border-zinc-700'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white text-sm font-medium">{topic.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[topic.status] ?? 'text-zinc-500 bg-zinc-800'}`}>
                              {topic.status.replace('_', ' ')}
                            </span>
                          </div>
                          {topic.description && <p className="text-zinc-500 text-xs mt-0.5">{topic.description}</p>}
                          {topic.prerequisites?.length > 0 && (
                            <p className="text-zinc-700 text-xs mt-1">Requires: {topic.prerequisites.join(', ')}</p>
                          )}
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-600 flex-shrink-0">
                          {Number(topic.research_count) > 0 && <span>🔍 {topic.research_count}</span>}
                          {Number(topic.drafts) > 0 && <span className="text-amber-600">📄 {topic.drafts}</span>}
                          {Number(topic.approved) > 0 && <span className="text-blue-600">✓ {topic.approved}</span>}
                          {Number(topic.published) > 0 && <span className="text-emerald-600">🚀 {topic.published}</span>}
                        </div>
                      </div>

                      {/* Expanded actions */}
                      {selectedTopic?.id === topic.id && (
                        <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                          {/* Research */}
                          <div>
                            <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest mb-2">Research</p>
                            <div className="flex gap-2 flex-wrap">
                              <select
                                value={researchType}
                                onChange={e => setResearchType(e.target.value as typeof researchType)}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                              >
                                <option value="youtube">YouTube</option>
                                <option value="web">Web URL</option>
                                <option value="manual">Manual Note</option>
                              </select>
                              {researchType === 'web' ? (
                                <input
                                  value={researchUrl}
                                  onChange={e => setResearchUrl(e.target.value)}
                                  placeholder="https://..."
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                              ) : researchType === 'manual' ? (
                                <textarea
                                  value={researchContent}
                                  onChange={e => setResearchContent(e.target.value)}
                                  placeholder="Paste notes or content..."
                                  rows={3}
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                                />
                              ) : (
                                <input
                                  value={researchQuery}
                                  onChange={e => setResearchQuery(e.target.value)}
                                  placeholder={`Search: ${topic.title}`}
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                              )}
                              <button
                                onClick={doResearch}
                                disabled={researching}
                                className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                              >
                                {researching ? '⏳' : '🔍 Research'}
                              </button>
                            </div>
                          </div>

                          {/* Generate */}
                          <div>
                            <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest mb-2">Generate Material</p>
                            {generateError && (
                              <div className="mb-2 px-3 py-2 bg-red-950 border border-red-700 rounded-lg text-red-400 text-xs">{generateError}</div>
                            )}
                            {generateSuccess && (
                              <div className="mb-2 px-3 py-2 bg-emerald-950 border border-emerald-700 rounded-lg text-emerald-400 text-xs">{generateSuccess}</div>
                            )}
                            <div className="flex gap-2 flex-wrap">
                              <select
                                value={generateType}
                                onChange={e => setGenerateType(e.target.value as typeof generateType)}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
                              >
                                <option value="module">📚 Course Module</option>
                                <option value="playbook">📋 Playbook</option>
                                <option value="procedure">🔧 Procedure</option>
                              </select>
                              <input
                                value={generateTitle}
                                onChange={e => setGenerateTitle(e.target.value)}
                                placeholder="Material title..."
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                onClick={generate}
                                disabled={generating || !generateTitle}
                                className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                              >
                                {generating ? '✨ Writing...' : '✨ Generate'}
                              </button>
                            </div>
                            {generating && <p className="text-zinc-500 text-xs mt-2">Scribe is writing... takes 1-2 minutes. Uses Ollama if available, Gemini as fallback.</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Materials tab */}
      {tab === 'materials' && (
        <div className="flex flex-col gap-3">
          {materials.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500 text-sm">No materials yet. Select a topic in the Curriculum tab and generate one.</p>
            </div>
          ) : viewingMaterial ? (
            <div className="flex flex-col gap-4">
              <button onClick={() => setViewingMaterial(null)} className="text-zinc-500 hover:text-white text-sm flex items-center gap-1">
                ← Back to materials
              </button>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <span className="text-white font-semibold">{viewingMaterial.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor[viewingMaterial.material_type] ?? 'text-zinc-400 bg-zinc-800'}`}>
                    {typeIcon[viewingMaterial.material_type]} {viewingMaterial.material_type}
                  </span>
                  <span className="text-zinc-500 text-xs">{viewingMaterial.track} — {viewingMaterial.topic_title}</span>
                </div>

                {viewingMaterial.body && (
                  <div className="mb-6">
                    <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest mb-2">Content</p>
                    <div className="bg-zinc-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {viewingMaterial.body.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) return <h3 key={i} className="text-white font-semibold mt-3 mb-1">{line.slice(3)}</h3>
                        if (line.startsWith('# ')) return <h2 key={i} className="text-white font-bold mt-4 mb-2 text-lg">{line.slice(2)}</h2>
                        if (line.startsWith('- ') || line.match(/^\d+\./)) return <p key={i} className="text-zinc-300 text-sm ml-3 my-0.5">{line}</p>
                        if (line.trim() === '') return <div key={i} className="h-2" />
                        return <p key={i} className="text-zinc-300 text-sm">{line}</p>
                      })}
                    </div>
                  </div>
                )}

                {viewingMaterial.script && (
                  <div className="mb-4">
                    <p className="text-zinc-400 text-xs font-mono uppercase tracking-widest mb-2">Video Script</p>
                    <div className="bg-zinc-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{viewingMaterial.script}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {viewingMaterial.status === 'draft' && (
                    <button
                      onClick={() => approveMaterial(viewingMaterial.id)}
                      disabled={approving === viewingMaterial.id}
                      className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      {approving === viewingMaterial.id ? 'Approving...' : '✓ Approve for Publishing'}
                    </button>
                  )}
                  {viewingMaterial.status === 'approved' && (
                    <p className="text-emerald-400 text-sm">✓ Approved</p>
                  )}
                  <button
                    onClick={() => openBeaconModal(viewingMaterial)}
                    className="bg-indigo-700 hover:bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    🎓 Push to GHL Community
                  </button>
                </div>
              </div>
            </div>
          ) : (
            materials.map(material => (
              <div
                key={material.id}
                onClick={() => setViewingMaterial(material)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-medium">{material.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeColor[material.material_type] ?? 'text-zinc-400 bg-zinc-800'}`}>
                        {typeIcon[material.material_type]} {material.material_type}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">{material.track} — {material.topic_title}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      material.status === 'published' ? 'text-emerald-400 bg-emerald-950' :
                      material.status === 'approved' ? 'text-blue-400 bg-blue-950' :
                      'text-amber-400 bg-amber-950'
                    }`}>
                      {material.status}
                    </span>
                    {material.status === 'draft' && (
                      <button
                        onClick={e => { e.stopPropagation(); approveMaterial(material.id) }}
                        disabled={approving === material.id}
                        className="text-xs bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg"
                      >
                        {approving === material.id ? '...' : '✓ Approve'}
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); openBeaconModal(material) }}
                      className="text-xs bg-indigo-800 hover:bg-indigo-700 text-white px-2 py-1 rounded-lg"
                      title="Push to GHL Community"
                    >
                      🎓
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Research tab */}
      {tab === 'research' && (
        <div className="flex flex-col gap-3">

          {/* Sage Briefs */}
          {sageBriefs.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">🔍 Sage Research Briefs</p>
              {sageBriefs.map(brief => (
                <div key={brief.id} className="bg-zinc-900 border border-indigo-900 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-indigo-300 text-sm font-medium">{brief.topic}</p>
                    <span className="text-zinc-600 text-xs flex-shrink-0">{new Date(brief.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-zinc-400 text-xs line-clamp-3">{brief.content.replace(/##.*\n/g, '').trim().slice(0, 300)}...</p>
                </div>
              ))}
            </div>
          )}

          {/* Scribe Research */}
          {recentResearch.length > 0 && <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1 mt-2">📚 Topic Research</p>}
          {recentResearch.length === 0 && sageBriefs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500 text-sm">No research yet. Select a topic in the Curriculum tab and run research, or generate a brief in Sage.</p>
            </div>
          ) : (
            recentResearch.map(item => (
              <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">
                    {item.source_type === 'youtube' ? '▶️' : item.source_type === 'web' ? '🌐' : '📝'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-white text-sm font-medium truncate">{item.title ?? 'Untitled'}</p>
                      {item.topic_title && <span className="text-zinc-500 text-xs">{item.topic_title}</span>}
                    </div>
                    {item.summary && <p className="text-zinc-400 text-xs line-clamp-3">{item.summary}</p>}
                    {item.source_url && (
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 text-xs hover:underline mt-1 inline-block">
                        {item.youtube_video_id ? `youtube.com/watch?v=${item.youtube_video_id}` : item.source_url}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Beacon push modal */}
      {showBeaconModal && beaconMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBeaconModal(false)} />
          <div className="relative bg-zinc-950 border border-indigo-900 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-bold">🎓 Push to GHL Community</h2>
                <p className="text-zinc-500 text-xs mt-0.5">Select which course to add this module to</p>
              </div>
              <button onClick={() => setShowBeaconModal(false)} className="text-zinc-600 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800">✕</button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 mb-4">
              <p className="text-zinc-400 text-xs">Material</p>
              <p className="text-white text-sm font-medium mt-0.5">{beaconMaterial.title}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{beaconMaterial.material_type} — {beaconMaterial.track}</p>
            </div>

            {!beaconProductsLoaded ? (
              <p className="text-zinc-500 text-sm text-center py-4">Loading GHL courses...</p>
            ) : beaconProducts.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">No GHL courses found. Create a product in GHL Memberships first.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {beaconProducts.map(p => (
                  <button
                    key={p._id}
                    onClick={() => setSelectedProduct(p._id)}
                    className={`text-left px-4 py-3 rounded-lg border transition-colors ${selectedProduct === p._id ? 'border-indigo-500 bg-indigo-950 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'}`}
                  >
                    <p className="text-sm font-medium">{p.title}</p>
                  </button>
                ))}
              </div>
            )}

            {beaconResult && (
              <div className={`px-4 py-2 rounded-lg text-sm mb-4 ${beaconResult.success ? 'bg-emerald-950 border border-emerald-700 text-emerald-300' : 'bg-red-950 border border-red-700 text-red-400'}`}>
                {beaconResult.msg}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowBeaconModal(false)} className="flex-1 text-zinc-400 text-sm px-4 py-2 border border-zinc-700 rounded-lg">
                {beaconResult?.success ? 'Close' : 'Cancel'}
              </button>
              {!beaconResult?.success && (
                <button
                  onClick={pushToBeacon}
                  disabled={pushingToBeacon || !selectedProduct}
                  className="flex-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {pushingToBeacon ? '⏳ Pushing...' : '🎓 Push to GHL'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
