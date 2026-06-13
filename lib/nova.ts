import { GoogleGenerativeAI } from '@google/generative-ai'
import { logTokenUsage } from '@/lib/usage'
import { getVoiceProfile } from '@/lib/quill'

// Ollama — local, fast, free (ideas + heartbeat)
async function ollamaChat(prompt: string, model = process.env.OLLAMA_MODEL ?? 'llama3.2:1b'): Promise<string> {
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Nova', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

// Gemini — cloud, powerful (drafts + repurposing)
async function geminiChat(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-001'
  const model = genAI.getGenerativeModel({ model: modelName })
  const result = await model.generateContent(prompt)
  const usage = result.response.usageMetadata
  if (usage) {
    logTokenUsage({ agent: 'Nova', model: modelName, provider: 'gemini', promptTokens: usage.promptTokenCount ?? 0, completionTokens: usage.candidatesTokenCount ?? 0 })
  }
  return result.response.text()
}

const BRAND_VOICE = `
You are Nova, the Content & Marketing agent for TheoSYN Labs.

TheoSYN Labs helps small businesses and churches use AI in an ethical, Christian way.
Brand voice: Warm, practical, faith-informed, never preachy. Approachable expert.
Audience: Pastors, church administrators, small business owners, ministry leaders.
Core message: AI is a tool — used ethically and wisely, it can multiply your impact for God's kingdom and your community.
`

const CHANNEL_SPECS: Record<string, string> = {
  YouTube:   'Script hook + outline. Start with a compelling question. 8-12 minutes worth of content.',
  TikTok:    '60-90 second script. Hook in first 3 seconds. Conversational, energetic. End with CTA.',
  X:         '280 characters max. Punchy, thought-provoking. Include 1-2 relevant hashtags.',
  LinkedIn:  '150-300 words. Professional but personal. Story-driven. End with a question to drive comments.',
  Facebook:  '100-200 words. Community-focused. Conversational. Ask for shares or tags.',
  Instagram: 'Caption: 150 words + 5-10 hashtags. Describe the visual needed. Warm and inspiring.',
  Email:     'Subject line + preview text + 300-500 word body. Personal, value-first. One clear CTA.',
}

// Ideas — fast, uses Ollama locally
export async function generateIdeas(context: {
  activeProjects: string[]
  recentTopics: string[]
}): Promise<{ title: string; channel: string }[]> {
  const prompt = `${BRAND_VOICE}

Generate 5 content ideas for TheoSYN Labs this week. For each idea, also suggest the best channel.

Active client projects for inspiration: ${context.activeProjects.join(', ') || 'none'}
Recent topics to avoid repeating: ${context.recentTopics.join(', ') || 'none'}

Sources to draw from:
- Current AI trends relevant to churches and small businesses
- Ethical AI use from a Christian worldview
- Practical how-to content (tools, workflows, automations)
- Scripture-informed perspective on technology and stewardship
- Common questions from church and SMB clients

Channels to choose from: YouTube, TikTok, Instagram, Facebook, LinkedIn, X, Email

Return ONLY a JSON array of 5 objects with "title" and "channel" keys. No explanation. Example:
[
  {"title": "How churches can use AI for sermon prep", "channel": "YouTube"},
  {"title": "3 AI tools every small business should use", "channel": "LinkedIn"},
  {"title": "Quick AI tip for your bulletin", "channel": "Facebook"},
  {"title": "AI ethics from a Christian perspective", "channel": "Email"},
  {"title": "60-second AI workflow hack", "channel": "TikTok"}
]`

  const text = await ollamaChat(prompt)

  // Try JSON array of objects first
  const arrayMatch = text.match(/\[[\s\S]*?\]/)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed) && parsed[0]?.title) return parsed
      // Handle plain string array fallback
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
        return parsed.map((t: string) => ({ title: t, channel: 'YouTube' }))
      }
    } catch {}
  }

  // Fallback: extract lines and default channel to YouTube
  const lines = text.split('\n')
    .map(l => l.replace(/^[\d\-\*\.\s"]+/, '').replace(/["',]+$/, '').trim())
    .filter(l => l.length > 10 && l.length < 200)
  return lines.slice(0, 5).map(title => ({ title, channel: 'YouTube' }))
}

// Draft writing — uses Gemini for quality long-form content
export async function writeDraft(post: {
  title: string
  channel: string
  notes?: string | null
}): Promise<string> {
  const spec = CHANNEL_SPECS[post.channel] ?? 'Write appropriate content for this platform.'
  const voiceProfile = await getVoiceProfile().catch(() => '')
  const prompt = `${BRAND_VOICE}
${voiceProfile ? `\n${voiceProfile}\n` : ''}
Write content for this post:
Title/Topic: ${post.title}
Channel: ${post.channel}
Format guidance: ${spec}
${post.notes ? `Additional notes: ${post.notes}` : ''}

Write the full draft content. Do not include meta-commentary, just the content itself.`

  return geminiChat(prompt)
}

// Repurposing — uses Gemini for quality across all channels
export async function repurposeForChannels(post: {
  title: string
  originalContent: string
  channels: string[]
}): Promise<Record<string, string>> {
  const results: Record<string, string> = {}

  await Promise.all(post.channels.map(async (channel) => {
    const spec = CHANNEL_SPECS[channel] ?? 'Adapt appropriately.'
    const prompt = `${BRAND_VOICE}

Repurpose this content for ${channel}:
Original title: ${post.title}
Original content: ${post.originalContent}
Format guidance: ${spec}

Write only the adapted content, nothing else.`

    results[channel] = await geminiChat(prompt)
  }))

  return results
}

// Community content — repurposes Scribe/Sage material into social posts that drive community signups
export async function generateCommunityContent(params: {
  title: string
  summary: string
  sourceType: 'scribe' | 'sage'
  channels: string[]
}): Promise<{ channel: string; title: string; draft: string }[]> {
  const communityCtx = `
The goal of these posts is to provide genuine value from this content while driving interest in the TheoSYN AI Community — a paid membership community where faith-led leaders learn to build and use AI agents.
Community URL context: theosynlabs.com — mention "the TheoSYN community" or "our community" as the CTA, never a hard sell.
Each post should stand alone as valuable content, with the community as a natural next step.
`

  const results = await Promise.all(params.channels.map(async (channel) => {
    const spec = CHANNEL_SPECS[channel] ?? 'Write appropriate content for this platform.'
    const prompt = `${BRAND_VOICE}
${communityCtx}

Create a social media post for ${channel} based on this ${params.sourceType === 'scribe' ? 'course material' : 'research'}.

Topic: ${params.title}
Content summary: ${params.summary.slice(0, 1000)}

Format guidance: ${spec}

The post should:
- Lead with the most useful insight or tip from this content
- Feel educational and generous, not promotional
- End with a soft CTA pointing to the TheoSYN community for those who want to go deeper
- Match the tone and format of ${channel} specifically

Write only the post content, nothing else.`

    const draft = await geminiChat(prompt)
    const postTitle = `${params.title} [${channel}]`
    return { channel, title: postTitle, draft }
  }))

  return results
}

// Heartbeat — fast summary, uses Ollama
export async function generateHeartbeat(data: {
  postsThisMonth: number
  topChannels: string[]
  recentIdeas: string[]
  activeProjects: string[]
}): Promise<string> {
  const prompt = `${BRAND_VOICE}

Generate a weekly content performance heartbeat report for TheoSYN Labs.

Data:
- Posts published this month: ${data.postsThisMonth}
- Most active channels: ${data.topChannels.join(', ') || 'none yet'}
- Recent content ideas in backlog: ${data.recentIdeas.slice(0, 5).join(', ') || 'none'}
- Active client projects (for content inspiration): ${data.activeProjects.join(', ') || 'none'}

Write a brief heartbeat (3-4 paragraphs) covering:
1. Content output summary
2. What to double down on
3. 2-3 specific recommendations for next week
4. One content opportunity tied to active client work

Format as markdown.`

  return ollamaChat(prompt)
}
