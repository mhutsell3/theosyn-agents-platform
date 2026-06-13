import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { repurposeForChannels } from '@/lib/nova'
import { CONTENT_CHANNELS } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { post_id, channels } = await req.json()

  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const [post] = await db`SELECT * FROM content_posts WHERE id = ${post_id}`
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (!post.draft_content) return NextResponse.json({ error: 'Post has no draft content to repurpose' }, { status: 400 })

  const targetChannels = channels ?? CONTENT_CHANNELS.filter((c: string) => c !== post.channel)

  const variants = await repurposeForChannels({
    title: post.title,
    originalContent: post.draft_content,
    channels: targetChannels,
  })

  // Save variants
  for (const [channel, content] of Object.entries(variants)) {
    await db`
      INSERT INTO content_variants (post_id, channel, draft_content, status)
      VALUES (${post_id}, ${channel}, ${content}, 'Draft')
      ON CONFLICT DO NOTHING`
  }

  await db`
    INSERT INTO nova_runs (run_type, input, ideas_added)
    VALUES ('repurpose', ${JSON.stringify({ post_id, channels: targetChannels })}, ${targetChannels.length})`

  return NextResponse.json({ variants, count: targetChannels.length })
}
