import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditWebsite, generateOutreach } from '@/lib/scout'

export async function POST(req: NextRequest) {
  const { id, website } = await req.json()
  if (!id || !website) return NextResponse.json({ error: 'id and website required' }, { status: 400 })

  const [lead] = await db`SELECT * FROM scout_leads WHERE id = ${id}`
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const l = lead as unknown as {
    id: string; name: string; category: string; address: string
    has_website: boolean; website_score: number | null
    gmb_has_hours: boolean; gmb_has_photos: boolean
    gmb_has_description: boolean; grade: string; score: number
  }

  // Save website and mark has_website
  await db`
    UPDATE scout_leads SET
      website = ${website},
      has_website = true,
      updated_at = now()
    WHERE id = ${id}`

  // Run PageSpeed audit
  const audit = await auditWebsite(website)

  let newScore = l.score
  let newGrade = l.grade

  if (audit) {
    // Boost score if site is poor quality (more opportunity)
    if (audit.score < 50) newScore = Math.min(newScore + 20, 100)
    else if (audit.score < 70) newScore = Math.min(newScore + 10, 100)

    newGrade = newScore >= 70 ? 'A' : newScore >= 45 ? 'B' : 'C'

    await db`
      UPDATE scout_leads SET
        website_score  = ${audit.score},
        website_mobile = ${audit.mobile},
        score          = ${newScore},
        grade          = ${newGrade},
        updated_at     = now()
      WHERE id = ${id}`
  }

  // Regenerate outreach email with website context
  const updatedLead = {
    ...l,
    website,
    website_score: audit?.score ?? null,
    website_mobile: audit?.mobile ?? false,
    has_website: true,
    score: newScore,
    grade: newGrade,
  }

  let outreachEmail: string | null = null
  try {
    outreachEmail = await generateOutreach(updatedLead)
    await db`
      UPDATE scout_leads SET
        outreach_email  = ${outreachEmail},
        approval_status = 'pending',
        updated_at      = now()
      WHERE id = ${id}`
  } catch {
    // Non-fatal — audit still succeeded
  }

  const [fresh] = await db`SELECT * FROM scout_leads WHERE id = ${id}`

  return NextResponse.json({
    lead: fresh,
    audit: audit ?? null,
    outreachRegenerated: !!outreachEmail,
  })
}
