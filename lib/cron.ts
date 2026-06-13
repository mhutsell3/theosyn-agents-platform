import cron from 'node-cron'
import { db } from './db'
import { postToFacebook, getPostEngagement } from './meta'
import { postToLinkedIn } from './linkedin-post'
import { postToInstagram } from './instagram'
import { postToX } from './x-post'
import { generateHeartbeat } from './nova'
import { searchPlaces, generateOutreach, generateFollowUp, generateFollowUp2, findContactEmail, auditWebsite, deepEmailDiscovery, sendViaGmail, submitContactForm, bestOutreachChannel, SEARCH_CENTERS } from './scout'
import { isChainBusiness } from './scout-config'
import { getVoiceProfile } from './quill'
import { theoThink } from './theo'

// Scout prospecting — categories rotated weekly, centers rotated daily
const SCOUT_WEEKLY_CATEGORIES = [
  ['church', 'restaurant', 'hair_salon'],
  ['church', 'dentist', 'gym'],
  ['church', 'bakery', 'beauty_salon'],
  ['church', 'real_estate_agency', 'insurance_agency'],
  ['church', 'lawyer', 'roofing_contractor'],
  ['church', 'general_contractor', 'veterinary_care'],
]

let started = false

export function startCron() {
  if (started) return
  started = true

  // Every 15 minutes — check for posts due to go out
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Cron] Checking for scheduled posts...')
    try {
      await publishDuePosts()
    } catch (err) {
      console.error('[Cron] publishDuePosts error:', err)
    }
  })

  // Every hour — fetch engagement metrics
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Fetching engagement metrics...')
    try {
      await fetchEngagement()
    } catch (err) {
      console.error('[Cron] fetchEngagement error:', err)
    }
  })

  // Every 4 hours — Theo autonomous review
  cron.schedule('0 */4 * * *', async () => {
    console.log('[Cron] Theo thinking...')
    try {
      await theoThink('cron')
    } catch (err) {
      console.error('[Cron] Theo error:', err)
    }
  })

  // Every day at 12pm UTC (8am ET) — Pulse social heartbeats
  cron.schedule('15 12 * * *', async () => {
    console.log('[Cron] Writing social agent heartbeats...')
    try {
      await writeSocialHeartbeats()
    } catch (err) {
      console.error('[Cron] heartbeat error:', err)
    }
  })

  // Every 2 hours — Pulse comment monitoring
  cron.schedule('0 */2 * * *', async () => {
    console.log('[Cron] Pulse fetching comments...')
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/pulse/fetch-comments`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('[Cron] Pulse fetch-comments error:', err)
    }
  })

  // Every Monday at 12:30pm UTC (8:30am ET) — Pulse weekly report
  cron.schedule('30 12 * * 1', async () => {
    console.log('[Cron] Pulse weekly report...')
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/pulse/heartbeat`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('[Cron] Pulse heartbeat error:', err)
    }
  })

  // Every day at 12pm UTC (8am ET) — Theo daily standup
  cron.schedule('0 12 * * *', async () => {
    console.log('[Cron] Theo daily standup...')
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/theo/standup`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('[Cron] Standup error:', err)
    }
  })

  // Every day at 1pm UTC (9am ET) — Remi Meta Ads heartbeat
  cron.schedule('0 13 * * *', async () => {
    console.log('[Cron] Remi Meta Ads heartbeat...')
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/remi/heartbeat`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('[Cron] Remi heartbeat error:', err)
    }
  })

  // Every day at 11am UTC (7am ET) — Nova: auto-fill content queue
  cron.schedule('0 11 * * *', async () => {
    console.log('[Cron] Nova checking content queue...')
    try {
      await novaRefillQueue()
    } catch (err) {
      console.error('[Cron] Nova queue refill error:', err)
    }
  })

  // Every Monday at 10am UTC (6am ET) — Scout autonomous prospecting
  cron.schedule('0 10 * * 1', async () => {
    console.log('[Cron] Scout autonomous prospecting...')
    try {
      await scoutProspect()
    } catch (err) {
      console.error('[Cron] Scout prospecting error:', err)
    }
  })

  // Every day at 12pm UTC (8am ET) — Scout: auto-generate outreach emails
  cron.schedule('0 12 * * *', async () => {
    console.log('[Cron] Scout generating outreach for Grade A leads...')
    try {
      await scoutGenerateOutreach()
    } catch (err) {
      console.error('[Cron] Scout outreach error:', err)
    }
  })

  // Every day at 2pm UTC (10am ET) — Theo: autonomous outreach sweep
  cron.schedule('0 14 * * *', async () => {
    console.log('[Cron] Theo outreach sweep...')
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/theo/outreach-sweep`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('[Cron] Theo outreach sweep error:', err)
    }
  })

  // Every day at 2:30pm UTC (10:30am ET) — Scout: flag stale leads
  cron.schedule('30 14 * * *', async () => {
    console.log('[Cron] Scout checking for stale contacted leads...')
    try {
      await scoutFollowUpCheck()
    } catch (err) {
      console.error('[Cron] Scout follow-up error:', err)
    }
  })

  // Every day at 2:35pm UTC (10:35am ET) — Scout: Day 3 follow-up + Day 11 graceful exit + Day 12 auto-dismiss
  cron.schedule('35 14 * * *', async () => {
    console.log('[Cron] Scout sending follow-up emails...')
    try {
      await scoutSendFollowUps()
      await scoutSendFollowUps2()
      await scoutAutoDismissStale()
    } catch (err) {
      console.error('[Cron] Scout follow-up send error:', err)
    }
  })

  // Mon/Wed/Fri/Sun at 6am UTC — Logos: generate scheduled devotional guide
  cron.schedule('0 6 * * 1,3,5,0', async () => {
    console.log('[Cron] Logos generating scheduled devotional...')
    try {
      await fetch(`${process.env.AUTH_URL ?? 'http://localhost:3001'}/api/logos/heartbeat`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('[Cron] Logos heartbeat error:', err)
    }
  })

  console.log('[Cron] Scheduler started.')
}

async function publishDuePosts() {
  const now = new Date()
  const nowStr = now.toISOString()

  // Find content posts that are scheduled, have draft content, and are due
  const duePosts = await db`
    SELECT cp.*, sa.id as account_id, sa.page_id, sa.access_token, sa.page_name, sa.platform
    FROM content_posts cp
    CROSS JOIN social_accounts sa
    WHERE cp.status = 'Scheduled'
      AND cp.draft_content IS NOT NULL
      AND cp.channel::text = sa.platform::text
      AND sa.active = true
      AND cp.scheduled_date <= current_date
      AND (
        cp.post_time IS NULL
        OR (cp.scheduled_date = current_date AND cp.post_time <= current_time)
      )
      AND NOT EXISTS (
        SELECT 1 FROM social_posts sp
        WHERE sp.content_post_id = cp.id
          AND sp.social_account_id = sa.id
          AND sp.status = 'posted'
      )
    LIMIT 10`

  for (const post of duePosts) {
    console.log(`[Cron] Posting "${post.title}" to ${post.page_name} (${post.platform})`)
    try {
      let result: { id: string; error?: { message: string; code: number } }

      if (post.platform === 'LinkedIn') {
        result = await postToLinkedIn({
          accessToken: post.access_token,
          authorUrn: post.page_id,
          message: post.draft_content,
          link: post.url ?? undefined,
        })
      } else if (post.platform === 'Instagram') {
        result = await postToInstagram({
          igAccountId: post.page_id,
          accessToken: post.access_token,
          caption: post.draft_content,
          imageUrl: post.url ?? undefined,
        })
      } else if (post.platform === 'X') {
        result = await postToX({
          text: post.draft_content,
          link: post.url ?? undefined,
        })
      } else {
        // Default: Facebook
        result = await postToFacebook({
          pageId: post.page_id,
          accessToken: post.access_token,
          message: post.draft_content,
          link: post.url ?? undefined,
        })
      }

      if (result.error) {
        await db`
          INSERT INTO social_posts (content_post_id, social_account_id, status, error)
          VALUES (${post.id}, ${post.account_id}, 'failed', ${result.error.message})`
        console.error(`[Cron] Failed to post: ${result.error.message}`)
      } else {
        await db`
          INSERT INTO social_posts (content_post_id, social_account_id, platform_post_id, status, posted_at)
          VALUES (${post.id}, ${post.account_id}, ${result.id}, 'posted', ${nowStr})`
        await db`UPDATE content_posts SET status = 'Published', published_date = current_date WHERE id = ${post.id}`
        console.log(`[Cron] Posted successfully: ${result.id}`)
      }
    } catch (err) {
      console.error(`[Cron] Error posting ${post.title}:`, err)
    }
  }
}

async function fetchEngagement() {
  const postedItems = await db`
    SELECT sp.id, sp.platform_post_id, sa.access_token
    FROM social_posts sp
    JOIN social_accounts sa ON sa.id = sp.social_account_id
    WHERE sp.status = 'posted' AND sp.platform_post_id IS NOT NULL
    ORDER BY sp.posted_at DESC
    LIMIT 20`

  for (const item of postedItems) {
    try {
      const eng = await getPostEngagement({
        postId: item.platform_post_id,
        accessToken: item.access_token,
      })
      await db`
        INSERT INTO social_engagement (social_post_id, likes, comments, shares, reach)
        VALUES (${item.id}, ${eng.likes}, ${eng.comments}, ${eng.shares}, ${eng.reach})`
    } catch (err) {
      console.error(`[Cron] Engagement fetch error for ${item.platform_post_id}:`, err)
    }
  }
}

async function writeSocialHeartbeats() {
  const accounts = await db`
    SELECT sa.*, a.id as agent_row_id
    FROM social_accounts sa
    LEFT JOIN agents a ON a.id = sa.agent_id
    WHERE sa.active = true AND sa.agent_id IS NOT NULL`

  for (const account of accounts) {
    const [stats] = await db`
      SELECT
        COUNT(sp.id) FILTER (WHERE sp.status = 'posted') as posts_total,
        COALESCE(SUM(se.likes), 0) as total_likes,
        COALESCE(SUM(se.comments), 0) as total_comments,
        COALESCE(SUM(se.reach), 0) as total_reach
      FROM social_posts sp
      LEFT JOIN social_engagement se ON se.social_post_id = sp.id
      WHERE sp.social_account_id = ${account.id}
        AND sp.posted_at >= now() - interval '7 days'`

    const content = `## ${account.page_name} — Weekly Social Report

**Platform:** ${account.platform}

| Metric | This Week |
|---|---|
| Posts Published | ${stats.posts_total} |
| Total Likes | ${stats.total_likes} |
| Total Comments | ${stats.total_comments} |
| Total Reach | ${stats.total_reach} |

${Number(stats.posts_total) === 0 ? '⚠️ No posts this week — check content calendar.' : '✓ Page is active.'}`

    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      VALUES (${account.agent_row_id}, ${content}, ARRAY['social', 'facebook', 'heartbeat'])`
  }
}

// ── Scout autonomous functions ────────────────────────────────────────────

async function scoutProspect() {
  // Rotate categories AND search center by week number
  const weekNum = Math.floor(Date.now() / (7 * 86400000))
  const categories = SCOUT_WEEKLY_CATEGORIES[weekNum % SCOUT_WEEKLY_CATEGORIES.length]
  const center = SEARCH_CENTERS[weekNum % SEARCH_CENTERS.length]

  console.log(`[Scout] Prospecting from: ${center.label}`)

  let totalSaved = 0
  let totalGradeA = 0

  for (const category of categories) {
    try {
      console.log(`[Scout] Prospecting category: ${category} near ${center.label}`)
      const leads = await searchPlaces(category, 20, center)

      for (const lead of leads) {
        // Skip major chains
        if (isChainBusiness(lead.name)) continue

        // Run email discovery alongside audit
        const [auditResult, emailResult] = await Promise.all([
          lead.website ? auditWebsite(lead.website) : Promise.resolve(null),
          lead.website ? findContactEmail(lead.website) : Promise.resolve(null),
        ])

        if (auditResult) {
          lead.website_score = auditResult.score
          lead.website_mobile = auditResult.mobile
          if (auditResult.score < 50) lead.score = Math.min(lead.score + 20, 100)
          lead.grade = lead.score >= 70 ? 'A' : lead.score >= 45 ? 'B' : 'C'
        }

        // Deep email discovery if basic scrape found nothing
        let contactEmail = emailResult?.email ?? null
        let emailSource = emailResult?.source ?? null
        if (!contactEmail) {
          const deep = await deepEmailDiscovery(lead.name, lead.address, lead.website)
          if (deep) { contactEmail = deep.email; emailSource = deep.source }
        }

        try {
          await db`
            INSERT INTO scout_leads (
              place_id, name, address, phone, website, category,
              rating, review_count, gmb_has_hours, gmb_has_photos,
              gmb_has_description, has_website, has_gmb,
              website_score, website_mobile, grade, score, lat, lng,
              contact_email, email_source
            ) VALUES (
              ${lead.place_id}, ${lead.name}, ${lead.address}, ${lead.phone},
              ${lead.website}, ${lead.category}, ${lead.rating}, ${lead.review_count},
              ${lead.gmb_has_hours}, ${lead.gmb_has_photos}, ${lead.gmb_has_description},
              ${lead.has_website}, ${lead.has_gmb}, ${lead.website_score},
              ${lead.website_mobile}, ${lead.grade}, ${lead.score}, ${lead.lat}, ${lead.lng},
              ${contactEmail}, ${emailSource}
            )
            ON CONFLICT (place_id) DO UPDATE SET
              score = EXCLUDED.score, grade = EXCLUDED.grade,
              website_score = EXCLUDED.website_score,
              contact_email = COALESCE(EXCLUDED.contact_email, scout_leads.contact_email),
              updated_at = now()`
          totalSaved++
          if (lead.grade === 'A') totalGradeA++
        } catch { /* skip duplicates */ }
      }
    } catch (err) {
      console.error(`[Scout] Error prospecting ${category}:`, err)
    }
  }

  // Write heartbeat
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Scout — Autonomous Prospecting\n**Area:** ' + center.label + '\n**Categories scanned:** ' + categories.join(', ') + '\n**New leads saved:** ' + totalSaved + '\n**Grade A leads:** ' + totalGradeA + '\n\nOutreach emails will be generated shortly for all new Grade A leads.'},
      ARRAY['scout', 'prospecting', 'autonomous']
    FROM agents WHERE name = 'Scout' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`
  console.log(`[Scout] Prospecting complete: ${totalSaved} saved, ${totalGradeA} Grade A`)
}

async function scoutGenerateOutreach() {
  // Find Grade A leads with no outreach email yet
  const leads = await db`
    SELECT * FROM scout_leads
    WHERE grade = 'A'
      AND outreach_status = 'new'
      AND outreach_email IS NULL
    ORDER BY score DESC
    LIMIT 10`

  if ((leads as unknown[]).length === 0) {
    console.log('[Scout] No new Grade A leads need outreach.')
    return
  }

  let generated = 0
  for (const lead of leads as unknown as {
    id: string; name: string; category: string; address: string
    has_website: boolean; website_score: number | null
    gmb_has_hours: boolean; gmb_has_photos: boolean
    gmb_has_description: boolean; grade: string
  }[]) {
    try {
      const voiceProfile = await getVoiceProfile().catch(() => '')
      const email = await generateOutreach(lead, voiceProfile)
      await db`
        UPDATE scout_leads
        SET outreach_email = ${email}, approval_status = 'pending', updated_at = now()
        WHERE id = ${lead.id}`
      generated++
      console.log(`[Scout] Generated outreach for: ${lead.name}`)
    } catch (err) {
      console.error(`[Scout] Outreach generation error for ${lead.name}:`, err)
    }
  }

  if (generated > 0) {
    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      SELECT id,
        ${'## Scout — ✋ Approval Needed\nGenerated ' + generated + ' personalized outreach emails for new Grade A leads.\n\nVisit **Scout → Pending Approval** to review and send.'},
        ARRAY['scout', 'outreach', 'approval']
      FROM agents WHERE name = 'Scout' LIMIT 1`

    await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`
  }

  console.log(`[Scout] Generated outreach for ${generated} leads.`)
}

async function scoutSendFollowUps() {
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
  const fiveDaysAgo = threeDaysAgo // alias — Day 3

  // Leads contacted 3+ days ago, no response, follow-up 1 not yet sent
  const leads = await db`
    SELECT * FROM scout_leads
    WHERE outreach_status = 'contacted'
      AND outreach_sent_at IS NOT NULL
      AND outreach_sent_at <= ${fiveDaysAgo}
      AND follow_up_sent = false
      AND approval_status NOT IN ('dismissed')
      AND grade IN ('A', 'B')
    ORDER BY outreach_sent_at ASC
    LIMIT 20`

  if ((leads as unknown[]).length === 0) {
    console.log('[Scout] No follow-ups due today.')
    return
  }

  // Get Gmail token
  const [tokenRow] = await db`
    SELECT access_token FROM social_accounts
    WHERE platform = 'Gmail' AND active = true LIMIT 1`
  const accessToken = (tokenRow as { access_token?: string } | undefined)?.access_token ?? null

  const fromName = 'Milford Hutsell'
  const fromEmail = process.env.SCOUT_REPLY_EMAIL ?? process.env.ALLOWED_EMAIL ?? 'milford.hutsell@gmail.com'

  let sent = 0
  let failed = 0

  for (const rawLead of leads as unknown as {
    id: string; name: string; address: string; category: string
    website: string | null; contact_email: string | null
    social_facebook: string | null; phone: string | null
    has_website: boolean; website_score: number | null
    website_mobile: boolean | null; gmb_has_hours: boolean
    gmb_has_photos: boolean; gmb_has_description: boolean
    rating: number | null; review_count: number | null
    grade: string; outreach_email: string | null
    follow_up_email: string | null
  }[]) {
    try {
      // Generate follow-up if not already done
      let followUpBody = rawLead.follow_up_email
      if (!followUpBody) {
        const voiceProfile2 = await getVoiceProfile().catch(() => '')
        followUpBody = await generateFollowUp({
          ...rawLead,
          outreach_email: rawLead.outreach_email ?? '',
        }, voiceProfile2)
        await db`UPDATE scout_leads SET follow_up_email = ${followUpBody} WHERE id = ${rawLead.id}`
      }

      const channel = bestOutreachChannel(rawLead)
      const subject = `Following up — ${rawLead.name}`
      let success = false

      if (channel === 'email' && rawLead.contact_email && accessToken) {
        const result = await sendViaGmail({
          accessToken,
          to: rawLead.contact_email,
          subject,
          body: followUpBody,
          fromName,
        })
        success = result.success
      } else if (channel === 'contact_form' && rawLead.website) {
        success = await submitContactForm(rawLead.website, {
          name: rawLead.name,
          outreach: followUpBody,
          fromEmail,
          fromName,
        })
      }

      if (success) {
        await db`
          UPDATE scout_leads
          SET follow_up_sent = true,
              follow_up_sent_at = now(),
              updated_at = now()
          WHERE id = ${rawLead.id}`
        sent++
        console.log(`[Scout] Follow-up sent to: ${rawLead.name}`)
      } else {
        failed++
      }
    } catch (err) {
      console.error(`[Scout] Follow-up error for ${rawLead.name}:`, err)
      failed++
    }
  }

  if (sent > 0) {
    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      SELECT id,
        ${'## Scout — Follow-Up Emails Sent\n**Sent:** ' + sent + '\n**Failed:** ' + failed + '\nAll leads contacted 5 days ago with no response have received a follow-up.'},
        ARRAY['scout', 'followup', 'autonomous']
      FROM agents WHERE name = 'Scout' LIMIT 1`
    await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`
  }

  console.log(`[Scout] Follow-ups: ${sent} sent, ${failed} failed.`)
}

async function scoutSendFollowUps2() {
  const elevenDaysAgo = new Date(Date.now() - 11 * 86400000).toISOString()

  // Leads where follow-up 1 was sent 8+ days ago (11 days since initial), no response, follow-up 2 not sent
  const leads = await db`
    SELECT * FROM scout_leads
    WHERE follow_up_sent = true
      AND follow_up_sent_at IS NOT NULL
      AND follow_up_sent_at <= ${elevenDaysAgo}
      AND follow_up_2_sent = false
      AND outreach_status = 'contacted'
      AND approval_status NOT IN ('dismissed')
      AND grade IN ('A', 'B')
    ORDER BY follow_up_sent_at ASC
    LIMIT 20`

  if ((leads as unknown[]).length === 0) {
    console.log('[Scout] No Day 11 follow-ups due today.')
    return
  }

  const [tokenRow] = await db`
    SELECT access_token FROM social_accounts
    WHERE platform = 'Gmail' AND active = true LIMIT 1`
  const accessToken = (tokenRow as { access_token?: string } | undefined)?.access_token ?? null

  const fromName = 'Milford Hutsell'
  const fromEmail = process.env.SCOUT_REPLY_EMAIL ?? process.env.ALLOWED_EMAIL ?? 'milford.hutsell@gmail.com'
  let sent = 0

  for (const rawLead of leads as unknown as {
    id: string; name: string; address: string; category: string
    website: string | null; contact_email: string | null
    social_facebook: string | null; phone: string | null
    has_website: boolean; website_score: number | null
    website_mobile: boolean | null; gmb_has_hours: boolean
    gmb_has_photos: boolean; gmb_has_description: boolean
    rating: number | null; review_count: number | null
    grade: string; follow_up_2_email: string | null
  }[]) {
    try {
      let body = rawLead.follow_up_2_email
      if (!body) {
        const voiceProfile3 = await getVoiceProfile().catch(() => '')
        body = await generateFollowUp2(rawLead, voiceProfile3)
        await db`UPDATE scout_leads SET follow_up_2_email = ${body} WHERE id = ${rawLead.id}`
      }

      const channel = bestOutreachChannel(rawLead)
      const subject = `Quick note — ${rawLead.name}`
      let success = false

      if (channel === 'email' && rawLead.contact_email && accessToken) {
        const result = await sendViaGmail({ accessToken, to: rawLead.contact_email, subject, body, fromName })
        success = result.success
      } else if (channel === 'contact_form' && rawLead.website) {
        success = await submitContactForm(rawLead.website, { name: rawLead.name, outreach: body, fromEmail, fromName })
      }

      if (success) {
        await db`
          UPDATE scout_leads
          SET follow_up_2_sent = true, follow_up_2_sent_at = now(), updated_at = now()
          WHERE id = ${rawLead.id}`
        sent++
      }
    } catch (err) {
      console.error(`[Scout] Follow-up 2 error for ${rawLead.name}:`, err)
    }
  }

  if (sent > 0) {
    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      SELECT id,
        ${'## Scout — Final Follow-Up Sent (Day 11)\n**Sent:** ' + sent + '\nGraceful exit emails delivered. These leads will be auto-dismissed tomorrow if no response.'},
        ARRAY['scout', 'followup2', 'autonomous']
      FROM agents WHERE name = 'Scout' LIMIT 1`
    await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`
  }

  console.log(`[Scout] Day 11 follow-ups: ${sent} sent.`)
}

async function scoutAutoDismissStale() {
  const twelveDaysAgo = new Date(Date.now() - 12 * 86400000).toISOString()

  // Auto-dismiss leads where final follow-up was sent 1+ days ago with no response
  const result = await db`
    UPDATE scout_leads
    SET approval_status = 'dismissed', updated_at = now()
    WHERE follow_up_2_sent = true
      AND follow_up_2_sent_at IS NOT NULL
      AND follow_up_2_sent_at <= ${twelveDaysAgo}
      AND outreach_status = 'contacted'
      AND approval_status NOT IN ('dismissed', 'responded', 'converted')`

  const count = (result as unknown as { count?: number }).count ?? 0
  if (count > 0) {
    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      SELECT id,
        ${'## Scout — Auto-Dismissed ' + count + ' Stale Leads\nLeads that received 3 contacts over 12 days with no response have been dismissed. Clean queue.'},
        ARRAY['scout', 'dismissed', 'cleanup']
      FROM agents WHERE name = 'Scout' LIMIT 1`
    console.log(`[Scout] Auto-dismissed ${count} stale leads.`)
  }
}

async function scoutFollowUpCheck() {
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()

  // Find leads contacted >3 days ago with no response
  const stale = await db`
    SELECT id, name, contact_email, grade, category
    FROM scout_leads
    WHERE outreach_status = 'contacted'
      AND updated_at <= ${threeDaysAgo}
    ORDER BY grade ASC, updated_at ASC
    LIMIT 20`

  if ((stale as unknown[]).length === 0) {
    console.log('[Scout] No stale contacted leads.')
    return
  }

  const staleList = stale as unknown as { id: string; name: string; contact_email: string | null; grade: string; category: string }[]

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Scout — Follow-Up Alert ⏰\n' + staleList.length + ' leads contacted 3+ days ago with no response:\n\n' + staleList.map(l => `- **${l.name}** (Grade ${l.grade}) — ${l.contact_email ?? 'no email'}`).join('\n') + '\n\nConsider sending a follow-up or dismissing these leads.'},
      ARRAY['scout', 'followup', 'alert']
    FROM agents WHERE name = 'Scout' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`
  console.log(`[Scout] Follow-up alert: ${staleList.length} stale leads flagged.`)
}

// ── Nova: auto-refill the content queue ───────────────────────────────────────
async function novaRefillQueue() {
  const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

  // Count posts scheduled in the next 7 days that have draft content
  const [{ count }] = await db`
    SELECT COUNT(*)::int AS count
    FROM content_posts
    WHERE status IN ('Scheduled', 'Draft')
      AND draft_content IS NOT NULL
      AND scheduled_date >= current_date
      AND scheduled_date <= current_date + interval '7 days'` as unknown as [{ count: number }]

  console.log(`[Nova] Upcoming posts with content in next 7 days: ${count}`)

  // Target: at least 5 posts in the queue at all times
  if (count >= 5) {
    console.log('[Nova] Queue is healthy — no refill needed.')
    return
  }

  const needed = 5 - count
  console.log(`[Nova] Queue low — generating ${needed} new post(s)...`)

  // 1. Generate new ideas
  const ideasRes = await fetch(`${APP}/api/nova/ideas`, { method: 'POST' })
  const ideasData = await ideasRes.json()
  console.log(`[Nova] Generated ${ideasData.count ?? 0} ideas`)

  // 2. Find undrafted posts (Idea status, no draft_content) and draft them
  const undrafted = await db`
    SELECT id, title, channel
    FROM content_posts
    WHERE status = 'Idea'
      AND (draft_content IS NULL OR draft_content = '')
    ORDER BY created_at ASC
    LIMIT ${needed}` as unknown as { id: string; title: string; channel: string }[]

  let drafted = 0
  for (const post of undrafted) {
    try {
      await fetch(`${APP}/api/nova/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })
      // Schedule for tomorrow + drafted index days out to spread them
      await db`
        UPDATE content_posts
        SET status = 'Scheduled',
            scheduled_date = current_date + ${drafted + 1}
        WHERE id = ${post.id} AND (status = 'Idea' OR draft_content IS NULL)`
      drafted++
      console.log(`[Nova] Drafted & scheduled: "${post.title}"`)
    } catch (err) {
      console.error(`[Nova] Failed to draft "${post.title}":`, err)
    }
  }

  // Heartbeat
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${`## Nova — Queue Refill 🔄\n**Queue was low:** ${count} post(s) scheduled\n**Ideas generated:** ${ideasData.count ?? 0}\n**Drafted & scheduled:** ${drafted} post(s)`},
      ARRAY['nova', 'content', 'auto']
    FROM agents WHERE name = 'Nova' LIMIT 1`
  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Nova'`
}
