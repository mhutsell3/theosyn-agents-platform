import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { status, scheduled_date, notes, url, published_date, draft_content, post_time } = await req.json()
  const [post] = await db`
    UPDATE content_posts SET
      status         = coalesce(${status ?? null}, status),
      scheduled_date = coalesce(${scheduled_date ?? null}, scheduled_date),
      published_date = coalesce(${published_date ?? null}, published_date),
      notes          = coalesce(${notes ?? null}, notes),
      url            = coalesce(${url ?? null}, url),
      draft_content  = coalesce(${draft_content ?? null}, draft_content),
      post_time      = coalesce(${post_time ?? null}, post_time)
    WHERE id = ${id} RETURNING *`
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db`DELETE FROM content_posts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
