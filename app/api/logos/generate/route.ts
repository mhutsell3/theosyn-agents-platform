import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generateGuide, uploadGuideToDrive } from '@/lib/logos'

export async function POST(req: NextRequest) {
  const session = await auth()
  const accessToken = (session as { accessToken?: string })?.accessToken

  const { topicId, customTopic, scheduledFor } = await req.json()

  // Resolve topic
  let topicTitle = customTopic ?? null
  let topicScripture = null
  let resolvedTopicId = topicId ?? null

  if (topicId) {
    const [row] = await db`SELECT * FROM logos_topics WHERE id = ${topicId}` as unknown as { title: string; scripture: string }[]
    if (row) {
      topicTitle = row.title
      topicScripture = row.scripture
    }
  }

  if (!topicTitle) {
    return NextResponse.json({ error: 'Topic or custom topic required' }, { status: 400 })
  }

  // Generate guide via Gemini
  const guide = await generateGuide(topicTitle, topicScripture ?? undefined)

  // Upload to Google Drive if access token available
  let driveFileId = null
  let driveUrl = null
  if (accessToken) {
    const drive = await uploadGuideToDrive(guide, accessToken)
    if (drive) {
      driveFileId = drive.fileId
      driveUrl = drive.url
    }
  }

  // Save to DB
  const [saved] = await db`
    INSERT INTO logos_guides (topic_id, custom_topic, title, scripture, reflection, prayer, application, drive_file_id, drive_url, status, scheduled_for)
    VALUES (
      ${resolvedTopicId},
      ${customTopic ?? null},
      ${guide.title},
      ${guide.scripture},
      ${guide.reflection},
      ${guide.prayer},
      ${guide.application},
      ${driveFileId},
      ${driveUrl},
      'published',
      ${scheduledFor ?? null}
    )
    RETURNING *`

  // Log heartbeat
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${`## Logos — Guide Generated 📖\n**Title:** ${guide.title}\n**Scripture:** ${guide.scripture}\n**Drive:** ${driveUrl ? '[View →](' + driveUrl + ')' : 'Not uploaded'}`},
      ARRAY['logos', 'devotional', 'guide']
    FROM agents WHERE name = 'Logos' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Logos'`

  return NextResponse.json({ guide: saved, driveUrl })
}
