import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const flags = await db`
    SELECT pf.*, sa.page_name, sa.platform, cp.title as post_title
    FROM pulse_flags pf
    JOIN social_accounts sa ON sa.id = pf.social_account_id
    LEFT JOIN social_posts sp ON sp.id = pf.social_post_id
    LEFT JOIN content_posts cp ON cp.id = sp.content_post_id
    WHERE pf.resolved = false
    ORDER BY pf.created_at DESC`
  return NextResponse.json({ flags })
}

export async function PATCH(req: NextRequest) {
  const { flagId } = await req.json()
  await db`UPDATE pulse_flags SET resolved = true WHERE id = ${flagId}`
  return NextResponse.json({ ok: true })
}
