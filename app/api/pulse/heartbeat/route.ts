import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generatePulseHeartbeat } from '@/lib/pulse'
import { isAgentEnabled } from '@/lib/agent-settings'

export async function POST() {
  if (!await isAgentEnabled('Pulse')) return NextResponse.json({ skipped: true, reason: 'Agent disabled' })

  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const oneWeekAhead = new Date(Date.now() + 7 * 86400000).toISOString()

  const [accounts, failedPosts, scheduledUpcoming] = await Promise.all([
    db`
      SELECT
        sa.page_name as name,
        sa.platform,
        COUNT(sp.id) FILTER (WHERE sp.status = 'posted' AND sp.posted_at >= ${oneWeekAgo}) as posts_this_week,
        COALESCE(SUM(se.likes) FILTER (WHERE sp.posted_at >= ${oneWeekAgo}), 0) as likes,
        COALESCE(SUM(se.comments) FILTER (WHERE sp.posted_at >= ${oneWeekAgo}), 0) as comments,
        COALESCE(SUM(se.reach) FILTER (WHERE sp.posted_at >= ${oneWeekAgo}), 0) as reach
      FROM social_accounts sa
      LEFT JOIN social_posts sp ON sp.social_account_id = sa.id
      LEFT JOIN social_engagement se ON se.social_post_id = sp.id
      WHERE sa.active = true
      GROUP BY sa.id, sa.page_name, sa.platform`,
    db`SELECT COUNT(*) as count FROM social_posts WHERE status = 'failed' AND posted_at >= ${oneWeekAgo}`,
    db`SELECT COUNT(*) as count FROM content_posts WHERE status = 'Scheduled' AND scheduled_date <= ${oneWeekAhead}`,
  ])

  const accs = accounts as unknown as { name: string; platform: string; posts_this_week: string; likes: string; comments: string; reach: string }[]

  const report = await generatePulseHeartbeat({
    accounts: accs.map(a => ({
      name: a.name,
      platform: a.platform,
      postsThisWeek: Number(a.posts_this_week),
      likes: Number(a.likes),
      comments: Number(a.comments),
      reach: Number(a.reach),
    })),
    totalPostsThisWeek: accs.reduce((s, a) => s + Number(a.posts_this_week), 0),
    totalReach: accs.reduce((s, a) => s + Number(a.reach), 0),
    failedPosts: Number((failedPosts[0] as unknown as { count: string }).count),
    scheduledUpcoming: Number((scheduledUpcoming[0] as unknown as { count: string }).count),
  })

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${report}, ARRAY['pulse', 'social', 'heartbeat', 'weekly']
    FROM agents WHERE name = 'Pulse' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Pulse'`

  return NextResponse.json({ report })
}
