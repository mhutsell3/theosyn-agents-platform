import { App, LogLevel } from '@slack/bolt'
import { db } from '@/lib/db'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const THEO_MODEL = process.env.THEO_MODEL ?? 'gemma4:e4b'
const SLACK_CHAT_MODEL = process.env.SLACK_CHAT_MODEL ?? 'llama3.1:8b'
const HISTORY_LIMIT = 20 // messages to keep in context

let slackApp: App | null = null
let botUserId: string | null = null

// ── Conversation history (DB-backed) ────────────────────────────────────────

async function getHistory(channelId: string): Promise<{ role: string; content: string }[]> {
  try {
    const rows = await db`
      SELECT role, content FROM slack_conversations
      WHERE channel_id = ${channelId}
      ORDER BY created_at DESC
      LIMIT ${HISTORY_LIMIT}
    ` as unknown as { role: string; content: string }[]
    return rows.reverse()
  } catch {
    return []
  }
}

async function saveMessage(channelId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  try {
    await db`INSERT INTO slack_conversations (channel_id, role, content) VALUES (${channelId}, ${role}, ${content})`
    // Prune old messages beyond 100 per channel
    await db`
      DELETE FROM slack_conversations
      WHERE channel_id = ${channelId}
        AND id NOT IN (
          SELECT id FROM slack_conversations
          WHERE channel_id = ${channelId}
          ORDER BY created_at DESC
          LIMIT 100
        )
    `
  } catch { /* non-fatal */ }
}

// ── Conversational Theo — lighter than full orchestration ────────────────────

async function theoChat(userMessage: string, channelId: string): Promise<string> {
  // Pull quick business context
  let context = ''
  try {
    const [leads, content, heartbeats] = await Promise.all([
      db`SELECT approval_status AS status, COUNT(*)::int AS count FROM scout_leads GROUP BY approval_status` as unknown as { status: string; count: number }[],
      db`SELECT status, COUNT(*)::int AS count FROM content_posts GROUP BY status` as unknown as { status: string; count: number }[],
      db`SELECT content FROM heartbeats ORDER BY created_at DESC LIMIT 5` as unknown as { content: string }[],
    ])
    context = `Lead pipeline: ${leads.map(r => `${r.count} ${r.status}`).join(', ') || 'empty'}
Content: ${content.map(r => `${r.count} ${r.status}`).join(', ') || 'none'}
Recent activity: ${heartbeats.map(h => h.content.slice(0, 80)).join(' | ') || 'none'}`
  } catch {
    context = 'Business context unavailable.'
  }

  const systemPrompt = `You are Theo, the AI business operator for TheoSYN Labs. You help Milford run his business — Scout leads, Nova content, Quill brand voice, Beacon community, Remi ads reporting.

Current business state:
${context}

Keep responses concise and direct. You're texting via Slack — no long essays. If Milford asks you to DO something (approve a lead, run a search, etc.), tell him you'll queue it and that he can trigger it from the Command Center at command.theosynlabs.com. If he asks a question, answer it clearly. Speak like a sharp, trusted colleague. Remember everything discussed in this conversation.`

  // Load conversation history and append the new user message
  const history = await getHistory(channelId)
  await saveMessage(channelId, 'user', userMessage)

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: SLACK_CHAT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userMessage },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error(`Ollama ${res.status}`)
    const data = await res.json()
    const reply = data.message?.content ?? 'No response.'
    await saveMessage(channelId, 'assistant', reply)
    return reply
  } catch (err) {
    return `I'm having trouble reaching my AI brain right now (${String(err)}). Check the Command Center at command.theosynlabs.com.`
  }
}

// ── Proactive messaging ──────────────────────────────────────────────────────

export async function sendSlackMessage(text: string, channel?: string): Promise<void> {
  if (!slackApp) return
  const target = channel ?? process.env.SLACK_DM_CHANNEL_ID
  if (!target) {
    console.warn('[Slack] No channel/DM target set — set SLACK_DM_CHANNEL_ID in .env.local')
    return
  }
  try {
    await slackApp.client.chat.postMessage({ channel: target, text })
  } catch (err) {
    console.error('[Slack] sendSlackMessage error:', err)
  }
}

// ── Start Socket Mode bot ────────────────────────────────────────────────────

export function startSlack(): void {
  const appToken = process.env.SLACK_APP_TOKEN
  const botToken = process.env.SLACK_BOT_TOKEN

  if (!appToken || !botToken) {
    console.log('[Slack] SLACK_APP_TOKEN or SLACK_BOT_TOKEN not set — Slack bot disabled')
    return
  }

  slackApp = new App({
    token: botToken,
    appToken,
    socketMode: true,
    logLevel: LogLevel.ERROR,
  })

  // Handle DMs and mentions
  slackApp.message(async ({ message, say }) => {
    const msg = message as { text?: string; bot_id?: string; user?: string; channel?: string; channel_type?: string }

    // Ignore bot messages
    if (msg.bot_id || !msg.text) return

    // Only respond to DMs or @mentions
    const isDM = msg.channel_type === 'im'
    const isMention = botUserId && msg.text.includes(`<@${botUserId}>`)
    if (!isDM && !isMention) return

    const userText = msg.text.replace(/<@[A-Z0-9]+>/g, '').trim()
    if (!userText) return

    const channelId = msg.channel ?? 'unknown'
    console.log(`[Slack] Message from ${msg.user}: ${userText.slice(0, 80)}`)

    // Typing indicator
    await say('_Thinking..._')

    const reply = await theoChat(userText, channelId)
    await say(reply)
  })

  // Handle app_mention separately for channel mentions
  slackApp.event('app_mention', async ({ event, say }) => {
    const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim()
    if (!text) { await say("Hey! What do you need?"); return }
    const reply = await theoChat(text, event.channel)
    await say(reply)
  })

  slackApp.start().then(async () => {
    console.log('[Slack] Theo is connected via Socket Mode ⚡')
    // Cache bot user ID for mention detection
    try {
      const auth = await slackApp!.client.auth.test()
      botUserId = auth.user_id as string
      console.log(`[Slack] Bot user ID: ${botUserId}`)
    } catch { /* non-fatal */ }
  }).catch(err => {
    console.error('[Slack] Failed to start:', err)
  })
}
