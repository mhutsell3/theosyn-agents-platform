import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeDraft } from '@/lib/nova'

export async function POST(req: NextRequest) {
  const { post_id } = await req.json()

  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const [post] = await db`SELECT * FROM content_posts WHERE id = ${post_id}`
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const draft = await writeDraft({
    title: post.title,
    channel: post.channel,
    notes: post.notes,
  })

  await db`UPDATE content_posts SET draft_content = ${draft}, status = 'Draft' WHERE id = ${post_id}`

  await db`
    INSERT INTO nova_runs (run_type, input, output)
    VALUES ('draft', ${JSON.stringify({ post_id, title: post.title, channel: post.channel })}, ${draft})`

  return NextResponse.json({ draft })
}
