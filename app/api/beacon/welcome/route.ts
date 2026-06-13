import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateWelcomeEmail, sendGHLEmail } from '@/lib/beacon'

// POST — resend welcome email to a student
export async function POST(req: NextRequest) {
  const { studentId } = await req.json()
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

  const [student] = await db`SELECT * FROM students WHERE id = ${studentId}`
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const s = student as unknown as { id: string; name: string; email: string; purchase_level: string; ghl_contact_id: string | null }

  if (!s.ghl_contact_id) {
    return NextResponse.json({ error: 'No GHL contact ID — student was not synced to GHL' }, { status: 400 })
  }

  const { subject, body } = await generateWelcomeEmail({ name: s.name, purchase_level: s.purchase_level })
  const htmlBody = body.split('\n\n').map((p: string) => `<p>${p}</p>`).join('')
  const sent = await sendGHLEmail({ contactId: s.ghl_contact_id, email: s.email, subject, body: htmlBody })

  if (sent) {
    await db`UPDATE students SET welcome_sent = true WHERE id = ${s.id}`
  }

  return NextResponse.json({ sent, subject, body })
}
