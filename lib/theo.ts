import { db } from '@/lib/db'
import { logTokenUsage } from '@/lib/usage'
import type { ProjectRisk } from '@/lib/atlas'
import type { InvoiceAlert } from '@/lib/lumen'
import { sendSlackMessage } from '@/lib/slack'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const THEO_MODEL = process.env.THEO_MODEL ?? 'gemma4:e4b'
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const AUTONOMOUS = process.env.THEO_AUTONOMOUS === 'true'

// ── Ollama chat with tool support ────────────────────────────────────────────

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
}

interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description: string; enum?: string[] }>
      required?: string[]
    }
  }
}

async function ollamaChat(messages: OllamaMessage[], tools?: OllamaTool[]): Promise<OllamaMessage> {
  const body: Record<string, unknown> = { model: THEO_MODEL, messages, stream: false }
  if (tools?.length) body.tools = tools

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const data = await res.json()
  logTokenUsage({
    agent: 'Theo',
    model: THEO_MODEL,
    provider: 'ollama',
    promptTokens: data.prompt_eval_count ?? 0,
    completionTokens: data.eval_count ?? 0,
  })
  return data.message as OllamaMessage
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const READ_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_business_pulse',
      description: 'Get a snapshot of current business metrics: lead pipeline, content calendar, brand voice status, recent errors.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leads',
      description: 'Get leads from the Scout pipeline filtered by status.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'new | approved | contacted | responded | converted | rejected', enum: ['new', 'approved', 'contacted', 'responded', 'converted', 'rejected'] },
          limit: { type: 'string', description: 'Max results, default 10' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_content_queue',
      description: 'Get upcoming and draft content posts from Nova.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'draft | Scheduled | Published', enum: ['draft', 'Scheduled', 'Published'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_activity',
      description: 'Get recent heartbeat log entries from all agents to understand what has already run.',
      parameters: {
        type: 'object',
        properties: {
          hours: { type: 'string', description: 'How many hours back to look, default 24' },
        },
      },
    },
  },
]

const ACTION_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'run_scout_search',
      description: 'Trigger Scout to search for new leads in a business category. Uses pre-configured search centers.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'e.g. "church", "restaurant", "dentist", "gym"' },
        },
        required: ['category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_lead',
      description: 'Approve a Scout lead for outreach so their email gets sent.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'UUID of the lead to approve' },
        },
        required: ['lead_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_content_post',
      description: 'Ask Nova to draft a new content post for a specific channel and topic.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'facebook | instagram | linkedin | x | blog', enum: ['facebook', 'instagram', 'linkedin', 'x', 'blog'] },
          topic: { type: 'string', description: 'What the post should be about' },
        },
        required: ['channel', 'topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_quill_analysis',
      description: 'Trigger Quill to re-analyze brand voice from all accumulated writing samples.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_report',
      description: 'Ask Remi to generate a business performance report.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'Period to report on e.g. "last 7 days"' },
        },
      },
    },
  },
]

const ALL_TOOLS = AUTONOMOUS ? [...READ_TOOLS, ...ACTION_TOOLS] : READ_TOOLS

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_business_pulse': {
      const [leads, content, samples] = await Promise.all([
        db`SELECT approval_status AS status, COUNT(*)::int AS count FROM scout_leads GROUP BY approval_status` as unknown as { status: string; count: number }[],
        db`SELECT status, COUNT(*)::int AS count FROM content_posts GROUP BY status` as unknown as { status: string; count: number }[],
        db`SELECT COUNT(*)::int AS count FROM brand_voice_samples` as unknown as [{ count: number }],
      ])
      const voice = await db`SELECT summary, sample_count, last_analyzed_at FROM brand_voice_profile LIMIT 1` as unknown as { summary: string; sample_count: number; last_analyzed_at: string }[]
      return {
        leads,
        content,
        brand_voice_samples: (samples as unknown as [{ count: number }])[0]?.count ?? 0,
        voice_summary: voice[0]?.summary ?? 'Not analyzed',
        voice_last_analyzed: voice[0]?.last_analyzed_at ?? null,
      }
    }

    case 'get_leads': {
      const status = args.status as string | undefined
      const limit = parseInt(String(args.limit ?? '10'))
      return status
        ? await db`SELECT id, name, category, address, grade, approval_status, scraped_at FROM scout_leads WHERE approval_status = ${status} ORDER BY scraped_at DESC LIMIT ${limit}` as unknown as unknown[]
        : await db`SELECT id, name, category, address, grade, approval_status, scraped_at FROM scout_leads ORDER BY scraped_at DESC LIMIT ${limit}` as unknown as unknown[]
    }

    case 'get_content_queue': {
      const status = args.status as string | undefined
      return status
        ? await db`SELECT id, title, channel, status, updated_at FROM content_posts WHERE status = ${status} ORDER BY updated_at DESC LIMIT 20` as unknown as unknown[]
        : await db`SELECT id, title, channel, status, updated_at FROM content_posts WHERE status IN ('Draft','Scheduled') ORDER BY updated_at DESC LIMIT 20` as unknown as unknown[]
    }

    case 'get_recent_activity': {
      const hours = parseInt(String(args.hours ?? '24'))
      return await db`
        SELECT content, tags, created_at FROM heartbeats
        WHERE created_at > now() - (${hours} || ' hours')::interval
        ORDER BY created_at DESC LIMIT 20` as unknown as unknown[]
    }

    case 'run_scout_search': {
      // /api/scout/search expects { category, center? } — city is not a param
      const res = await fetch(`${BASE_URL}/api/scout/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: args.category }),
      })
      return res.ok ? await res.json() : { error: `HTTP ${res.status}` }
    }

    case 'approve_lead': {
      const res = await fetch(`${BASE_URL}/api/scout/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: args.lead_id, action: 'approve' }),
      })
      return res.ok ? { ok: true } : { error: `HTTP ${res.status}` }
    }

    case 'generate_content_post': {
      // Create a content post record then draft it
      const [post] = await db`
        INSERT INTO content_posts (title, channel, notes, status)
        VALUES (${String(args.topic)}, ${String(args.channel)}, 'Generated by Theo', 'Draft')
        RETURNING id` as unknown as [{ id: string }]
      const res = await fetch(`${BASE_URL}/api/nova/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })
      return res.ok ? { ok: true, post_id: post.id } : { error: `HTTP ${res.status}` }
    }

    case 'run_quill_analysis': {
      const res = await fetch(`${BASE_URL}/api/quill/analyze`, { method: 'POST' })
      return res.ok ? await res.json() : { error: `HTTP ${res.status}` }
    }

    case 'generate_report': {
      // Remi uses /api/remi/heartbeat — no separate report endpoint
      const res = await fetch(`${BASE_URL}/api/remi/heartbeat`, { method: 'POST' })
      return res.ok ? { ok: true, message: 'Remi report generated' } : { error: `HTTP ${res.status}` }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ── Legacy standup support ───────────────────────────────────────────────────
// Used by app/api/theo/standup/route.ts

export interface StandupData {
  date: string; time: string
  totalClients: number; activeClients: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  staleClients: any[]
  newClientsThisWeek: number
  activeProjects: number
  overdueProjects: ProjectRisk[]
  atRiskProjects: ProjectRisk[]
  collectedMTD: number; outstandingTotal: number
  overdueInvoices: InvoiceAlert[]
  postsScheduled: number; postsPublishedThisWeek: number; ideasInBacklog: number
  newLeadsThisWeek: number; gradeALeads: number; pendingApprovals: number; contactedThisWeek: number
  recentResearchTopics: string[]; agentsOnline: number; totalAgents: number
  leadsContactedToday: number; outreachSentToday: number; postsPublishedToday: number
  followUpsSentToday: number; materialsCreatedToday: number; newLeadsToday: number
}

export async function generateDailyStandup(data: StandupData): Promise<string> {
  const prompt = `You are Theo, the AI business operator for TheoSYN Labs. Generate a concise daily standup briefing based on this data.

Date: ${data.date} at ${data.time}

BUSINESS SNAPSHOT:
- Clients: ${data.activeClients} active (${data.totalClients} total), ${data.newClientsThisWeek} new this week
- Stale clients: ${data.staleClients.map(c => `${c.name} (${c.daysInStage}d)`).join(', ') || 'none'}
- Projects: ${data.activeProjects} active, ${data.overdueProjects.length} overdue, ${data.atRiskProjects.length} at risk
- Revenue: $${data.collectedMTD.toFixed(2)} collected MTD, $${data.outstandingTotal.toFixed(2)} outstanding
- Overdue invoices: ${data.overdueInvoices.map(i => `${i.client_name ?? 'client'} ($${i.amount}, ${i.daysOverdue ?? '?'}d)`).join(', ') || 'none'}
- Content: ${data.postsScheduled} scheduled, ${data.postsPublishedThisWeek} published this week, ${data.ideasInBacklog} ideas in backlog
- Scout leads: ${data.newLeadsThisWeek} new this week, ${data.gradeALeads} Grade A total, ${data.pendingApprovals} pending approval, ${data.contactedThisWeek} contacted
- Research: ${data.recentResearchTopics.join(', ') || 'none this week'}
- Agents: ${data.agentsOnline}/${data.totalAgents} online

TODAY SO FAR:
- Leads contacted: ${data.leadsContactedToday}, Outreach sent: ${data.outreachSentToday}, Follow-ups: ${data.followUpsSentToday}
- Posts published: ${data.postsPublishedToday}, New leads found: ${data.newLeadsToday}, Materials created: ${data.materialsCreatedToday}

Write a 3-5 sentence briefing. Lead with the most important thing happening. Flag anything urgent. End with one priority for the day. Speak as Theo — confident, clear, grounded.`

  try {
    const msg = await ollamaChat([{ role: 'user', content: prompt }])
    return msg.content ?? 'Standup unavailable.'
  } catch {
    // Fallback to a structured text summary if AI is unavailable
    return `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}. It's ${data.date}. You have ${data.activeClients} active clients and ${data.activeProjects} projects in flight. Scout has ${data.gradeALeads} Grade A leads with ${data.pendingApprovals} pending your approval. ${data.overdueInvoices.length > 0 ? `⚠️ ${data.overdueInvoices.length} invoice(s) overdue.` : 'All invoices current.'} Priority: ${data.pendingApprovals > 0 ? 'review Scout approvals' : 'keep the pipeline moving'}.`
  }
}

// ── Business context summary ─────────────────────────────────────────────────

async function getBusinessContext(): Promise<string> {
  try {
    const [leadCounts, contentCounts, recentHeartbeats, voiceProfile] = await Promise.all([
      db`SELECT approval_status AS status, COUNT(*)::int AS count FROM scout_leads GROUP BY approval_status` as unknown as { status: string; count: number }[],
      db`SELECT status, COUNT(*)::int AS count FROM content_posts GROUP BY status` as unknown as { status: string; count: number }[],
      db`SELECT content, created_at FROM heartbeats ORDER BY created_at DESC LIMIT 8` as unknown as { content: string; created_at: string }[],
      db`SELECT summary, sample_count, last_analyzed_at FROM brand_voice_profile LIMIT 1` as unknown as { summary: string; sample_count: number; last_analyzed_at: string | null }[],
    ])

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const leadSummary = leadCounts.map(r => `${r.count} ${r.status}`).join(', ') || 'No leads yet'
    const contentSummary = contentCounts.map(r => `${r.count} ${r.status}`).join(', ') || 'No posts yet'
    const recentActivity = recentHeartbeats.slice(0, 5).map(h => `- ${h.content.slice(0, 100)}`).join('\n') || 'None'
    const voice = voiceProfile[0]

    return `Today: ${today}
Mode: ${AUTONOMOUS ? 'AUTONOMOUS' : 'OBSERVE ONLY'}
Lead pipeline: ${leadSummary}
Content calendar: ${contentSummary}
Brand voice: ${voice?.summary ?? 'Not analyzed'} (${voice?.sample_count ?? 0} samples)
Recent activity:\n${recentActivity}`
  } catch {
    return 'Business context unavailable.'
  }
}

// ── Main orchestration loop ───────────────────────────────────────────────────

export async function theoThink(trigger: 'cron' | 'manual' | 'event' = 'cron'): Promise<string> {
  const context = await getBusinessContext()

  const systemPrompt = `You are Theo, the autonomous AI business operator for TheoSYN Labs — helping small businesses and churches use AI from a Christian worldview.

You coordinate these agents:
- Scout: finds leads, sends outreach, follows up
- Nova: creates and schedules social content
- Quill: analyzes brand voice from writing samples
- Beacon: manages community/education
- Remi: generates performance reports

Look at the current business state and decide what needs attention. Think like a thoughtful operations manager who values relationships and integrity — not just throughput.

${AUTONOMOUS ? 'AUTONOMOUS MODE: you may call action tools to actually run agents and take business actions.' : 'OBSERVE MODE: use read tools only. Summarize what you see and recommend next steps.'}

Current state:
${context}`

  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Review the business and take appropriate action.' },
  ]

  const actions: { tool: string; params: unknown; result: unknown; ok: boolean }[] = []
  const MAX_ROUNDS = 8
  let rounds = 0
  let sessionId: string

  const [session] = await db`
    INSERT INTO theo_sessions (trigger, mode, model, status)
    VALUES (${trigger}, ${AUTONOMOUS ? 'autonomous' : 'observe'}, ${THEO_MODEL}, 'running')
    RETURNING id` as unknown as [{ id: string }]
  sessionId = session.id

  try {
    while (rounds < MAX_ROUNDS) {
      rounds++
      const response = await ollamaChat(messages, ALL_TOOLS)
      messages.push(response)

      if (response.tool_calls?.length) {
        for (const call of response.tool_calls) {
          let result: unknown
          let ok = true
          try {
            result = await executeTool(call.function.name, call.function.arguments ?? {})
          } catch (err) {
            result = { error: String(err) }
            ok = false
          }
          actions.push({ tool: call.function.name, params: call.function.arguments, result, ok })
          messages.push({ role: 'tool', content: JSON.stringify(result) })
        }
      } else {
        break
      }
    }

    const summary = (messages.findLast(m => m.role === 'assistant' && m.content)?.content) ?? 'No summary.'
    const thinking = messages.filter(m => m.role === 'assistant' && m.content).map(m => m.content).join('\n\n')

    await db`
      UPDATE theo_sessions SET
        thinking     = ${thinking},
        actions      = ${JSON.stringify(actions)},
        summary      = ${summary},
        rounds       = ${rounds},
        status       = 'completed',
        completed_at = now()
      WHERE id = ${sessionId}`

    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      SELECT id,
        ${`## Theo — ${AUTONOMOUS ? 'Autonomous' : 'Observe'} Review\n**Rounds:** ${rounds} | **Actions:** ${actions.length}\n\n${summary.slice(0, 600)}`},
        ARRAY['theo', 'orchestration']
      FROM agents WHERE name = 'Theo' LIMIT 1`
    await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Theo'`

    // Notify via Slack if this was a cron run or had actions
    if (trigger === 'cron' || actions.length > 0) {
      const slackMsg = `🧠 *Theo — ${AUTONOMOUS ? 'Autonomous' : 'Observe'} Review*\n${summary.slice(0, 600)}${summary.length > 600 ? '...' : ''}`
      await sendSlackMessage(slackMsg).catch(() => {})
    }

    return summary
  } catch (err) {
    const errMsg = String(err)
    await db`
      UPDATE theo_sessions SET status = 'failed', summary = ${errMsg}, rounds = ${rounds}, completed_at = now()
      WHERE id = ${sessionId}`
    throw err
  }
}
