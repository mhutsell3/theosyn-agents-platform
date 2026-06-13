import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { sendViaGmail } from '@/lib/scout'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const accessToken = (session as { accessToken?: string })?.accessToken

  if (!accessToken) {
    return NextResponse.json({ error: 'Gmail OAuth token not available — please sign out and back in' }, { status: 401 })
  }

  const [approval] = await db`SELECT * FROM piper_approvals WHERE id = ${id}`
  if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 })

  const a = approval as unknown as {
    id: string; to_email: string | null; to_name: string | null
    subject: string | null; body: string; approval_type: string
    client_id: string | null; lead_id: string | null
  }

  if (!a.to_email) return NextResponse.json({ error: 'No recipient email' }, { status: 400 })

  const result = await sendViaGmail({
    accessToken,
    to: a.to_email,
    subject: a.subject ?? 'Following up',
    body: a.body,
    fromName: 'Milford Hutsell',
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // Mark sent
  await db`
    UPDATE piper_approvals SET status = 'sent', sent_at = now() WHERE id = ${id}`

  // Log to contact log
  await db`
    INSERT INTO contact_log (client_id, lead_id, entry_type, content, created_by)
    VALUES (
      ${a.client_id ?? null},
      ${a.lead_id ?? null},
      'email_sent',
      ${'Email sent to ' + a.to_email + '\n\nSubject: ' + (a.subject ?? '') + '\n\n' + a.body},
      'piper'
    )`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Piper'`

  return NextResponse.json({ ok: true })
}
