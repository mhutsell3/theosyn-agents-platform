import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { searchYouTube, getYouTubeTranscript, summarizeResearch } from '@/lib/scribe'

export async function GET(req: NextRequest) {
  const topicId = req.nextUrl.searchParams.get('topicId')
  const research = topicId
    ? await db`SELECT * FROM scribe_research WHERE topic_id = ${topicId} ORDER BY created_at DESC`
    : await db`SELECT * FROM scribe_research ORDER BY created_at DESC LIMIT 50`
  return NextResponse.json({ research })
}

export async function POST(req: NextRequest) {
  const { topicId, query, sourceType, sourceUrl, manualContent, title } = await req.json()

  // Get topic for context
  const [topic] = topicId
    ? await db`SELECT * FROM scribe_topics WHERE id = ${topicId}`
    : [null]
  const topicTitle = (topic as unknown as { title: string } | null)?.title ?? query

  if (sourceType === 'youtube') {
    // Search YouTube
    const videos = await searchYouTube(query ?? topicTitle, 5)
    const saved = []

    for (const video of videos.slice(0, 3)) {
      // Try to get transcript
      const transcript = await getYouTubeTranscript(video.videoId)
      const summary = transcript
        ? await summarizeResearch(transcript, topicTitle)
        : await summarizeResearch(video.description, topicTitle)

      const [item] = await db`
        INSERT INTO scribe_research (topic_id, source_type, source_url, youtube_video_id, title, summary, raw_content, tags)
        VALUES (
          ${topicId ?? null},
          'youtube',
          ${`https://youtube.com/watch?v=${video.videoId}`},
          ${video.videoId},
          ${video.title},
          ${summary},
          ${transcript ?? video.description},
          ${[topicTitle, video.channelTitle]}
        )
        RETURNING id, title, source_url, youtube_video_id, summary, created_at`
      saved.push(item)
    }

    return NextResponse.json({ saved, total: saved.length })
  }

  if (sourceType === 'web' && sourceUrl) {
    // Fetch and summarize web page
    let content = manualContent ?? ''
    if (!content && sourceUrl) {
      try {
        const res = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) })
        const html = await res.text()
        content = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000)
      } catch {
        content = ''
      }
    }

    const summary = content ? await summarizeResearch(content, topicTitle) : 'Could not fetch content'

    const [item] = await db`
      INSERT INTO scribe_research (topic_id, source_type, source_url, title, summary, raw_content, tags)
      VALUES (${topicId ?? null}, 'web', ${sourceUrl}, ${title ?? sourceUrl}, ${summary}, ${content}, ${[topicTitle]})
      RETURNING *`

    return NextResponse.json({ item })
  }

  if (sourceType === 'manual' && manualContent) {
    const summary = await summarizeResearch(manualContent, topicTitle)
    const [item] = await db`
      INSERT INTO scribe_research (topic_id, source_type, title, summary, raw_content, tags)
      VALUES (${topicId ?? null}, 'manual', ${title ?? 'Manual Note'}, ${summary}, ${manualContent}, ${[topicTitle]})
      RETURNING *`
    return NextResponse.json({ item })
  }

  return NextResponse.json({ error: 'Invalid research request' }, { status: 400 })
}
