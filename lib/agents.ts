import db from './db'

export interface AgentStatus {
  id: string
  name: string
  role: string
  avatar_emoji: string
  ollama_model: string | null
  last_heartbeat: string | null
  isOnline: boolean
  lastAction: string | null
  minutesAgo: number | null
}

export async function getAgentStatuses(): Promise<AgentStatus[]> {
  const [agents, heartbeats] = await Promise.all([
    db`SELECT id, name, role, avatar_emoji, ollama_model, last_heartbeat FROM agents ORDER BY name ASC` as unknown as {
      id: string; name: string; role: string; avatar_emoji: string
      ollama_model: string | null; last_heartbeat: string | null
    }[],
    db`
      SELECT DISTINCT ON (agent_id) agent_id, content, created_at
      FROM heartbeats
      ORDER BY agent_id, created_at DESC
    ` as unknown as { agent_id: string; content: string; created_at: string }[],
  ])

  const heartbeatMap = new Map(heartbeats.map(h => [h.agent_id, h]))

  return agents.map(a => {
    const hb = heartbeatMap.get(a.id)
    const lastTime = a.last_heartbeat ? new Date(a.last_heartbeat) : null
    const minutesAgo = lastTime ? Math.floor((Date.now() - lastTime.getTime()) / 60000) : null
    const isOnline = minutesAgo !== null && minutesAgo < 60

    return {
      ...a,
      isOnline,
      lastAction: hb ? hb.content.slice(0, 120).replace(/#+\s/g, '').trim() : null,
      minutesAgo,
    }
  })
}
