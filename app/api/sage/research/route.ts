import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateBrief, curateResources } from '@/lib/sage'

export async function POST(req: NextRequest) {
  const { topic } = await req.json()
  if (!topic?.trim()) return NextResponse.json({ error: 'Topic required' }, { status: 400 })

  const [clients, projects] = await Promise.all([
    db`SELECT name FROM clients WHERE stage = 'Active' LIMIT 10`,
    db`SELECT name FROM projects WHERE phase != 'Delivered' LIMIT 10`,
  ])

  const activeClients = (clients as unknown as { name: string }[]).map(c => c.name)
  const activeProjects = (projects as unknown as { name: string }[]).map(p => p.name)

  let brief: string
  let resources: Awaited<ReturnType<typeof import('@/lib/sage').curateResources>>

  try {
    ;[brief, resources] = await Promise.all([
      generateBrief(topic, { activeClients, activeProjects }),
      curateResources(topic),
    ])
  } catch (err) {
    console.error('[Sage] Research generation failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ollama generation failed' }, { status: 500 })
  }

  // Save brief
  await db`INSERT INTO sage_briefs (topic, content) VALUES (${topic}, ${brief})`

  // Save curated resources
  for (const r of resources) {
    await db`
      INSERT INTO sage_resources (title, url, category, summary)
      VALUES (${r.title}, ${r.url ?? null}, ${r.category}, ${r.summary})`
  }

  // Write to activity feed
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${`## Sage — Research Brief\n**Topic:** ${topic}\n\n${brief.slice(0, 500)}...`}, ARRAY['research', 'sage']
    FROM agents WHERE name = 'Sage' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Sage'`

  return NextResponse.json({ brief, resources })
}
