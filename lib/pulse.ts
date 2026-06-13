import { logTokenUsage } from '@/lib/usage'

async function ollamaChat(prompt: string, model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'): Promise<string> {
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Pulse', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

const PULSE_CONTEXT = `
You are Pulse, the Social Media agent for TheoSYN Labs.
TheoSYN Labs helps small businesses and churches use AI ethically, from a Christian perspective.
Your job: keep the organic social presence active, consistent, and growing across all connected pages.
Tone: data-driven but warm. Report facts clearly, celebrate wins, flag problems directly.
`

const TONE_GUIDE: Record<string, string> = {
  'Faith-informed': 'warm, genuine, faith-informed but not preachy. Reference community and values when natural.',
  'Professional':   'professional, concise, and helpful. Keep it polished and on-brand.',
  'Casual':         'casual, friendly, and conversational. Like a real person talking.',
  'Friendly':       'upbeat, positive, and encouraging. Make them feel appreciated.',
}

// ── Comment classification ─────────────────────────────────────────────────

const SIMPLE_PATTERNS = [
  /^(👍|❤️|🙏|🔥|💯|😊|😍|🙌|👏|✨|💪|🎉|😂|💙)+$/u,
  /^(great|awesome|love\s*(it|this)?|amazing|nice|wow|yes|amen|blessed|thank\s*you|thanks|congrats?|perfect|beautiful|excellent|wonderful|fantastic)[\s!.]*$/i,
]

export function classifyComment(message: string): { isSimple: boolean; isQuestion: boolean; isNegative: boolean } {
  const trimmed = message.trim()
  const isSimple = SIMPLE_PATTERNS.some(p => p.test(trimmed)) || trimmed.length < 15
  const isQuestion = /\?/.test(trimmed) || /^(how|what|when|where|why|who|can|could|is|are|do|does|will|would|should)\s/i.test(trimmed)
  const isNegative = /\b(bad|terrible|awful|hate|worst|scam|fraud|fake|disappointed|disgusting|horrible|wrong|lie|liar|unfollow|spam|stop|ridiculous|pathetic)\b/i.test(trimmed)
  return { isSimple, isQuestion, isNegative }
}

// ── Reply drafting ─────────────────────────────────────────────────────────

export async function draftCommentReply(params: {
  postTitle: string
  pageName: string
  commentMessage: string
  fromName: string
  tone: string
  signOff: string
}): Promise<string> {
  const toneGuide = TONE_GUIDE[params.tone] ?? TONE_GUIDE['Friendly']

  const prompt = `${PULSE_CONTEXT}

Draft a short reply to a Facebook comment on behalf of ${params.pageName}.

Post context: "${params.postTitle}"
Comment from ${params.fromName}: "${params.commentMessage}"

Tone: ${toneGuide}
Sign off as: ${params.signOff}

Rules:
- 1-3 sentences max — keep it brief and human
- Use their first name if possible
- Don't be sycophantic or robotic
- If it's a question, give a helpful answer or invite them to DM for details
- If it's negative, be gracious and invite a private conversation
- No hashtags, no emojis unless they used them first

Write only the reply text, nothing else.`

  return ollamaChat(prompt)
}

export async function draftSimpleReply(params: {
  fromName: string
  tone: string
  signOff: string
}): Promise<string> {
  const firstName = params.fromName.split(' ')[0]
  const replies: Record<string, string[]> = {
    'Faith-informed': [`Thank you, ${firstName}! 🙏 Grateful for your support.`, `Appreciate you, ${firstName}! Blessings! 🙌`, `Thank you ${firstName} — means a lot! ✨`],
    'Professional':   [`Thank you, ${firstName}!`, `Appreciate the kind words, ${firstName}.`, `Thanks for the support, ${firstName}!`],
    'Casual':         [`Thanks ${firstName}! 😊`, `Appreciate it, ${firstName}!`, `Thanks so much ${firstName}! 🙌`],
    'Friendly':       [`Aw, thank you ${firstName}! 😊`, `You're so kind, ${firstName}! Thank you!`, `Thank you ${firstName}! So glad you enjoyed it! 🎉`],
  }
  const options = replies[params.tone] ?? replies['Friendly']
  return options[Math.floor(Math.random() * options.length)]
}

// ── Weekly heartbeat ───────────────────────────────────────────────────────

export async function generatePulseHeartbeat(data: {
  accounts: { name: string; platform: string; postsThisWeek: number; likes: number; comments: number; reach: number }[]
  totalPostsThisWeek: number
  totalReach: number
  failedPosts: number
  scheduledUpcoming: number
}): Promise<string> {
  const prompt = `${PULSE_CONTEXT}

Generate a weekly social media heartbeat report for TheoSYN Labs.

Data:
- Connected pages: ${data.accounts.length}
- Posts published this week: ${data.totalPostsThisWeek}
- Total organic reach: ${data.totalReach}
- Failed posts: ${data.failedPosts}
- Posts scheduled for next 7 days: ${data.scheduledUpcoming}

Page breakdown:
${data.accounts.map(a => `- ${a.name} (${a.platform}): ${a.postsThisWeek} posts, ${a.likes} likes, ${a.comments} comments, ${a.reach} reach`).join('\n')}

Write a concise weekly social media report (2-3 paragraphs) covering:
1. Overall social health and reach this week
2. What's working and what needs attention
3. Recommendation for next week (post more, adjust timing, etc.)

Format as markdown.`

  return ollamaChat(prompt)
}
