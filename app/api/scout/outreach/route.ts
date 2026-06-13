import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateOutreach } from '@/lib/scout'
import { getVoiceProfile } from '@/lib/quill'

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })

  const [lead] = await db`SELECT * FROM scout_leads WHERE id = ${id}`
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const voiceProfile = await getVoiceProfile().catch(() => '')
  const email = await generateOutreach(lead as {
    name: string
    category: string
    address: string
    has_website: boolean
    website_score: number | null
    gmb_has_hours: boolean
    gmb_has_photos: boolean
    gmb_has_description: boolean
    grade: string
  }, voiceProfile)

  await db`
    UPDATE scout_leads
    SET outreach_email = ${email}, updated_at = now()
    WHERE id = ${id}`

  return NextResponse.json({ email })
}
