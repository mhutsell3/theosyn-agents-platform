import { logTokenUsage } from '@/lib/usage'

async function ollamaChat(prompt: string, model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'): Promise<string> {
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Piper', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

const PIPER_CONTEXT = `
You are Piper, the Client Relations agent for TheoSYN Labs.

TheoSYN Labs helps small businesses and churches use AI ethically, from a Christian perspective.
Your job: keep the client pipeline healthy, maintain relationships, and ensure no one falls through the cracks.
Tone: warm, professional, faith-informed. Never pushy or salesy.
`

// Days a client should stay in each stage before follow-up
const STAGE_THRESHOLDS: Record<string, number> = {
  Discovery:  5,
  Proposal:   4,
  Onboarding: 7,
  Active:     14,
}

export function flagStaleClients<T extends {
  id: string
  name: string
  stage: string
  contact_name: string | null
  contact_email: string | null
  updated_at: string
}>(clients: T[]): (T & { daysInStage: number })[] {
  return clients
    .filter(c => {
      const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000)
      const threshold = STAGE_THRESHOLDS[c.stage] ?? 7
      return days >= threshold && c.stage !== 'Completed'
    })
    .map(c => ({
      ...c,
      daysInStage: Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000),
    }))
    .sort((a, b) => b.daysInStage - a.daysInStage)
}

export async function generateFollowUp(client: {
  name: string
  stage: string
  contact_name: string | null
  notes: string | null
  daysInStage: number
}): Promise<string> {
  const prompt = `${PIPER_CONTEXT}

Write a warm, brief follow-up email for this client:

Business: ${client.name}
Contact: ${client.contact_name ?? 'their team'}
Current stage: ${client.stage}
Days since last contact: ${client.daysInStage}
Notes: ${client.notes ?? 'none'}

The email should:
- Open warmly, reference their name and business
- Be brief (2-3 short paragraphs)
- Reference where they are in the process (${client.stage} stage)
- Have a clear, soft next step or question
- Sign off as "Milford at TheoSYN Labs"
- Sound human and genuine, not templated

Write only the email body.`

  return ollamaChat(prompt)
}

export async function generateOnboardingChecklist(client: {
  name: string
  type: string
  notes: string | null
}): Promise<string> {
  const prompt = `${PIPER_CONTEXT}

Generate a personalized onboarding checklist for this new client:

Business: ${client.name}
Type: ${client.type}
Project notes: ${client.notes ?? 'general AI consulting'}

Create a practical onboarding checklist with 6-8 items covering:
- Initial kickoff call agenda items
- Access/credentials needed from the client
- Tools to set up together
- First deliverables to confirm
- Communication cadence to establish
- Any faith/values alignment items relevant to a Christian AI company

Format as a markdown checklist.`

  return ollamaChat(prompt)
}

export async function generateHeartbeat(data: {
  totalClients: number
  activeClients: number
  staleClients: { name: string; stage: string; daysInStage: number }[]
  recentMoves: { name: string; stage: string }[]
  newClients: { name: string; type: string }[]
}): Promise<string> {
  const prompt = `${PIPER_CONTEXT}

Generate a weekly pipeline heartbeat report for TheoSYN Labs.

Pipeline data:
- Total clients: ${data.totalClients}
- Active clients: ${data.activeClients}
- Clients needing follow-up: ${data.staleClients.map(c => `${c.name} (${c.stage}, ${c.daysInStage}d)`).join(', ') || 'none'}
- Recent stage moves: ${data.recentMoves.map(c => `${c.name} → ${c.stage}`).join(', ') || 'none'}
- New clients this week: ${data.newClients.map(c => `${c.name} (${c.type})`).join(', ') || 'none'}

Write a concise weekly pipeline report (3-4 paragraphs) covering:
1. Pipeline health summary
2. Who needs immediate follow-up and why
3. Wins or positive momentum
4. Recommended actions for next week

Format as markdown.`

  return ollamaChat(prompt)
}

export async function suggestStageMove(client: {
  name: string
  stage: string
  notes: string | null
  daysInStage: number
}): Promise<string> {
  const prompt = `${PIPER_CONTEXT}

Should this client advance to the next pipeline stage? Give a brief recommendation.

Client: ${client.name}
Current stage: ${client.stage}
Days in stage: ${client.daysInStage}
Notes: ${client.notes ?? 'none'}

Respond in 2 sentences max: yes/no and why. Be direct.`

  return ollamaChat(prompt)
}
