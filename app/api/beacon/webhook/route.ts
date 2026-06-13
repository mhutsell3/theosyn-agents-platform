import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendGHLEmail, generateWelcomeEmail, createGHLContact } from '@/lib/beacon'

// Map incoming values to our purchase levels
function resolvePurchaseLevel(raw?: string): 'Community' | 'Free' | 'Core' | 'Premium' {
  if (!raw) return 'Community'
  const val = raw.toLowerCase()
  if (val.includes('premium')) return 'Premium'
  if (val.includes('core') || val.includes('live')) return 'Core'
  if (val.includes('free')) return 'Free'
  if (val.includes('community')) return 'Community'
  return 'Community'
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-beacon-secret') ?? req.nextUrl.searchParams.get('secret')
  const expected = process.env.BEACON_SECRET ?? process.env.BEACON_WEBHOOK_SECRET

  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // GHL sends various field names — normalize them. Use null (never undefined) for DB safety.
  const name  = (body.full_name ?? body.name ?? `${body.first_name ?? ''} ${body.last_name ?? ''}`.trim()) || null
  const email = body.email || null
  const phone = body.phone || body.phone_number || null  // null if missing
  const rawContactId = body.contact_id || body.id || null
  const ghlContactId = rawContactId && rawContactId.trim() !== '' ? rawContactId.trim() : null
  const purchaseLevel = resolvePurchaseLevel(body.purchase_level ?? body.level ?? body.plan ?? body.tag ?? '')

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
  }

  try {
  // Upsert — if they already exist (e.g. duplicate webhook), update rather than error
  const existing = await db`SELECT id, ghl_contact_id FROM students WHERE email = ${email}`

  let studentId: string
  let resolvedGhlId = ghlContactId || null

  if ((existing as unknown[]).length > 0) {
    const [row] = existing as unknown as { id: string; ghl_contact_id: string | null }[]
    studentId = row.id
    resolvedGhlId = resolvedGhlId ?? row.ghl_contact_id
    await db`
      UPDATE students SET
        name            = ${name},
        phone           = COALESCE(${phone}, phone),
        purchase_level  = ${purchaseLevel},
        ghl_contact_id  = COALESCE(${resolvedGhlId}, ghl_contact_id),
        updated_at      = now()
      WHERE id = ${studentId}`
  } else {
    const [row] = await db`
      INSERT INTO students (name, email, phone, purchase_level, ghl_contact_id)
      VALUES (${name}, ${email}, ${phone}, ${purchaseLevel}, ${resolvedGhlId})
      RETURNING id` as unknown as { id: string }[]
    studentId = row.id
  }

  // If no GHL contact ID came in, create one now
  if (!resolvedGhlId) {
    resolvedGhlId = await createGHLContact({ name, email, phone, purchase_level: purchaseLevel })
    if (resolvedGhlId) {
      await db`UPDATE students SET ghl_contact_id = ${resolvedGhlId} WHERE id = ${studentId}`
    }
  }

  // Send welcome email via GHL — wrapped in try/catch so Ollama timeout doesn't kill the response
  let welcomeSent = false
  if (resolvedGhlId) {
    try {
      const { subject, body: emailBody } = await generateWelcomeEmail({ name, purchase_level: purchaseLevel })
      const htmlBody = emailBody.split('\n\n').map((p: string) => `<p>${p}</p>`).join('')
      welcomeSent = await sendGHLEmail({ contactId: resolvedGhlId, email, subject, body: htmlBody })
      if (welcomeSent) {
        await db`UPDATE students SET welcome_sent = true WHERE id = ${studentId}`
      }
    } catch (err) {
      console.error('[Beacon] Welcome email failed (non-fatal):', err)
    }
  }

  // Log to activity feed — non-fatal
  try {
    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      SELECT id,
        ${`## Beacon — Student via Webhook 🎓\n**Name:** ${name}\n**Email:** ${email}\n**Level:** ${purchaseLevel}\n**Welcome email:** ${welcomeSent ? 'Sent ✓' : 'Skipped (no GHL contact ID)'}`},
        ARRAY['beacon', 'student', 'webhook']
      FROM agents WHERE name = 'Beacon' LIMIT 1`
    await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Beacon'`
  } catch (err) {
    console.error('[Beacon] Heartbeat log failed (non-fatal):', err)
  }

  return NextResponse.json({ ok: true, studentId, ghlContactId: resolvedGhlId, welcomeSent })
  } catch (err) {
    console.error('[Beacon] Webhook error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
