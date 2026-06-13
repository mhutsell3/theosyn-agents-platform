import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const comments = await db`
    SELECT
      sc.*,
      cp.title as post_title,
      sa.page_name,
      sa.platform
    FROM social_comments sc
    JOIN social_posts sp ON sp.id = sc.social_post_id
    JOIN content_posts cp ON cp.id = sp.content_post_id
    JOIN social_accounts sa ON sa.id = sp.social_account_id
    WHERE sc.reply_status != 'dismissed'
    ORDER BY sc.fetched_at DESC
    LIMIT 100`
  return NextResponse.json({ comments })
}

export async function PATCH(req: NextRequest) {
  const { commentId, action, editedReply } = await req.json()

  if (action === 'dismiss') {
    await db`UPDATE social_comments SET reply_status = 'dismissed' WHERE id = ${commentId}`
    return NextResponse.json({ ok: true })
  }

  if (action === 'edit-draft' && editedReply) {
    await db`UPDATE social_comments SET reply_draft = ${editedReply} WHERE id = ${commentId}`
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
