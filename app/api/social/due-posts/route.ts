import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const posts = await db`
    SELECT cp.id, cp.title, cp.draft_content, cp.channel, cp.url,
           sa.id as account_id, sa.page_id, sa.page_name
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
      )`
  return NextResponse.json(posts)
}
