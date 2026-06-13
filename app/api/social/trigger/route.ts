import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { postToFacebook } from '@/lib/meta'

export async function POST() {
  const now = new Date().toISOString()

  const duePosts = await db`
    SELECT cp.id, cp.title, cp.draft_content, cp.url,
           sa.id as account_id, sa.page_id, sa.access_token, sa.page_name
    FROM content_posts cp
    CROSS JOIN social_accounts sa
    WHERE cp.status = 'Scheduled'
      AND cp.draft_content IS NOT NULL
      AND cp.channel::text = sa.platform::text
      AND sa.active = true
      AND cp.scheduled_date <= current_date
      AND NOT EXISTS (
        SELECT 1 FROM social_posts sp
        WHERE sp.content_post_id = cp.id
          AND sp.social_account_id = sa.id
          AND sp.status = 'posted'
      )
    LIMIT 10`

  const results = []

  for (const post of duePosts) {
    const result = await postToFacebook({
      pageId: post.page_id,
      accessToken: post.access_token,
      message: post.draft_content,
      link: post.url ?? undefined,
    })

    if (result.error) {
      await db`INSERT INTO social_posts (content_post_id, social_account_id, status, error)
               VALUES (${post.id}, ${post.account_id}, 'failed', ${result.error.message})`
      results.push({ title: post.title, status: 'failed', error: result.error.message })
    } else {
      await db`INSERT INTO social_posts (content_post_id, social_account_id, platform_post_id, status, posted_at)
               VALUES (${post.id}, ${post.account_id}, ${result.id}, 'posted', ${now})`
      await db`UPDATE content_posts SET status = 'Published', published_date = current_date WHERE id = ${post.id}`
      results.push({ title: post.title, status: 'posted', platform_post_id: result.id })
    }
  }

  return NextResponse.json({ posted: results.length, results })
}
