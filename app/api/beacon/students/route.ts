import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createGHLContact, generateWelcomeEmail, sendGHLEmail } from '@/lib/beacon'

// GET — list all students
export async function GET() {
  const students = await db`
    SELECT * FROM students
    ORDER BY enrolled_at DESC`
  return NextResponse.json({ students })
}

// POST — enroll a new student
export async function POST(req: NextRequest) {
  const { name, email, phone, purchase_level, notes } = await req.json()

  if (!name || !email || !purchase_level) {
    return NextResponse.json({ error: 'name, email, and purchase_level are required' }, { status: 400 })
  }

  // Check for duplicate
  const existing = await db`SELECT id FROM students WHERE email = ${email}`
  if ((existing as unknown[]).length > 0) {
    return NextResponse.json({ error: 'A student with this email already exists' }, { status: 409 })
  }

  // Insert student
  const [student] = await db`
    INSERT INTO students (name, email, phone, purchase_level, notes)
    VALUES (${name}, ${email}, ${phone ?? null}, ${purchase_level}, ${notes ?? null})
    RETURNING *`

  const s = student as unknown as { id: string; name: string; email: string; phone: string | null; purchase_level: string; notes: string | null }

  // Create GHL contact
  const ghlContactId = await createGHLContact({ name: s.name, email: s.email, phone: s.phone, purchase_level: s.purchase_level })
  if (ghlContactId) {
    await db`UPDATE students SET ghl_contact_id = ${ghlContactId} WHERE id = ${s.id}`
  }

  // Generate & send welcome email
  let welcomeSent = false
  if (ghlContactId) {
    const { subject, body } = await generateWelcomeEmail({ name: s.name, purchase_level: s.purchase_level })
    const htmlBody = body.split('\n\n').map((p: string) => `<p>${p}</p>`).join('')
    welcomeSent = await sendGHLEmail({ contactId: ghlContactId, email: s.email, subject, body: htmlBody })
    if (welcomeSent) {
      await db`UPDATE students SET welcome_sent = true WHERE id = ${s.id}`
    }
  }

  // Log to activity feed
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${`## Beacon — New Student Enrolled 🎓\n**Name:** ${s.name}\n**Email:** ${s.email}\n**Level:** ${s.purchase_level}\n**GHL:** ${ghlContactId ? 'Contact created ✓' : 'GHL sync failed ✗'}\n**Welcome email:** ${welcomeSent ? 'Sent ✓' : 'Not sent'}`},
      ARRAY['beacon', 'student', 'enrolled']
    FROM agents WHERE name = 'Beacon' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Beacon'`

  return NextResponse.json({ student: { ...s, ghl_contact_id: ghlContactId, welcome_sent: welcomeSent }, ghlContactId, welcomeSent })
}
