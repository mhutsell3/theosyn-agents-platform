import { db } from '@/lib/db'
import PulseDashboard from '@/components/PulseDashboard'

export const metadata = { title: 'Pulse — Social Media | TheoSYN' }
export const revalidate = 0

export default async function PulsePage() {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const [accounts, recentPosts, duePosts, lastHeartbeat] = await Promise.all([
    db`
      SELECT
        sa.*,
        COUNT(sp.id) FILTER (WHERE sp.status = 'posted' AND sp.posted_at >= ${oneWeekAgo}) as posts_this_week,
        COALESCE(SUM(se.likes) FILTER (WHERE sp.posted_at >= ${oneWeekAgo}), 0) as likes_this_week,
        COALESCE(SUM(se.comments) FILTER (WHERE sp.posted_at >= ${oneWeekAgo}), 0) as comments_this_week,
        COALESCE(SUM(se.reach) FILTER (WHERE sp.posted_at >= ${oneWeekAgo}), 0) as reach_this_week
      FROM social_accounts sa
      LEFT JOIN social_posts sp ON sp.social_account_id = sa.id
      LEFT JOIN social_engagement se ON se.social_post_id = sp.id
      WHERE sa.active = true
      GROUP BY sa.id
      ORDER BY sa.created_at ASC`,

    db`
      SELECT
        sp.id, sp.status, sp.posted_at, sp.error,
        sp.platform_post_id,
        cp.title, cp.channel,
        sa.page_name,
        COALESCE(se.likes, 0) as likes,
        COALESCE(se.comments, 0) as comments,
        COALESCE(se.reach, 0) as reach
      FROM social_posts sp
      JOIN content_posts cp ON cp.id = sp.content_post_id
      JOIN social_accounts sa ON sa.id = sp.social_account_id
      LEFT JOIN social_engagement se ON se.social_post_id = sp.id
      ORDER BY sp.posted_at DESC
      LIMIT 20`,

    db`
      SELECT cp.id, cp.title, cp.channel, cp.scheduled_date, cp.draft_content
      FROM content_posts cp
      WHERE cp.status = 'Scheduled'
        AND cp.draft_content IS NOT NULL
        AND cp.scheduled_date <= current_date
        AND EXISTS (
          SELECT 1 FROM social_accounts sa
          WHERE sa.platform::text = cp.channel::text AND sa.active = true
        )
        AND NOT EXISTS (
          SELECT 1 FROM social_posts sp
          JOIN social_accounts sa ON sa.id = sp.social_account_id
          WHERE sp.content_post_id = cp.id AND sp.status = 'posted'
        )
      ORDER BY cp.scheduled_date ASC`,

    db`
      SELECT content, created_at FROM heartbeats
      WHERE agent_id = (SELECT id FROM agents WHERE name = 'Pulse' LIMIT 1)
        AND 'weekly' = ANY(tags)
      ORDER BY created_at DESC
      LIMIT 1`,
  ])

  return (
    <PulseDashboard
      accounts={accounts as any[]}
      recentPosts={recentPosts as any[]}
      duePosts={duePosts as any[]}
      lastHeartbeat={(lastHeartbeat[0] as any) ?? null}
    />
  )
}
