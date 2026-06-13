import { db } from '@/lib/db'
import { logTokenUsage } from '@/lib/usage'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'

async function ollamaChat(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(180000),
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const data = await res.json()
  logTokenUsage({ agent: 'Quill', model: OLLAMA_MODEL, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

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
      signal: AbortSignal.timeout(180000),
    }
  )
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function aiChat(prompt: string): Promise<string> {
  try { return await ollamaChat(prompt) }
  catch { return await geminiChat(prompt) }
}

// ── Pull from internal DB sources ───────────────────────────────────────────
// Note: Gmail/Outlook email samples are pushed here by n8n → POST /api/quill/samples
// This function handles only internal app data (Scout, Nova, Beacon)

export async function pullInternalSamples(): Promise<number> {
  let added = 0

  // Scout outreach emails
  const scoutLeads = await db`
    SELECT id::text, outreach_email, follow_up_email, follow_up_2_email
    FROM scout_leads
    WHERE outreach_email IS NOT NULL
      AND approval_status IN ('approved', 'contacted', 'responded', 'converted')` as unknown as {
    id: string; outreach_email: string | null
    follow_up_email: string | null; follow_up_2_email: string | null
  }[]

  for (const lead of scoutLeads) {
    if (lead.outreach_email) {
      const existing = await db`SELECT id FROM brand_voice_samples WHERE source = 'scout' AND source_id = ${'outreach_' + lead.id}` as unknown as unknown[]
      if (!existing.length) {
        await db`INSERT INTO brand_voice_samples (source, source_id, content, subject)
          VALUES ('scout', ${'outreach_' + lead.id}, ${lead.outreach_email}, 'Scout Initial Outreach')
          ON CONFLICT DO NOTHING`
        added++
      }
    }
    if (lead.follow_up_email) {
      const existing = await db`SELECT id FROM brand_voice_samples WHERE source = 'scout' AND source_id = ${'followup_' + lead.id}` as unknown as unknown[]
      if (!existing.length) {
        await db`INSERT INTO brand_voice_samples (source, source_id, content, subject)
          VALUES ('scout', ${'followup_' + lead.id}, ${lead.follow_up_email}, 'Scout Day 3 Follow-up')
          ON CONFLICT DO NOTHING`
        added++
      }
    }
  }

  // Nova published content
  const posts = await db`
    SELECT id::text, title, draft_content FROM content_posts
    WHERE draft_content IS NOT NULL AND status = 'Published'` as unknown as {
    id: string; title: string; draft_content: string
  }[]

  for (const post of posts) {
    const existing = await db`SELECT id FROM brand_voice_samples WHERE source = 'nova' AND source_id = ${post.id}` as unknown as unknown[]
    if (!existing.length) {
      await db`INSERT INTO brand_voice_samples (source, source_id, content, subject)
        VALUES ('nova', ${post.id}, ${post.draft_content}, ${post.title})
        ON CONFLICT DO NOTHING`
      added++
    }
  }

  // Beacon welcome emails (from nova_runs or heartbeats)
  const welcomeRuns = await db`
    SELECT id::text, output FROM nova_runs
    WHERE run_type = 'welcome' AND output IS NOT NULL` as unknown as {
    id: string; output: string
  }[]

  for (const run of welcomeRuns) {
    const existing = await db`SELECT id FROM brand_voice_samples WHERE source = 'beacon' AND source_id = ${run.id}` as unknown as unknown[]
    if (!existing.length) {
      await db`INSERT INTO brand_voice_samples (source, source_id, content, subject)
        VALUES ('beacon', ${run.id}, ${run.output}, 'Beacon Welcome Email')
        ON CONFLICT DO NOTHING`
      added++
    }
  }

  console.log(`[Quill] Imported ${added} internal samples`)
  return added
}

// ── Core analysis ───────────────────────────────────────────────────────────

export async function analyzeVoice(): Promise<void> {
  // Limit to 25 samples, 300 chars each to stay within Ollama's context window (~8K tokens)
  const samples = await db`
    SELECT content, subject, source FROM brand_voice_samples
    ORDER BY created_at DESC LIMIT 25` as unknown as {
    content: string; subject: string; source: string
  }[]

  if (samples.length === 0) {
    console.warn('[Quill] No samples to analyze')
    return
  }

  const sampleText = samples
    .map((s, i) => `[${s.source}] ${s.subject ? `"${s.subject}"` : 'untitled'}: ${s.content.slice(0, 300)}`)
    .join('\n\n')

  const prompt = `Analyze these writing samples from Milford Hutsell, founder of TheoSYN Labs (AI for small businesses and churches, Christian worldview).

SAMPLES:
${sampleText}

Return ONLY a JSON object — no markdown, no explanation:
{"tone":{"formal_casual":0,"warmth":0,"faith_level":0,"confidence":0},"vocabulary":{"signature_phrases":[],"preferred_words":[],"avoid_words":[]},"structure":{"avg_sentence_length":"medium","uses_questions":true,"paragraph_style":"short blocks","uses_bullet_points":false},"opening_style":"","closing_style":"","cta_style":"","themes":[],"do_list":[],"dont_list":[],"example_sentences":[],"summary":""}

Fill every field. tone/vocabulary/structure values are numbers 1-10 or arrays of strings. Return nothing except the JSON.`

  // Use Gemini first for analysis — much better JSON output and larger context than Ollama
  let raw: string
  try {
    raw = await geminiChat(prompt)
  } catch {
    try {
      raw = await ollamaChat(prompt)
    } catch (err) {
      console.error('[Quill] Both AI backends failed for analysis:', err)
      return
    }
  }

  let parsed: Record<string, unknown>
  try {
    // Strip any markdown fences
    const cleaned = raw.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error('[Quill] Failed to parse AI response:', err, raw.slice(0, 500))
    return
  }

  await db`
    UPDATE brand_voice_profile SET
      tone               = ${parsed.tone ? JSON.stringify(parsed.tone) : null},
      vocabulary         = ${parsed.vocabulary ? JSON.stringify(parsed.vocabulary) : null},
      structure          = ${parsed.structure ? JSON.stringify(parsed.structure) : null},
      opening_style      = ${(parsed.opening_style as string) ?? null},
      closing_style      = ${(parsed.closing_style as string) ?? null},
      cta_style          = ${(parsed.cta_style as string) ?? null},
      themes             = ${(parsed.themes as string[]) ?? null},
      do_list            = ${(parsed.do_list as string[]) ?? null},
      dont_list          = ${(parsed.dont_list as string[]) ?? null},
      example_sentences  = ${(parsed.example_sentences as string[]) ?? null},
      summary            = ${(parsed.summary as string) ?? null},
      sample_count       = ${samples.length},
      last_analyzed_at   = now(),
      updated_at         = now()`

  console.log(`[Quill] Voice profile updated from ${samples.length} samples`)

  // Log heartbeat
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${`## Quill — Brand Voice Analysis 🖊️\n**Samples analyzed:** ${samples.length}\n**Summary:** ${(parsed.summary as string) ?? 'N/A'}`},
      ARRAY['quill', 'brand-voice', 'analysis']
    FROM agents WHERE name = 'Quill' LIMIT 1`
  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Quill'`
}

// ── Public: get the current profile for injection into other agents ──────────

export async function getVoiceProfile(): Promise<string> {
  const [profile] = await db`SELECT * FROM brand_voice_profile LIMIT 1` as unknown as {
    summary: string | null
    tone: { formal_casual: number; warmth: number; faith_level: number } | null
    vocabulary: { signature_phrases: string[]; preferred_words: string[]; avoid_words: string[] } | null
    do_list: string[] | null
    dont_list: string[] | null
    example_sentences: string[] | null
    opening_style: string | null
    closing_style: string | null
    cta_style: string | null
    themes: string[] | null
    last_analyzed_at: string | null
  }[]

  if (!profile?.summary || profile.summary === 'Not yet analyzed.') {
    return ''
  }

  return `
BRAND VOICE PROFILE (write in this voice):
Summary: ${profile.summary}
Tone: Formal/Casual scale ${profile.tone?.formal_casual}/10, Warmth ${profile.tone?.warmth}/10, Faith integration ${profile.tone?.faith_level}/10
Opening style: ${profile.opening_style}
Closing style: ${profile.closing_style}
CTA style: ${profile.cta_style}
Signature phrases to use naturally: ${profile.vocabulary?.signature_phrases?.join(', ')}
Words to avoid: ${profile.vocabulary?.avoid_words?.join(', ')}
Themes: ${profile.themes?.join(', ')}
DO: ${profile.do_list?.join(' | ')}
DON'T: ${profile.dont_list?.join(' | ')}
Example sentences in his voice:
${profile.example_sentences?.map(s => `- "${s}"`).join('\n')}
`.trim()
}
