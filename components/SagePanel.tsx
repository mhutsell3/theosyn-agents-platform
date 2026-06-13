'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Resource {
  id: string
  title: string
  url: string | null
  category: string
  summary: string | null
  saved_at: string
}

const categoryColor: Record<string, string> = {
  'AI Tool':    'bg-indigo-900 text-indigo-300',
  'Article':    'bg-blue-900 text-blue-300',
  'Framework':  'bg-purple-900 text-purple-300',
  'Community':  'bg-emerald-900 text-emerald-300',
  'Case Study': 'bg-amber-900 text-amber-300',
  'General':    'bg-zinc-700 text-zinc-300',
}

export default function SagePanel() {
  const [topic, setTopic] = useState('')
  const [brief, setBrief] = useState<string | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [loadingResearch, setLoadingResearch] = useState(false)
  const [loadingHeartbeat, setLoadingHeartbeat] = useState(false)
  const [researchError, setResearchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'research' | 'resources'>('research')
  const [pushingToSocial, setPushingToSocial] = useState(false)
  const [pushResult, setPushResult] = useState<number | null>(null)
  const router = useRouter()

  async function handlePushToSocial() {
    if (!brief || !topic) return
    setPushingToSocial(true)
    setPushResult(null)
    const res = await fetch('/api/nova/from-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: topic, summary: brief, sourceType: 'sage' }),
    })
    const data = await res.json()
    if (res.ok) setPushResult(data.count)
    setPushingToSocial(false)
  }

  useEffect(() => {
    fetch('/api/sage/resources')
      .then(r => r.json())
      .then(setResources)
      .catch(() => {})
  }, [brief])

  async function handleResearch() {
    if (!topic.trim()) return
    setLoadingResearch(true)
    setBrief(null)
    setResearchError(null)
    try {
      const res = await fetch('/api/sage/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResearchError(data.error ?? `Request failed (${res.status})`)
        return
      }
      setBrief(data.brief)
      setActiveTab('research')
      router.refresh()
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : 'Network error — is Ollama running?')
    } finally {
      setLoadingResearch(false)
    }
  }

  async function handleHeartbeat() {
    setLoadingHeartbeat(true)
    try {
      await fetch('/api/sage/heartbeat', { method: 'POST' })
      router.refresh()
    } finally {
      setLoadingHeartbeat(false)
    }
  }

  async function handleDeleteResource(id: string) {
    await fetch('/api/sage/resources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setResources(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔍</span>
          <div>
            <h3 className="text-white font-semibold text-sm">Sage — Research & Strategy</h3>
            <p className="text-zinc-500 text-xs">AI trends, competitive intel, church & SMB resources</p>
          </div>
        </div>

        {/* Research input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleResearch()}
            placeholder="Research a topic... (e.g. AI for sermon prep)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleResearch}
            disabled={loadingResearch || !topic.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {loadingResearch ? 'Researching...' : 'Research'}
          </button>
        </div>

        <button
          onClick={handleHeartbeat}
          disabled={loadingHeartbeat}
          className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm py-2 rounded-lg transition-colors text-left px-3"
        >
          {loadingHeartbeat ? '📡 Running weekly digest...' : '📡 Run Weekly Intelligence Digest'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('research')}
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${activeTab === 'research' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
        >
          Research Brief
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${activeTab === 'resources' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
        >
          Resource Library ({resources.length})
        </button>
      </div>

      {/* Research brief */}
      {activeTab === 'research' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 min-h-[200px]">
          {loadingResearch ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <span className="animate-spin">⏳</span>
              Sage is researching... (this can take 1-2 minutes)
            </div>
          ) : researchError ? (
            <p className="text-red-400 text-sm">⚠ {researchError}</p>
          ) : brief ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs font-mono uppercase tracking-widest">Research Brief</span>
                <div className="flex items-center gap-2">
                  {pushResult && <span className="text-emerald-400 text-xs">✓ {pushResult} drafts in Content</span>}
                  <button
                    onClick={handlePushToSocial}
                    disabled={pushingToSocial}
                    className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {pushingToSocial ? '📢 Generating...' : '📢 Push to Social'}
                  </button>
                </div>
              </div>
            <div className="prose prose-invert prose-sm max-w-none">
              {brief.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h2 key={i} className="text-white font-semibold text-sm mt-4 mb-1">{line.slice(3)}</h2>
                if (line.startsWith('- ')) return <p key={i} className="text-zinc-300 text-sm pl-2">• {line.slice(2)}</p>
                if (line.trim() === '') return <div key={i} className="h-1" />
                return <p key={i} className="text-zinc-300 text-sm">{line}</p>
              })}
            </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Enter a topic above and click Research to generate a brief.</p>
          )}
        </div>
      )}

      {/* Resource library */}
      {activeTab === 'resources' && (
        <div className="flex flex-col gap-2">
          {resources.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-zinc-600 text-sm">No resources yet. Run a research brief to populate the library.</p>
            </div>
          ) : (
            resources.map(r => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor[r.category] ?? categoryColor['General']}`}>
                      {r.category}
                    </span>
                    {r.url && r.url !== '#' && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs truncate max-w-[200px]">
                        {r.url}
                      </a>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium">{r.title}</p>
                  {r.summary && <p className="text-zinc-400 text-xs mt-0.5">{r.summary}</p>}
                </div>
                <button
                  onClick={() => handleDeleteResource(r.id)}
                  className="text-zinc-700 hover:text-rose-400 text-xs transition-colors flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
