import { logTokenUsage } from '@/lib/usage'

async function ollamaChat(prompt: string, model = process.env.OLLAMA_MODEL_RESEARCH ?? process.env.OLLAMA_MODEL ?? 'llama3.1:8b'): Promise<string> {
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(180000), // 3 minute timeout
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  if (!data.response) throw new Error('Ollama returned empty response')
  logTokenUsage({ agent: 'Sage', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response
}

const SAGE_CONTEXT = `
You are Sage, the Research & Strategy agent for TheoSYN Labs.

TheoSYN Labs helps small businesses and churches use AI in an ethical, Christian way.
Your job: surface AI trends, research topics, competitive intel, and curate resources
relevant to churches and small businesses. Be concise, practical, and faith-informed.
Format all output as clean markdown.
`

export async function generateBrief(topic: string, context: {
  activeClients: string[]
  activeProjects: string[]
}): Promise<string> {
  const prompt = `${SAGE_CONTEXT}

Research this topic thoroughly and write a structured brief:
Topic: ${topic}

Active clients for relevance: ${context.activeClients.join(', ') || 'none'}
Active projects for relevance: ${context.activeProjects.join(', ') || 'none'}

Write a research brief with these sections:
## Overview
(2-3 sentence summary of the topic)

## Key Findings
(4-6 bullet points of the most important things to know)

## Relevance to Churches & SMBs
(How this applies specifically to TheoSYN's audience)

## Opportunities
(2-3 specific opportunities or action items for TheoSYN or its clients)

## Watch List
(1-2 things to monitor or follow up on)

Be specific, practical, and concise. Cite real tools, trends, or examples where possible.`

  return ollamaChat(prompt)
}

export async function generateHeartbeat(data: {
  activeClients: string[]
  activeProjects: string[]
  recentBriefTopics: string[]
}): Promise<string> {
  const prompt = `${SAGE_CONTEXT}

Generate a weekly Research & Strategy heartbeat for TheoSYN Labs.

Current context:
- Active clients: ${data.activeClients.join(', ') || 'none'}
- Active projects: ${data.activeProjects.join(', ') || 'none'}
- Recent research topics: ${data.recentBriefTopics.join(', ') || 'none yet'}

Write a weekly intelligence digest covering:
1. Top 3 AI trends relevant to churches and small businesses this week
2. One competitive intel note (what others in the church tech / SMB AI space are doing)
3. One strategic recommendation for TheoSYN Labs
4. One resource or tool worth exploring

Format as markdown. Keep it tight — this is a briefing, not an essay.`

  return ollamaChat(prompt)
}

export async function curateResources(topic: string): Promise<Array<{ title: string; category: string; summary: string; url: string }>> {
  const prompt = `${SAGE_CONTEXT}

Curate 4-5 resources (tools, articles, frameworks, or communities) relevant to this topic for churches and small businesses:
Topic: ${topic}

Return ONLY a JSON array. Each item must have: title, category, summary, url.
Categories: "AI Tool" | "Article" | "Framework" | "Community" | "Case Study"
For url, use real known URLs where possible, or use "#" if uncertain.
Example:
[
  {"title": "ChatGPT for Churches", "category": "AI Tool", "summary": "Use ChatGPT to draft sermons, bulletins, and emails.", "url": "https://chat.openai.com"},
  {"title": "AI Ethics Framework", "category": "Framework", "summary": "Practical framework for ethical AI adoption in ministry.", "url": "#"}
]`

  const text = await ollamaChat(prompt)
  const match = text.match(/\[[\s\S]*\]/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  return []
}
