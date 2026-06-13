import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const grade = searchParams.get('grade')
  const status = searchParams.get('status') ?? 'new'
  const category = searchParams.get('category')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const leads = await db`
    SELECT * FROM scout_leads
    WHERE outreach_status = ${status}
    ${grade ? db`AND grade = ${grade}` : db``}
    ${category ? db`AND category = ${category}` : db``}
    ORDER BY score DESC, scraped_at DESC
    LIMIT ${limit}`

  return NextResponse.json(leads)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Build update dynamically based on what was provided
  let updated

  if (body.contact_email !== undefined) {
    ;[updated] = await db`
      UPDATE scout_leads
      SET contact_email = ${body.contact_email}, email_source = 'manual', updated_at = now()
      WHERE id = ${id} RETURNING *`
  } else if (body.website !== undefined) {
    ;[updated] = await db`
      UPDATE scout_leads
      SET website = ${body.website}, has_website = ${!!body.website}, updated_at = now()
      WHERE id = ${id} RETURNING *`
  } else if (body.outreach_status !== undefined) {
    ;[updated] = await db`
      UPDATE scout_leads
      SET outreach_status = ${body.outreach_status}, updated_at = now()
      WHERE id = ${id} RETURNING *`
  } else if (body.notes !== undefined) {
    ;[updated] = await db`
      UPDATE scout_leads
      SET notes = ${body.notes}, updated_at = now()
      WHERE id = ${id} RETURNING *`
  } else {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  return NextResponse.json(updated)
}
