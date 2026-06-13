import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAgentEnabled } from '@/lib/agent-settings'
import { generateGuide, uploadGuideToDrive } from '@/lib/logos'
import { auth } from '@/lib/auth'

// Called by cron on Mon/Wed/Fri/Sun
export async function POST() {
  if (!await isAgentEnabled('Logos')) {
    return NextResponse.json({ skipped: true, reason: 'Logos disabled' })
  }

  // Pick a topic that hasn't been used recently
  const recent = await db`
    SELECT topic_id FROM logos_guides
    WHERE topic_id IS NOT NULL
    AND created_at > now() - interval '60 days'`

  const recentIds = (recent as unknown as { topic_id: string }[]).map(r => r.topic_id).filter(Boolean)

  const [topic] = recentIds.length > 0
    ? await db`SELECT * FROM logos_topics WHERE active = true AND id != ALL(${recentIds}) ORDER BY RANDOM() LIMIT 1`
    : await db`SELECT * FROM logos_topics WHERE active = true ORDER BY RANDOM() LIMIT 1`

  if (!topic) {
    return NextResponse.json({ skipped: true, reason: 'No topics available' })
  }

  const t = topic as unknown as { id: string; title: string; scripture: string }

  // Generate
  const guide = await generateGuide(t.title, t.scripture)

  // Try Drive upload
  const session = await auth()
  const accessToken = (session as { accessToken?: string })?.accessToken
  let driveFileId = null
  let driveUrl = null
  if (accessToken) {
    const drive = await uploadGuideToDrive(guide, accessToken)
    if (drive) { driveFileId = drive.fileId; driveUrl = drive.url }
  }

  // Save
  await db`
    INSERT INTO logos_guides (topic_id, title, scripture, reflection, prayer, application, drive_file_id, drive_url, status, scheduled_for)
    VALUES (${t.id}, ${guide.title}, ${guide.scripture}, ${guide.reflection}, ${guide.prayer}, ${guide.application}, ${driveFileId}, ${driveUrl}, 'published', CURRENT_DATE)`

  // Log
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${`## Logos — Scheduled Guide 📖\n**Title:** ${guide.title}\n**Scripture:** ${guide.scripture}\n**Drive:** ${driveUrl ? '[View →](' + driveUrl + ')' : 'Pending — re-login to enable Drive'}`},
      ARRAY['logos', 'scheduled', 'devotional']
    FROM agents WHERE name = 'Logos' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Logos'`

  return NextResponse.json({ ok: true, title: guide.title, driveUrl })
}
