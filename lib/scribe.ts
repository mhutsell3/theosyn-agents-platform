import { logTokenUsage } from '@/lib/usage'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

async function ollamaChat(prompt: string, model = OLLAMA_MODEL): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(120000), // 2 min timeout
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const data = await res.json()
  logTokenUsage({ agent: 'Scribe', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

// Gemini fallback when Ollama is unavailable
async function geminiChat(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite'
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(120000),
    }
  )
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// Try Ollama first, fall back to Gemini
async function aiChat(prompt: string): Promise<string> {
  try {
    return await ollamaChat(prompt)
  } catch (err) {
    console.warn('[Scribe] Ollama unavailable, falling back to Gemini:', err)
    return await geminiChat(prompt)
  }
}

const SCRIBE_CONTEXT = `
You are Scribe, the Curriculum & Training Agent for TheoSYN Labs.
TheoSYN Labs teaches small businesses and churches how to build and use AI agents ethically, from a Christian perspective.
Your job: research, write, and organize high-quality training materials for the TheoSYN community.
Tone: clear, practical, encouraging. Assume the student is non-technical but motivated.
Always include real steps, real tools, and real outcomes — no fluff.
`

// ── YouTube Research ───────────────────────────────────────────────────────

export async function searchYouTube(query: string, maxResults = 5): Promise<{
  videoId: string
  title: string
  description: string
  channelTitle: string
  publishedAt: string
}[]> {
  if (!YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY not set')

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(maxResults),
    key: YOUTUBE_API_KEY,
    relevanceLanguage: 'en',
  })

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  const data = await res.json()

  if (data.error) throw new Error(data.error.message)

  return (data.items ?? []).map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown>
    const id = item.id as Record<string, unknown>
    return {
      videoId: String(id.videoId ?? ''),
      title: String(snippet.title ?? ''),
      description: String(snippet.description ?? ''),
      channelTitle: String(snippet.channelTitle ?? ''),
      publishedAt: String(snippet.publishedAt ?? ''),
    }
  })
}

export async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  // YouTube Data API doesn't provide transcripts directly
  // Use the timedtext endpoint as a fallback
  try {
    const res = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    const html = await res.text()

    // Extract caption track URL
    const captionMatch = html.match(/"captionTracks":\[.*?"baseUrl":"([^"]+)"/)
    if (!captionMatch) return null

    const captionUrl = captionMatch[1].replace(/\\u0026/g, '&')
    const captionRes = await fetch(captionUrl)
    const captionXml = await captionRes.text()

    // Strip XML tags and decode entities
    const text = captionXml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()

    return text.slice(0, 8000) // cap at 8k chars for Ollama context
  } catch {
    return null
  }
}

export async function summarizeResearch(content: string, topic: string): Promise<string> {
  const prompt = `${SCRIBE_CONTEXT}

Summarize this research content for a training module about: "${topic}"

Extract:
- Key concepts and techniques
- Practical steps or methods mentioned
- Tools or technologies referenced
- Any warnings or prerequisites

Content:
${content.slice(0, 4000)}

Write a concise summary (3-5 paragraphs) focusing on what's actionable and useful for teaching.`

  return aiChat(prompt)
}

// ── Content Generation ─────────────────────────────────────────────────────

export async function generatePlaybook(params: {
  title: string
  topic: string
  researchSummary?: string
  prerequisites?: string[]
}): Promise<string> {
  const prompt = `${SCRIBE_CONTEXT}

Write a practical playbook titled: "${params.title}"
Topic: ${params.topic}
${params.prerequisites?.length ? `Prerequisites: ${params.prerequisites.join(', ')}` : ''}
${params.researchSummary ? `Research context:\n${params.researchSummary}` : ''}

Format the playbook as:
## Goal
[What the student will accomplish]

## Tools Needed
[List of tools/access required]

## Steps
[Numbered, clear action steps — each step should be 1-3 sentences]

## Expected Outcome
[What success looks like]

## Common Mistakes
[2-3 pitfalls to avoid]

Write for a non-technical but motivated audience. Be specific and practical.`

  return aiChat(prompt)
}

export async function generateProcedure(params: {
  title: string
  topic: string
  researchSummary?: string
  prerequisites?: string[]
}): Promise<string> {
  const prompt = `${SCRIBE_CONTEXT}

Write a detailed step-by-step procedure titled: "${params.title}"
Topic: ${params.topic}
${params.prerequisites?.length ? `Prerequisites: ${params.prerequisites.join(', ')}` : ''}
${params.researchSummary ? `Research context:\n${params.researchSummary}` : ''}

Format as:
## Prerequisites
[Exact requirements before starting — software, accounts, access, knowledge]

## Step-by-Step Instructions
[Numbered steps. Each step should have:
- The action to take
- What to expect/see
- Any important notes]

## Verification
[How to confirm it worked correctly]

## Troubleshooting
[3-5 common issues and how to fix them]

Be precise. Assume nothing. Write as if guiding someone through it for the first time.`

  return aiChat(prompt)
}

export async function generateCourseModule(params: {
  title: string
  topic: string
  researchSummary?: string
  prerequisites?: string[]
}): Promise<{ body: string; script: string; keyTakeaways: string[]; quizQuestions: { question: string; options: string[]; answer: string }[] }> {
  const bodyPrompt = `${SCRIBE_CONTEXT}

Write a complete course module titled: "${params.title}"
Topic: ${params.topic}
${params.prerequisites?.length ? `Prerequisites: ${params.prerequisites.join(', ')}` : ''}
${params.researchSummary ? `Research context:\n${params.researchSummary}` : ''}

Format as:
## Introduction
[Hook and what they'll learn]

## Core Concepts
[The essential knowledge — explain clearly with examples]

## Practical Application
[How to apply this in the real world — specific to TheoSYN community members]

## Summary
[Recap of main points]

Write for a non-technical audience. Use analogies where helpful.`

  const scriptPrompt = `${SCRIBE_CONTEXT}

Write a video presentation script for a course module titled: "${params.title}"
Topic: ${params.topic}

The script should:
- Open with a warm, engaging hook (15-20 seconds when spoken)
- Walk through the key concepts conversationally
- Include natural pauses and transitions
- End with a clear call to action
- Be 5-8 minutes when spoken (approximately 750-1200 words)
- Sound like Milford speaking naturally, not reading an essay
- Reference the TheoSYN community and faith-informed approach where natural

Write only the script, formatted with [PAUSE], [SHOW SCREEN], [DEMO] cues where appropriate.`

  const takeawaysPrompt = `${SCRIBE_CONTEXT}

List exactly 5 key takeaways from a course module about: "${params.topic} — ${params.title}"
Format as a JSON array of strings: ["takeaway1", "takeaway2", ...]
Write only the JSON array.`

  const quizPrompt = `${SCRIBE_CONTEXT}

Write 3 quiz questions for a course module about: "${params.topic} — ${params.title}"
Return as JSON array:
[{"question": "...", "options": ["A", "B", "C", "D"], "answer": "A"}, ...]
Write only the JSON array.`

  const [body, script, takeawaysRaw, quizRaw] = await Promise.all([
    aiChat(bodyPrompt),
    aiChat(scriptPrompt),
    aiChat(takeawaysPrompt),
    aiChat(quizPrompt),
  ])

  let keyTakeaways: string[] = []
  let quizQuestions: { question: string; options: string[]; answer: string }[] = []

  try { keyTakeaways = JSON.parse(takeawaysRaw.trim()) } catch { keyTakeaways = [] }
  try { quizQuestions = JSON.parse(quizRaw.trim()) } catch { quizQuestions = [] }

  return { body, script, keyTakeaways, quizQuestions }
}

// ── Default curriculum seed ────────────────────────────────────────────────

export const DEFAULT_CURRICULUM = [
  {
    track: 'Infrastructure Setup',
    topics: [
      { title: 'Setting Up Your Ubuntu Server', description: 'Installing and configuring an Ubuntu server for AI agent hosting', prerequisites: [] },
      { title: 'Installing Node.js, PostgreSQL and PM2', description: 'Core runtime dependencies for the Command Center', prerequisites: ['Setting Up Your Ubuntu Server'] },
      { title: 'Nginx Reverse Proxy Configuration', description: 'Routing traffic to your Next.js app', prerequisites: ['Installing Node.js, PostgreSQL and PM2'] },
      { title: 'Installing and Running Ollama', description: 'Setting up local LLM inference with Ollama', prerequisites: ['Installing Node.js, PostgreSQL and PM2'] },
    ],
  },
  {
    track: 'Building the Command Center',
    topics: [
      { title: 'Next.js App Router Fundamentals', description: 'Understanding the app structure and routing', prerequisites: ['Installing Node.js, PostgreSQL and PM2'] },
      { title: 'Connecting PostgreSQL with the postgres.js Library', description: 'Database setup and query patterns', prerequisites: ['Next.js App Router Fundamentals'] },
      { title: 'Authentication with NextAuth v5', description: 'Google OAuth and session management', prerequisites: ['Next.js App Router Fundamentals'] },
      { title: 'Building Your First Agent API Route', description: 'Creating agent endpoints that call Ollama', prerequisites: ['Connecting PostgreSQL with the postgres.js Library'] },
    ],
  },
  {
    track: 'Agent Development',
    topics: [
      { title: 'The Agent Pattern — lib, API routes, and UI', description: 'How every TheoSYN agent is structured', prerequisites: ['Building Your First Agent API Route'] },
      { title: 'Building a Client Relations Agent (Piper)', description: 'Pipeline monitoring, follow-up generation, and heartbeats', prerequisites: ['The Agent Pattern — lib, API routes, and UI'] },
      { title: 'Building a Lead Generation Agent (Scout)', description: 'Google Places, email discovery, and outreach automation', prerequisites: ['The Agent Pattern — lib, API routes, and UI'] },
      { title: 'Building a Social Media Agent (Pulse)', description: 'Facebook posting, comment monitoring, and engagement tracking', prerequisites: ['The Agent Pattern — lib, API routes, and UI'] },
    ],
  },
  {
    track: 'External Integrations',
    topics: [
      { title: 'Integrating with GoHighLevel', description: 'Contacts, community access, and email via GHL API', prerequisites: ['Building Your First Agent API Route'] },
      { title: 'Integrating with n8n', description: 'Workflow automation and webhook triggers', prerequisites: ['Building Your First Agent API Route'] },
      { title: 'Integrating with Meta Ads API', description: 'Campaign data, recommendations, and ad management', prerequisites: ['Building Your First Agent API Route'] },
      { title: 'Scheduling with node-cron', description: 'Autonomous agent heartbeats and scheduled tasks', prerequisites: ['Building Your First Agent API Route'] },
    ],
  },
  {
    track: 'Deployment & Operations',
    topics: [
      { title: 'Deploying with PM2', description: 'Process management, auto-restart, and log monitoring', prerequisites: ['Installing Node.js, PostgreSQL and PM2'] },
      { title: 'GitHub Workflow for Solo Developers', description: 'Git commit, push, and deploy patterns', prerequisites: ['Setting Up Your Ubuntu Server'] },
      { title: 'Managing Environment Variables Securely', description: '.env.local, secrets management, and Settings UI', prerequisites: ['Next.js App Router Fundamentals'] },
      { title: 'Monitoring and Troubleshooting', description: 'PM2 logs, error handling, and debugging strategies', prerequisites: ['Deploying with PM2'] },
    ],
  },
]
