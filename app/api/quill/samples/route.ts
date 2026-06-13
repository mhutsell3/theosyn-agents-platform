import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const samples = await db`
    SELECT id, source, account, subject, LEFT(content, 200) as preview, created_at
    FROM brand_voice_samples
    ORDER BY created_at DESC
    LIMIT 100`
  return NextResponse.json({ samples })
}

// POST — two modes:
//   1. n8n ingest (requires x-quill-token header): source = 'gmail'|'outlook'|'imap', account = email address
//   2. Manual add from dashboard (no token needed): source = 'manual'
export async function POST(req: NextRequest) {
  let body: { content?: string; subject?: string; source?: string; account?: string; source_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { content, subject, source, account, source_id } = body
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  // n8n ingest path — requires secret token
  const isIngest = source && source !== 'manual'
  if (isIngest) {
    const token = req.headers.get('x-quill-token')
    if (!token || token !== process.env.QUILL_INGEST_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const resolvedSource = source ?? 'manual'
  const resolvedSubject = subject ?? (resolvedSource === 'manual' ? 'Manual Sample' : 'Email')

  await db`
    INSERT INTO brand_voice_samples (source, source_id, account, content, subject)
    VALUES (
      ${resolvedSource},
      ${source_id ?? null},
      ${account ?? null},
      ${content},
      ${resolvedSubject}
    )
    ON CONFLICT DO NOTHING`

  return NextResponse.json({ ok: true })
}
