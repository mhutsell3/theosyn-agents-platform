import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPostComments } from '@/lib/meta'
import { classifyComment, draftCommentReply, draftSimpleReply } from '@/lib/pulse'

export async function POST() {
  const monitorDaysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

  // Get all enabled monitored pages with their settings
  const pages = await db`
    SELECT
      sa.id as account_id, sa.page_id, sa.access_token, sa.page_name, sa.platform,
      pps.reply_tone, pps.auto_reply_simple, pps.sign_off_name,
      pps.monitor_days, pps.flag_negative, pps.flag_questions,
      pps.dead_post_alert, pps.spike_threshold
    FROM pulse_page_settings pps
    JOIN social_accounts sa ON sa.id = pps.social_account_id
    WHERE pps.enabled = true AND sa.active = true`

  if ((pages as unknown[]).length === 0) {
    return NextResponse.json({ message: 'No monitored pages configured', fetched: 0 })
  }

  let totalNew = 0
  let totalFlags = 0

  for (const page of pages as unknown as {
    account_id: string; page_id: string; access_token: string; page_name: string; platform: string
    reply_tone: string; auto_reply_simple: boolean; sign_off_name: string
    monitor_days: number; flag_negative: boolean; flag_questions: boolean
    dead_post_alert: boolean; spike_threshold: number
  }[]) {
    // Get recent posts for this page within monitor window
    const cutoff = monitorDaysAgo(page.monitor_days)
    const recentPosts = await db`
      SELECT sp.id, sp.platform_post_id, cp.title,
             COUNT(sc.id) as comment_count
      FROM social_posts sp
      JOIN content_posts cp ON cp.id = sp.content_post_id
      JOIN social_accounts sa ON sa.id = sp.social_account_id
      LEFT JOIN social_comments sc ON sc.social_post_id = sp.id
      WHERE sa.id = ${page.account_id}
        AND sp.status = 'posted'
        AND sp.posted_at >= ${cutoff}
        AND sp.platform_post_id IS NOT NULL
      GROUP BY sp.id, sp.platform_post_id, cp.title, sp.posted_at
      ORDER BY sp.posted_at DESC
      LIMIT 20`

    for (const post of recentPosts as unknown as {
      id: string; platform_post_id: string; title: string; comment_count: string
    }[]) {
      // Dead post alert — posted >24h ago with 0 engagement
      if (page.dead_post_alert) {
        const postedRow = await db`SELECT posted_at FROM social_posts WHERE id = ${post.id}`
        const postedAt = new Date((postedRow[0] as unknown as { posted_at: string }).posted_at)
        const hoursSincePost = (Date.now() - postedAt.getTime()) / 3600000
        if (hoursSincePost > 24 && Number(post.comment_count) === 0) {
          const flagExists = await db`
            SELECT id FROM pulse_flags
            WHERE social_post_id = ${post.id} AND flag_type = 'dead_post' AND resolved = false`
          if ((flagExists as unknown[]).length === 0) {
            await db`
              INSERT INTO pulse_flags (social_account_id, social_post_id, flag_type, message)
              VALUES (${page.account_id}, ${post.id}, 'dead_post',
                ${'Post "' + post.title + '" has 0 engagement after ' + Math.floor(hoursSincePost) + ' hours.'})`
            totalFlags++
          }
        }
      }

      // Pull comments from Facebook
      let comments: { id: string; message: string; from: { name: string } }[]
      try {
        comments = await getPostComments({ postId: post.platform_post_id, accessToken: page.access_token })
      } catch {
        continue
      }

      // Spike alert
      if (comments.length >= page.spike_threshold) {
        const spikeExists = await db`
          SELECT id FROM pulse_flags
          WHERE social_post_id = ${post.id} AND flag_type = 'spike' AND resolved = false`
        if ((spikeExists as unknown[]).length === 0) {
          await db`
            INSERT INTO pulse_flags (social_account_id, social_post_id, flag_type, message)
            VALUES (${page.account_id}, ${post.id}, 'spike',
              ${'Post "' + post.title + '" has ' + comments.length + ' comments — spike detected!'})`
          totalFlags++
        }
      }

      for (const comment of comments) {
        // Skip if already saved
        const exists = await db`
          SELECT id FROM social_comments WHERE platform_comment_id = ${comment.id}`
        if ((exists as unknown[]).length > 0) continue

        const { isSimple, isQuestion, isNegative } = classifyComment(comment.message)

        // Flag negative comments
        if (isNegative && page.flag_negative) {
          await db`
            INSERT INTO pulse_flags (social_account_id, social_post_id, flag_type, message)
            VALUES (${page.account_id}, ${post.id}, 'negative_comment',
              ${'Negative comment from ' + (comment.from?.name ?? 'Unknown') + ': "' + comment.message.slice(0, 100) + '"'})`
          totalFlags++
        }

        // Flag questions
        if (isQuestion && page.flag_questions) {
          await db`
            INSERT INTO pulse_flags (social_account_id, social_post_id, flag_type, message)
            VALUES (${page.account_id}, ${post.id}, 'question',
              ${'Question from ' + (comment.from?.name ?? 'Unknown') + ': "' + comment.message.slice(0, 100) + '"'})`
          totalFlags++
        }

        // Draft reply
        let replyDraft: string | null = null
        let replyStatus = 'pending'

        if (isSimple && page.auto_reply_simple) {
          replyDraft = await draftSimpleReply({ fromName: comment.from?.name ?? 'Friend', tone: page.reply_tone, signOff: page.sign_off_name })
          replyStatus = 'approved' // auto-approved, ready to send
        } else {
          replyDraft = await draftCommentReply({
            postTitle: post.title,
            pageName: page.page_name,
            commentMessage: comment.message,
            fromName: comment.from?.name ?? 'Friend',
            tone: page.reply_tone,
            signOff: page.sign_off_name,
          })
        }

        await db`
          INSERT INTO social_comments (
            social_post_id, platform_comment_id, from_name, message,
            reply_draft, reply_status, is_simple, is_question, is_negative
          ) VALUES (
            ${post.id}, ${comment.id}, ${comment.from?.name ?? null}, ${comment.message},
            ${replyDraft}, ${replyStatus}, ${isSimple}, ${isQuestion}, ${isNegative}
          )`

        totalNew++
      }
    }
  }

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Pulse'`

  return NextResponse.json({ fetched: totalNew, flags: totalFlags })
}
