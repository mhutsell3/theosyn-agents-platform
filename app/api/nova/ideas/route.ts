import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateIdeas } from '@/lib/nova'

export async function POST() {
  // Get context: active projects and recent content topics
  const [projects, recentPosts] = await Promise.all([
    db`SELECT name FROM projects WHERE phase != 'Delivered' LIMIT 10`,
    db`SELECT title FROM content_posts ORDER BY created_at DESC LIMIT 20`,
  ])

  const activeProjects = (projects as unknown as { name: string }[]).map(p => p.name)
  const recentTopics = (recentPosts as unknown as { title: string }[]).map(p => p.title)

  const raw = await generateIdeas({ activeProjects, recentTopics })
  const ideas = raw.filter(i => i.title?.trim().length > 0)

  // Save ideas to backlog with their suggested channel
  for (const idea of ideas) {
    await db`INSERT INTO content_ideas (title, channel) VALUES (${idea.title.trim()}, ${idea.channel})`
  }

  // Log the run
  await db`
    INSERT INTO nova_runs (run_type, output, ideas_added)
    VALUES ('ideas', ${ideas.map(i => `[${i.channel}] ${i.title}`).join('\n')}, ${ideas.length})`

  // Write heartbeat
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${`## Nova — Idea Generation\nAdded ${ideas.length} new content ideas to the backlog.\n\n${ideas.map(i => `- [${i.channel}] ${i.title}`).join('\n')}`}, ARRAY['content', 'ideas']
    FROM agents WHERE name = 'Nova' LIMIT 1`

  return NextResponse.json({ ideas, count: ideas.length })
}
