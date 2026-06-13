import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — return all agents with their settings + available Ollama models
export async function GET() {
  const [agents, ollamaModels] = await Promise.all([
    db`SELECT id, name, persona, role, avatar_emoji, category, enabled, ollama_model, gemini_model, last_heartbeat FROM agents ORDER BY category, name`,
    fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/tags`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then(d => (d.models ?? []).map((m: { name: string }) => m.name).sort())
      .catch(() => [] as string[]),
  ])

  return NextResponse.json({ agents, ollamaModels })
}

// PATCH — update a single agent's settings
export async function PATCH(req: NextRequest) {
  const { id, enabled, ollama_model, gemini_model } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updated = await db`
    UPDATE agents
    SET
      enabled      = COALESCE(${enabled ?? null}, enabled),
      ollama_model = COALESCE(${ollama_model ?? null}, ollama_model),
      gemini_model = COALESCE(${gemini_model ?? null}, gemini_model)
    WHERE id = ${id}
    RETURNING id, name, enabled, ollama_model, gemini_model`

  return NextResponse.json(updated[0])
}
