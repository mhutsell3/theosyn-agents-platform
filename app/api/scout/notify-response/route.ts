import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { leadId, leadName, senderEmail, subject } = await req.json()

  // Write to activity feed so Piper sees it
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${`## Scout — Lead Responded! 🎉\n**Lead:** ${leadName}\n**Email:** ${senderEmail}\n**Subject:** ${subject}\n\nThis lead has replied to your outreach. Time to move them to the next stage — consider sending to Piper for follow-up.`},
      ARRAY['scout', 'responded', 'lead', 'piper']
    FROM agents WHERE name = 'Scout' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`

  return NextResponse.json({ ok: true })
}
