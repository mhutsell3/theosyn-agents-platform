import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { postToFacebook } from '@/lib/meta'

export async function POST() {
  const now = new Date().toISOString()

  const duePosts = await db`
    SELECT cp.*, sa.id as account_id, sa.page_id, sa.access_token, sa.page_name, sa.platform
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
    LIMIT 20`

  if ((duePosts as unknown[]).length === 0) {
    return NextResponse.json({ posted: 0, results: [], message: 'No posts due right now' })
  }

  const results = []

  for (const post of duePosts as unknown as {
    id: string; title: string; draft_content: string; url: string | null
    account_id: string; page_id: string; access_token: string; page_name: string; platform: string
  }[]) {
    try {
      let result
      if (post.platform === 'Facebook') {
        result = await postToFacebook({
          pageId: post.page_id,
          accessToken: post.access_token,
          message: post.draft_content,
          link: post.url ?? undefined,
        })
      } else {
        // Stub for future platforms
        results.push({ title: post.title, platform: post.platform, status: 'skipped', reason: 'Platform not yet supported' })
        continue
      }

      if (result.error) {
        await db`
          INSERT INTO social_posts (content_post_id, social_account_id, status, error)
          VALUES (${post.id}, ${post.account_id}, 'failed', ${result.error.message})`
        results.push({ title: post.title, platform: post.platform, status: 'failed', error: result.error.message })
      } else {
        await db`
          INSERT INTO social_posts (content_post_id, social_account_id, platform_post_id, status, posted_at)
          VALUES (${post.id}, ${post.account_id}, ${result.id}, 'posted', ${now})`
        await db`UPDATE content_posts SET status = 'Published', published_date = current_date WHERE id = ${post.id}`
        results.push({ title: post.title, platform: post.platform, status: 'posted', platform_post_id: result.id })
      }
    } catch (err) {
      results.push({ title: post.title, platform: post.platform, status: 'error', error: String(err) })
    }
  }

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Pulse'`

  return NextResponse.json({ posted: results.filter(r => r.status === 'posted').length, results })
}
