import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateCommunityContent } from '@/lib/nova'

// Channels to generate for by default
const DEFAULT_CHANNELS = ['Facebook', 'LinkedIn', 'X', 'Instagram']

export async function POST(req: NextRequest) {
  const { title, summary, sourceType, channels } = await req.json()

  if (!title || !summary) {
    return NextResponse.json({ error: 'title and summary required' }, { status: 400 })
  }

  const targetChannels: string[] = channels ?? DEFAULT_CHANNELS

  const posts = await generateCommunityContent({
    title,
    summary,
    sourceType: sourceType ?? 'scribe',
    channels: targetChannels,
  })

  // Save each as a Draft content post
  const saved = []
  for (const post of posts) {
    const [saved_post] = await db`
      INSERT INTO content_posts (title, channel, draft_content, status, notes)
      VALUES (
        ${post.title},
        ${post.channel},
        ${post.draft},
        'Draft',
        ${'Auto-generated from ' + (sourceType === 'sage' ? 'Sage research' : 'Scribe course material') + ': ' + title}
      )
      RETURNING id, title, channel, status`
    saved.push(saved_post)
  }

  // Log to activity feed
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Nova — Community Content Generated 📢\n**Source:** ' + title + '\n**Posts created:** ' + saved.length + ' drafts\n**Channels:** ' + targetChannels.join(', ') + '\n\nPosts are ready in the Content calendar for review.'},
      ARRAY['nova', 'community', 'social', 'content']
    FROM agents WHERE name = 'Nova' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Nova'`

  return NextResponse.json({ posts: saved, count: saved.length })
}
