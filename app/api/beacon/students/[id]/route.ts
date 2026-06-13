import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { updateGHLContact } from '@/lib/beacon'

// PATCH — update a student (level, status, notes, phone)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const updates = await req.json()

  const [existing] = await db`SELECT * FROM students WHERE id = ${id}`
  if (!existing) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const s = existing as unknown as { ghl_contact_id: string | null; purchase_level: string }

  const { name, email, phone, purchase_level, status, notes } = updates

  await db`
    UPDATE students SET
      name          = COALESCE(${name ?? null}, name),
      email         = COALESCE(${email ?? null}, email),
      phone         = COALESCE(${phone ?? null}, phone),
      purchase_level = COALESCE(${purchase_level ?? null}, purchase_level),
      status        = COALESCE(${status ?? null}, status),
      notes         = COALESCE(${notes ?? null}, notes)
    WHERE id = ${id}`

  // Sync tag change to GHL if level changed
  if (purchase_level && purchase_level !== s.purchase_level && s.ghl_contact_id) {
    await updateGHLContact(s.ghl_contact_id, {
      tags: [`beacon-${purchase_level.toLowerCase()}`, 'student'],
    })
  }

  const [updated] = await db`SELECT * FROM students WHERE id = ${id}`
  return NextResponse.json({ student: updated })
}

// DELETE — deactivate (soft) or permanently delete based on ?hard=true
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hard = req.nextUrl.searchParams.get('hard') === 'true'

  if (hard) {
    await db`DELETE FROM students WHERE id = ${id}`
    return NextResponse.json({ ok: true, deleted: true })
  }

  await db`UPDATE students SET status = 'inactive' WHERE id = ${id}`
  return NextResponse.json({ ok: true, deleted: false })
}
