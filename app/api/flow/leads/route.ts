import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const leads = await db`
    SELECT id, name, email, company, grade, approval_status, ghl_contact_id
    FROM scout_leads
    WHERE approval_status = 'approved'
    ORDER BY score DESC, scraped_at DESC
    LIMIT 200
  ` as unknown as {
    id: string; name: string; email: string; company: string | null
    grade: string; approval_status: string; ghl_contact_id: string | null
  }[]
  return NextResponse.json({ leads })
}
