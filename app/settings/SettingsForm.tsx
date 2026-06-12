'use client'

import { useState } from 'react'

const FIELDS = [
  { key: 'gemini_api_key', label: 'Gemini API Key', placeholder: 'AIza…' },
  { key: 'openai_api_key', label: 'OpenAI API Key', placeholder: 'sk-…' },
  { key: 'anthropic_api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-…' },
  { key: 'ollama_host', label: 'Ollama Host URL', placeholder: 'http://your-server:11434' },
]

export default function SettingsForm() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload: Record<string, string> = {}
    for (const [k, v] of Object.entries(values)) {
      if (v.trim()) payload[k] = v
    }
    await fetch('/api/settings', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Model API Keys</h2>
        <p className="text-zinc-500 text-xs">Keys are stored encrypted and used by your agents when calling AI models. Only enter keys for the models you use.</p>

        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="text-zinc-400 text-xs font-medium block mb-1.5">{f.label}</label>
            <input
              type="password"
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
              autoComplete="off"
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </form>
  )
}
