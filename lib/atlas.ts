import { logTokenUsage } from '@/lib/usage'

async function ollamaChat(prompt: string, model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'): Promise<string> {
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Atlas', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

const ATLAS_CONTEXT = `
You are Atlas, the Project Manager agent for TheoSYN Labs.

TheoSYN Labs helps small businesses and churches use AI ethically, from a Christian perspective.
Your job: keep projects on track, surface risks early, track deliverables, and ensure client builds succeed.
Tone: clear, direct, organized. You are a builder — focus on action and outcomes.
`

export interface ProjectRisk {
  id: string
  name: string
  phase: string
  client_name: string | null
  due_date: string | null
  daysUntilDue: number | null
  daysInPhase: number
  risk: 'overdue' | 'at_risk' | 'on_track'
  notes: string | null
}

export function assessProjectRisks(projects: {
  id: string
  name: string
  phase: string
  client_name: string | null
  due_date: string | null
  updated_at: string
  notes: string | null
}[]): ProjectRisk[] {
  const today = new Date()

  return projects
    .filter(p => p.phase !== 'Delivered')
    .map(p => {
      const daysInPhase = Math.floor((today.getTime() - new Date(p.updated_at).getTime()) / 86400000)
      const daysUntilDue = p.due_date
        ? Math.floor((new Date(p.due_date).getTime() - today.getTime()) / 86400000)
        : null

      let risk: 'overdue' | 'at_risk' | 'on_track' = 'on_track'
      if (daysUntilDue !== null && daysUntilDue < 0) risk = 'overdue'
      else if (daysUntilDue !== null && daysUntilDue <= 3) risk = 'at_risk'
      else if (daysInPhase > 14) risk = 'at_risk'

      return { ...p, daysUntilDue, daysInPhase, risk }
    })
    .sort((a, b) => {
      const order = { overdue: 0, at_risk: 1, on_track: 2 }
      return order[a.risk] - order[b.risk]
    })
}

export async function generateStatusReport(project: {
  name: string
  phase: string
  client_name: string | null
  due_date: string | null
  daysUntilDue: number | null
  daysInPhase: number
  risk: string
  notes: string | null
}): Promise<string> {
  const prompt = `${ATLAS_CONTEXT}

Write a brief project status update for this project:

Project: ${project.name}
Client: ${project.client_name ?? 'Internal'}
Phase: ${project.phase}
Due date: ${project.due_date ?? 'Not set'}
Days until due: ${project.daysUntilDue !== null ? project.daysUntilDue : 'N/A'}
Days in current phase: ${project.daysInPhase}
Risk level: ${project.risk}
Notes: ${project.notes ?? 'none'}

Write a 2-3 sentence status update that:
- States current phase and health
- Flags any risks or blockers
- Suggests one specific next action

Be direct and actionable.`

  return ollamaChat(prompt)
}

export async function generateHeartbeat(data: {
  totalProjects: number
  overdueProjects: ProjectRisk[]
  atRiskProjects: ProjectRisk[]
  onTrackProjects: ProjectRisk[]
  deliveredThisWeek: { name: string; client_name: string | null }[]
}): Promise<string> {
  const prompt = `${ATLAS_CONTEXT}

Generate a weekly project status heartbeat for TheoSYN Labs.

Project data:
- Total active projects: ${data.totalProjects}
- Overdue: ${data.overdueProjects.map(p => `${p.name} (${p.daysUntilDue}d overdue)`).join(', ') || 'none'}
- At risk: ${data.atRiskProjects.map(p => `${p.name} (${p.daysUntilDue !== null ? p.daysUntilDue + 'd left' : p.daysInPhase + 'd in phase'} )`).join(', ') || 'none'}
- On track: ${data.onTrackProjects.map(p => p.name).join(', ') || 'none'}
- Delivered this week: ${data.deliveredThisWeek.map(p => p.name).join(', ') || 'none'}

Write a concise weekly project report (3-4 paragraphs) covering:
1. Overall project health score and summary
2. Critical items needing immediate attention
3. Wins — what's on track or just delivered
4. Recommended actions for this week

Format as markdown.`

  return ollamaChat(prompt)
}

export async function generateProjectPlan(project: {
  name: string
  type: string
  client_name: string | null
  notes: string | null
}): Promise<string> {
  const prompt = `${ATLAS_CONTEXT}

Generate a project execution plan for this TheoSYN Labs project:

Project: ${project.name}
Type: ${project.type}
Client: ${project.client_name ?? 'Internal'}
Notes: ${project.notes ?? 'none'}

Create a practical project plan with:
## Phases & Milestones
(List 4-6 key milestones with suggested timeframes)

## Deliverables
(Bullet list of concrete deliverables)

## Dependencies & Risks
(2-3 potential blockers or dependencies to watch)

## Definition of Done
(How we know the project is complete)

Be specific to the project type (${project.type}) and the church/SMB AI context.`

  return ollamaChat(prompt)
}
