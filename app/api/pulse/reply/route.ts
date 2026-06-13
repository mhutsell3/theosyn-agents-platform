import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { replyToComment } from '@/lib/meta'

export async function POST(req: NextRequest) {
  const { commentId, editedReply } = await req.json()
  if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 })

  const [comment] = await db`
    SELECT sc.*, sp.platform_post_id, sa.access_token, sa.page_id
    FROM social_comments sc
    JOIN social_posts sp ON sp.id = sc.social_post_id
    JOIN social_accounts sa ON sa.id = sp.social_account_id
    WHERE sc.id = ${commentId}`

  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  const c = comment as unknown as {
    id: string; platform_comment_id: string; reply_draft: string
    access_token: string
  }

  const message = editedReply?.trim() || c.reply_draft
  if (!message) return NextResponse.json({ error: 'No reply text' }, { status: 400 })

  const result = await replyToComment({
    commentId: c.platform_comment_id,
    accessToken: c.access_token,
    message,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  await db`
    UPDATE social_comments SET
      reply_status = 'sent',
      reply_draft = ${message},
      platform_reply_id = ${result.id},
      replied_at = now()
    WHERE id = ${commentId}`

  return NextResponse.json({ ok: true, platform_reply_id: result.id })
}
