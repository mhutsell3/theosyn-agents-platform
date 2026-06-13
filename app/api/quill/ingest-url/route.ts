import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Strip HTML tags and collapse whitespace
function extractText(html: string): string {
  return html
    // Remove scripts, styles, nav, footer, header, aside
    .replace(/<(script|style|nav|footer|header|aside|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

// Try to extract a title from HTML
function extractTitle(html: string): string {
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
  if (ogTitle) return ogTitle
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  if (titleTag) return titleTag.replace(/\s*[-|].*$/, '').trim() // strip site name suffix
  return 'Blog Article'
}

export async function POST(req: NextRequest) {
  let body: { url?: string } = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url } = body
  if (!url?.startsWith('http')) {
    return NextResponse.json({ error: 'Valid URL required' }, { status: 400 })
  }

  // Check not already ingested
  const existing = await db`
    SELECT id FROM brand_voice_samples WHERE source = 'blog' AND source_id = ${url}
  ` as unknown as unknown[]
  if (existing.length) {
    return NextResponse.json({ ok: true, skipped: true, message: 'Already ingested' })
  }

  // Fetch the page
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QuillBot/1.0; +https://theosynlabs.com)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 400 })
    html = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch URL: ${String(err)}` }, { status: 400 })
  }

  const title = extractTitle(html)
  const content = extractText(html)

  if (content.length < 100) {
    return NextResponse.json({ error: 'Page content too short or could not be extracted' }, { status: 400 })
  }

  // Trim to 8000 chars — enough for voice analysis without bloating the DB
  const trimmed = content.slice(0, 8000)

  await db`
    INSERT INTO brand_voice_samples (source, source_id, content, subject)
    VALUES ('blog', ${url}, ${trimmed}, ${title})
    ON CONFLICT DO NOTHING`

  return NextResponse.json({ ok: true, title, chars: trimmed.length })
}
