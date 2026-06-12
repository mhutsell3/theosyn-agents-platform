import db from './db'

export interface AgentStatus {
  id: string
  name: string
  role: string
  avatar_emoji: string
  ollama_model: string | null
  last_heartbeat: string | null
  isOnline: boolean
  isAvailable: boolean
  lastAction: string | null
  minutesAgo: number | null
}

export interface AdminAgent {
  id: string
  name: string
  role: string
  avatar_emoji: string
  org_id: string | null
  org_name: string | null
  enabled: boolean
  system_enabled: boolean
  last_heartbeat: string | null
}

export async function getAgentStatuses(orgId: string): Promise<AgentStatus[]> {
  const [agents, heartbeats] = await Promise.all([
    db`
      SELECT id, name, role, avatar_emoji, ollama_model, last_heartbeat
      FROM agents
      WHERE enabled = true AND system_enabled = true AND org_id = ${orgId}
      ORDER BY name ASC
    ` as unknown as {
      id: string; name: string; role: string; avatar_emoji: string
      ollama_model: string | null; last_heartbeat: string | null
    }[],
    db`
      SELECT DISTINCT ON (agent_id) agent_id, content, created_at
      FROM heartbeats h
      JOIN agents a ON a.id = h.agent_id
      WHERE a.org_id = ${orgId} AND a.system_enabled = true
      ORDER BY agent_id, created_at DESC
    ` as unknown as { agent_id: string; content: string; created_at: string }[],
  ])

  const heartbeatMap = new Map(heartbeats.map(h => [h.agent_id, h]))

  return agents.map(a => {
    const hb = heartbeatMap.get(a.id)
    const lastTime = a.last_heartbeat ? new Date(a.last_heartbeat) : null
    const minutesAgo = lastTime ? Math.floor((Date.now() - lastTime.getTime()) / 60000) : null
    const isOnline = minutesAgo !== null && minutesAgo < 60
    const isAvailable = minutesAgo !== null && minutesAgo < 480

    return {
      ...a,
      isOnline,
      isAvailable,
      lastAction: hb ? hb.content.slice(0, 120).replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s?/g, '').replace(/`/g, '').trim() : null,
      minutesAgo,
    }
  })
}

export async function getAllAgentsForAdmin(): Promise<AdminAgent[]> {
  return db`
    SELECT a.id, a.name, a.role, a.avatar_emoji, a.org_id, o.name as org_name,
           a.enabled, a.system_enabled, a.last_heartbeat
    FROM agents a
    LEFT JOIN organizations o ON o.id = a.org_id
    ORDER BY a.system_enabled DESC, o.name ASC, a.name ASC
  ` as unknown as AdminAgent[]
}

export async function setAgentSystemEnabled(agentId: string, value: boolean) {
  await db`UPDATE agents SET system_enabled = ${value} WHERE id = ${agentId}`
}

export async function getOrgSettings(orgId: string): Promise<Record<string, string>> {
  const rows = await db`
    SELECT key, value FROM org_settings WHERE org_id = ${orgId}
  ` as { key: string; value: string }[]
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

export async function upsertOrgSetting(orgId: string, key: string, value: string) {
  await db`
    INSERT INTO org_settings (org_id, key, value)
    VALUES (${orgId}, ${key}, ${value})
    ON CONFLICT (org_id, key) DO UPDATE SET value = ${value}, updated_at = now()
  `
}
