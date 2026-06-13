'use client'

import { useState, useEffect, useCallback } from 'react'

const AGENTS = [
  { id: 'theo',   label: 'Theo',   emoji: '🧠', desc: 'Orchestrator' },
  { id: 'nova',   label: 'Nova',   emoji: '✨', desc: 'Content & Marketing' },
  { id: 'sage',   label: 'Sage',   emoji: '📚', desc: 'Research & Intelligence' },
  { id: 'scout',  label: 'Scout',  emoji: '🔍', desc: 'Prospecting & Outreach' },
  { id: 'piper',  label: 'Piper',  emoji: '📋', desc: 'Pipeline & Client Relations' },
  { id: 'atlas',  label: 'Atlas',  emoji: '🗺️', desc: 'Project Management' },
  { id: 'lumen',  label: 'Lumen',  emoji: '💡', desc: 'Finance & Revenue' },
  { id: 'beacon', label: 'Beacon', emoji: '🎓', desc: 'Community & Courses' },
  { id: 'pulse',  label: 'Pulse',  emoji: '📡', desc: 'Social Media Monitoring' },
  { id: 'scribe', label: 'Scribe', emoji: '✍️', desc: 'Curriculum & Materials' },
  { id: 'logos',  label: 'Logos',  emoji: '✝️', desc: 'Knowledge & Theology' },
  { id: 'orion',  label: 'Orion',  emoji: '🪐', desc: 'Product Research' },
  { id: 'forge',  label: 'Forge',  emoji: '🔨', desc: 'Shopify Store Manager' },
  { id: 'remi',   label: 'Remi',   emoji: '📊', desc: 'Meta Ads Intelligence' },
]

export default function AgentSkillsTab() {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[13]) // default to Remi
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)

  const isDirty = content !== savedContent

  const loadSkill = useCallback(async (agentId: string) => {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/settings/agent-skills/${agentId}`)
      const data = await res.json()
      setContent(data.content ?? '')
      setSavedContent(data.content ?? '')
    } catch {
      setStatus({ type: 'error', msg: 'Failed to load skill file' })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSkill(selectedAgent.id)
  }, [selectedAgent, loadSkill])

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/settings/agent-skills/${selectedAgent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        setSavedContent(content)
        setStatus({ type: 'success', msg: 'Saved to disk ✓' })
      } else {
        setStatus({ type: 'error', msg: 'Save failed' })
      }
    } catch {
      setStatus({ type: 'error', msg: 'Save failed' })
    }
    setSaving(false)
  }

  async function handleCommit() {
    setCommitting(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/settings/agent-skills/${selectedAgent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, message: commitMessage }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedContent(content)
        setCommitMessage('')
        if (data.committed) {
          setStatus({ type: 'success', msg: `Committed & pushed to Git ✓ — "${data.message}"` })
        } else if (data.gitError) {
          setStatus({ type: 'error', msg: `Saved but Git error: ${data.gitError}` })
        } else {
          setStatus({ type: 'info', msg: data.message ?? 'No changes to commit' })
        }
      } else {
        setStatus({ type: 'error', msg: data.error ?? 'Commit failed' })
      }
    } catch {
      setStatus({ type: 'error', msg: 'Commit failed' })
    }
    setCommitting(false)
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">

      {/* Agent sidebar */}
      <div className="w-48 flex-shrink-0 flex flex-col gap-1 overflow-y-auto">
        {AGENTS.map(agent => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className={`text-left px-3 py-2.5 rounded-lg transition-colors ${
              selectedAgent.id === agent.id
                ? 'bg-indigo-700 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <span className="mr-2">{agent.emoji}</span>
            <span className="text-sm font-medium">{agent.label}</span>
            <p className="text-xs mt-0.5 opacity-60 truncate">{agent.desc}</p>
          </button>
        ))}
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-semibold">
              {selectedAgent.emoji} {selectedAgent.label} Skill File
            </h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              config/agents/{selectedAgent.id}.md
              {isDirty && <span className="text-amber-400 ml-2">● unsaved changes</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving || loading || !isDirty}
              className="text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Status bar */}
        {status && (
          <div className={`px-4 py-2 rounded-lg text-sm ${
            status.type === 'success' ? 'bg-emerald-950 border border-emerald-700 text-emerald-300' :
            status.type === 'error'   ? 'bg-red-950 border border-red-700 text-red-400' :
                                        'bg-zinc-800 border border-zinc-700 text-zinc-300'
          }`}>
            {status.msg}
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={loading ? 'Loading...' : content}
          onChange={e => setContent(e.target.value)}
          disabled={loading}
          spellCheck={false}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-200 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
          placeholder={`# ${selectedAgent.label} skill file\n\nDefine this agent's methodology, rules, and behavior here.\nThis file is injected into ${selectedAgent.label}'s prompts at runtime.`}
        />

        {/* Git commit row */}
        <div className="flex gap-2">
          <input
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            placeholder={`Commit message (optional) — e.g. "Add Andromeda Method rules"`}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleCommit}
            disabled={committing || loading}
            className="flex-shrink-0 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {committing ? '⏳ Pushing...' : '↑ Save & Commit to Git'}
          </button>
        </div>
        <p className="text-zinc-600 text-xs -mt-1">
          "Save" writes to disk only. "Save & Commit to Git" saves, commits, and pushes to GitHub.
        </p>
      </div>
    </div>
  )
}
