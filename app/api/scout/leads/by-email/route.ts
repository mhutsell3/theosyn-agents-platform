import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({}, { status: 400 })

  const [lead] = await db`
    SELECT id, name, outreach_status, contact_email, grade, category
    FROM scout_leads
    WHERE LOWER(contact_email) = LOWER(${email})
      AND outreach_status = 'contacted'
    LIMIT 1`

  if (!lead) return NextResponse.json({})
  return NextResponse.json(lead)
}
