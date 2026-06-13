import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generatePlaybook, generateProcedure, generateCourseModule } from '@/lib/scribe'

export const maxDuration = 300 // 5 minutes — Ollama generation can take 1-2 min

export async function POST(req: NextRequest) {
  const { topicId, materialType, title } = await req.json()

  if (!topicId || !materialType || !title) {
    return NextResponse.json({ error: 'topicId, materialType, and title required' }, { status: 400 })
  }

  const [topic] = await db`SELECT * FROM scribe_topics WHERE id = ${topicId}`
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const t = topic as unknown as { title: string; track: string; prerequisites: string[] }

  // Gather research summaries for this topic
  const research = await db`
    SELECT summary FROM scribe_research
    WHERE topic_id = ${topicId} AND summary IS NOT NULL
    ORDER BY created_at DESC LIMIT 5`

  const researchSummary = (research as unknown as { summary: string }[])
    .map(r => r.summary).join('\n\n---\n\n')

  // Pull relevant Sage briefs by keyword match on topic title
  const sageBriefs = await db`
    SELECT topic, content FROM sage_briefs
    WHERE topic ILIKE ${'%' + t.title.split(' ').slice(0, 3).join('%') + '%'}
       OR content ILIKE ${'%' + t.title.split(' ')[0] + '%'}
    ORDER BY created_at DESC LIMIT 3`

  const sageContext = (sageBriefs as unknown as { topic: string; content: string }[])
    .map(b => `### Sage Research: ${b.topic}\n${b.content.slice(0, 1000)}`)
    .join('\n\n---\n\n')

  const combinedResearch = [researchSummary, sageContext].filter(Boolean).join('\n\n---\n\n')

  const params = {
    title,
    topic: `${t.track} — ${t.title}`,
    researchSummary: combinedResearch || undefined,
    prerequisites: t.prerequisites,
  }

  let body = ''
  let script: string | null = null
  let keyTakeaways: string[] = []
  let quizQuestions: object[] = []

  console.log(`[Scribe] Generating ${materialType}: "${title}" for topic: ${t.title}`)

  try {
    if (materialType === 'playbook') {
      body = await generatePlaybook(params)
    } else if (materialType === 'procedure') {
      body = await generateProcedure(params)
    } else if (materialType === 'module') {
      const result = await generateCourseModule(params)
      body = result.body
      script = result.script
      keyTakeaways = result.keyTakeaways
      quizQuestions = result.quizQuestions
    } else {
      return NextResponse.json({ error: 'Invalid materialType' }, { status: 400 })
    }
  } catch (err) {
    console.error(`[Scribe] Generation failed:`, err)
    return NextResponse.json({ error: `AI generation failed: ${String(err)}` }, { status: 500 })
  }

  if (!body) {
    console.error(`[Scribe] Empty body returned for "${title}"`)
    return NextResponse.json({ error: 'AI returned empty content — Ollama and Gemini may both be unavailable' }, { status: 500 })
  }

  console.log(`[Scribe] Generated ${body.length} chars for "${title}"`)


  const [material] = await db`
    INSERT INTO scribe_materials (topic_id, material_type, title, body, script, prerequisites, key_takeaways, quiz_questions)
    VALUES (
      ${topicId},
      ${materialType},
      ${title},
      ${body},
      ${script},
      ${t.prerequisites},
      ${keyTakeaways},
      ${JSON.stringify(quizQuestions)}
    )
    RETURNING *`

  // Mark topic as in_progress
  await db`UPDATE scribe_topics SET status = 'in_progress', updated_at = now() WHERE id = ${topicId}`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scribe'`

  return NextResponse.json({ material })
}
