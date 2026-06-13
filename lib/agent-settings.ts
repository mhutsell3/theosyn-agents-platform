import { db } from '@/lib/db'

interface AgentSettings {
  id: string
  enabled: boolean
  ollama_model: string | null
  gemini_model: string | null
}

export async function getAgentSettings(name: string): Promise<AgentSettings | null> {
  const rows = await db`
    SELECT id, enabled, ollama_model, gemini_model
    FROM agents WHERE name = ${name} LIMIT 1`
  return (rows[0] as AgentSettings) ?? null
}

// Returns true if the agent is enabled (or missing from DB — fail open)
export async function isAgentEnabled(name: string): Promise<boolean> {
  const settings = await getAgentSettings(name)
  return settings?.enabled ?? true
}
