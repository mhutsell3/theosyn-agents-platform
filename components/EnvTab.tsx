'use client'

import { useEffect, useState, useRef } from 'react'

// Groups define order, labels, descriptions, and which keys are sensitive
const ENV_GROUPS: {
  label: string
  keys: { key: string; description: string; sensitive?: boolean; placeholder?: string }[]
}[] = [
  {
    label: 'App',
    keys: [
      { key: 'NEXT_PUBLIC_APP_URL', description: 'Public URL of this app', placeholder: 'https://command.theosynlabs.com' },
      { key: 'VOICE_SERVICE_URL',   description: 'TheoVoice WebSocket service URL', placeholder: 'ws://localhost:8765' },
    ],
  },
  {
    label: 'Database',
    keys: [
      { key: 'DATABASE_URL', description: 'PostgreSQL connection string', sensitive: true, placeholder: 'postgresql://user:pass@localhost:5432/theosyn' },
    ],
  },
  {
    label: 'Authentication',
    keys: [
      { key: 'AUTH_SECRET',        description: 'NextAuth secret key', sensitive: true },
      { key: 'AUTH_URL',           description: 'NextAuth base URL', placeholder: 'https://command.theosynlabs.com' },
      { key: 'AUTH_GOOGLE_ID',     description: 'Google OAuth client ID', sensitive: true },
      { key: 'AUTH_GOOGLE_SECRET', description: 'Google OAuth client secret', sensitive: true },
      { key: 'ALLOWED_EMAIL',      description: 'Email address allowed to log in', placeholder: 'you@example.com' },
    ],
  },
  {
    label: 'AI — Ollama',
    keys: [
      { key: 'OLLAMA_URL',            description: 'Ollama server URL', placeholder: 'http://localhost:11434' },
      { key: 'OLLAMA_MODEL',          description: 'Default Ollama model', placeholder: 'llama3.1:8b' },
      { key: 'OLLAMA_MODEL_RESEARCH', description: 'Ollama model for Sage research tasks', placeholder: 'llama3.1:8b' },
    ],
  },
  {
    label: 'AI — Gemini',
    keys: [
      { key: 'GEMINI_API_KEY', description: 'Google Gemini API key', sensitive: true },
      { key: 'GEMINI_MODEL',   description: 'Gemini model name', placeholder: 'gemini-2.0-flash-001' },
    ],
  },
  {
    label: 'Google APIs',
    keys: [
      { key: 'GOOGLE_PLACES_API_KEY',   description: 'Google Places API key (Scout prospecting)', sensitive: true },
      { key: 'GOOGLE_PAGESPEED_API_KEY', description: 'PageSpeed Insights API key (Scout website audit)', sensitive: true },
    ],
  },
  {
    label: 'Scout — Adzuna',
    keys: [
      { key: 'ADZUNA_APP_ID',  description: 'Adzuna API app ID' },
      { key: 'ADZUNA_APP_KEY', description: 'Adzuna API app key', sensitive: true },
    ],
  },
  {
    label: 'Scout — Search Area',
    keys: [
      { key: 'SCOUT_CENTER_LAT',      description: 'Search center latitude',  placeholder: '39.7684' },
      { key: 'SCOUT_CENTER_LNG',      description: 'Search center longitude', placeholder: '-86.1581' },
      { key: 'SCOUT_RADIUS_METERS',   description: 'Search radius in meters', placeholder: '50000' },
    ],
  },
  {
    label: 'Notion',
    keys: [
      { key: 'NOTION_TOKEN',            description: 'Notion integration token', sensitive: true },
      { key: 'NOTION_PROJECTS_PAGE_ID', description: 'Notion Projects page ID' },
    ],
  },
  {
    label: 'n8n',
    keys: [
      { key: 'N8N_URL',     description: 'n8n instance URL', placeholder: 'http://localhost:5678' },
      { key: 'N8N_API_KEY', description: 'n8n API key', sensitive: true },
    ],
  },
  {
    label: 'Deploy',
    keys: [
      { key: 'DEPLOY_SECRET', description: 'Secret token for one-tap deploy webhook', sensitive: true },
    ],
  },
  {
    label: 'YouTube (Scribe)',
    keys: [
      { key: 'YOUTUBE_API_KEY', description: 'YouTube Data API v3 key (Scribe research)', sensitive: true },
    ],
  },
  {
    label: 'GoHighLevel (Beacon)',
    keys: [
      { key: 'GHL_API_KEY',             description: 'GHL subaccount API key', sensitive: true },
      { key: 'GHL_LOCATION_ID',         description: 'GHL subaccount location ID' },
      { key: 'BEACON_WEBHOOK_SECRET',   description: 'Secret token for Beacon webhook endpoint', sensitive: true },
    ],
  },
  {
    label: 'Stripe',
    keys: [
      { key: 'STRIPE_SECRET_KEY',      description: 'Stripe secret key', sensitive: true },
      { key: 'STRIPE_WEBHOOK_SECRET',  description: 'Stripe webhook signing secret', sensitive: true },
    ],
  },
]

// All known keys for filtering unknowns into "Other"
const KNOWN_KEYS = new Set(ENV_GROUPS.flatMap(g => g.keys.map(k => k.key)))

export default function EnvTab() {
  const [vars, setVars]           = useState<Record<string, string>>({})
  const [edits, setEdits]         = useState<Record<string, string>>({})
  const [revealed, setRevealed]   = useState<Set<string>>(new Set())
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [needsRestart, setNeedsRestart] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [newKey, setNewKey]       = useState('')
  const [newVal, setNewVal]       = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/settings/env')
      .then(r => r.json())
      .then(d => { setVars(d.vars ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function change(key: string, value: string) {
    setEdits(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const updates = { ...edits }
    if (newKey.trim() && newVal.trim()) {
      updates[newKey.trim()] = newVal.trim()
    }
    await fetch('/api/settings/env', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    setVars(prev => ({ ...prev, ...updates }))
    setEdits({})
    setNewKey('')
    setNewVal('')
    setAddingNew(false)
    setSaving(false)
    setSaved(true)
    setNeedsRestart(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSaved(false), 3000)
  }

  async function deleteKey(key: string) {
    if (!confirm(`Remove ${key} from .env.local?`)) return
    await fetch('/api/settings/env', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    setVars(prev => { const n = { ...prev }; delete n[key]; return n })
    setNeedsRestart(true)
  }

  function toggleReveal(key: string) {
    setRevealed(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  const hasEdits = Object.keys(edits).length > 0 || (newKey.trim() && newVal.trim())

  // Other vars not in our known groups
  const otherVars = Object.entries(vars).filter(([k]) => !KNOWN_KEYS.has(k))

  if (loading) return <div className="text-zinc-500 text-sm py-8 text-center">Reading .env.local...</div>

  return (
    <div className="flex flex-col gap-6">
      {/* Restart banner */}
      {needsRestart && (
        <div className="bg-amber-950 border border-amber-700 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
          <div>
            <span className="text-amber-300 font-semibold text-sm">Restart required</span>
            <p className="text-amber-500 text-xs mt-0.5">Changes saved to .env.local. Restart PM2 for them to take effect: <code className="bg-amber-900 px-1 rounded">pm2 restart theosyn</code></p>
          </div>
          <button onClick={() => setNeedsRestart(false)} className="text-amber-600 hover:text-amber-400 text-xs">Dismiss</button>
        </div>
      )}

      {/* Save bar */}
      {hasEdits && (
        <div className="sticky top-0 z-10 bg-zinc-950 border border-indigo-700 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
          <span className="text-indigo-300 text-sm">{Object.keys(edits).length} unsaved change{Object.keys(edits).length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={() => setEdits({})} className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-700">Cancel</button>
            <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {saved && !hasEdits && (
        <div className="bg-emerald-950 border border-emerald-700 rounded-xl px-5 py-3 text-emerald-300 text-sm">
          ✓ Changes saved to .env.local
        </div>
      )}

      {/* Groups */}
      {ENV_GROUPS.map(group => {
        const groupHasAny = group.keys.some(({ key }) => vars[key] !== undefined || edits[key] !== undefined)
        return (
          <div key={group.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4 text-sm">{group.label}</h2>
            <div className="flex flex-col gap-3">
              {group.keys.map(({ key, description, sensitive, placeholder }) => {
                const current = edits[key] ?? vars[key] ?? ''
                const isRevealed = revealed.has(key) || !sensitive
                const isDirty = edits[key] !== undefined && edits[key] !== vars[key]
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-zinc-400 text-xs font-mono">{key}</label>
                      <span className="text-zinc-600 text-xs">{description}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type={isRevealed ? 'text' : 'password'}
                        value={current}
                        onChange={e => change(key, e.target.value)}
                        placeholder={placeholder ?? ''}
                        className={`flex-1 bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500 ${
                          isDirty ? 'border-indigo-500' : 'border-zinc-700'
                        } ${!current ? 'border-dashed' : ''}`}
                      />
                      {sensitive && (
                        <button
                          onClick={() => toggleReveal(key)}
                          className="text-zinc-500 hover:text-zinc-300 px-2 text-xs border border-zinc-700 rounded-lg"
                        >
                          {revealed.has(key) ? 'Hide' : 'Show'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Other / unknown vars */}
      {otherVars.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 text-sm">Other</h2>
          <div className="flex flex-col gap-3">
            {otherVars.map(([key, val]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-zinc-400 text-xs font-mono">{key}</label>
                  <button onClick={() => deleteKey(key)} className="text-red-600 hover:text-red-400 text-xs">Remove</button>
                </div>
                <input
                  type="text"
                  value={edits[key] ?? val}
                  onChange={e => change(key, e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new var */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">Add New Variable</h2>
          {!addingNew && (
            <button onClick={() => setAddingNew(true)} className="text-indigo-400 hover:text-indigo-300 text-sm">+ Add</button>
          )}
        </div>
        {addingNew && (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value.toUpperCase())}
              placeholder="VARIABLE_NAME"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={newVal}
              onChange={e => setNewVal(e.target.value)}
              placeholder="value"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2">
              <button onClick={() => { setAddingNew(false); setNewKey(''); setNewVal('') }} className="text-zinc-400 text-sm px-3 py-1.5 border border-zinc-700 rounded-lg">Cancel</button>
              <button onClick={save} disabled={!newKey.trim() || !newVal.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg">Save</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-zinc-600 text-xs text-center">
        Changes are written to .env.local on disk. Restart the server with <code className="bg-zinc-800 px-1 rounded">pm2 restart theosyn</code> for changes to take effect.
      </p>
    </div>
  )
}
