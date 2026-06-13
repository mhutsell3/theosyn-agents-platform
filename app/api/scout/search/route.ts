import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { searchPlaces, auditWebsite, findContactEmail, generateOutreach, deepEmailDiscovery, ScoutLead } from '@/lib/scout'
import { isChainBusiness } from '@/lib/scout-config'

export async function POST(req: NextRequest) {
  const { category, audit = false, center } = await req.json()
  if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 })

  let leads: ScoutLead[]
  try {
    leads = await searchPlaces(category, 20, center ?? undefined)
  } catch (err) {
    console.error('[Scout] searchPlaces failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
  let saved = 0
  let skipped = 0
  let dismissed = 0

  for (const lead of leads) {
    // Auto-dismiss major chains — not our target market
    if (isChainBusiness(lead.name)) {
      try {
        await db`
          INSERT INTO scout_leads (
            place_id, name, address, phone, website, category,
            rating, review_count, gmb_has_hours, gmb_has_photos,
            gmb_has_description, has_website, has_gmb,
            website_score, website_mobile, grade, score, lat, lng,
            approval_status
          ) VALUES (
            ${lead.place_id}, ${lead.name}, ${lead.address}, ${lead.phone},
            ${lead.website}, ${lead.category}, ${lead.rating}, ${lead.review_count},
            ${lead.gmb_has_hours}, ${lead.gmb_has_photos}, ${lead.gmb_has_description},
            ${lead.has_website}, ${lead.has_gmb}, ${lead.website_score},
            ${lead.website_mobile}, ${lead.grade}, ${lead.score}, ${lead.lat}, ${lead.lng},
            'dismissed'
          )
          ON CONFLICT (place_id) DO NOTHING`
        dismissed++
      } catch { /* already exists */ }
      continue
    }

    let contactEmail: string | null = null
    let emailSource: string | null = null

    // Audit website if requested and has one
    if (audit && lead.website) {
      const [auditResult, emailResult] = await Promise.all([
        auditWebsite(lead.website),
        findContactEmail(lead.website),
      ])

      if (auditResult) {
        lead.website_score = auditResult.score
        lead.website_mobile = auditResult.mobile
        if (auditResult.score < 50) lead.score = Math.min(lead.score + 20, 100)
        lead.grade = lead.score >= 70 ? 'A' : lead.score >= 45 ? 'B' : 'C'
      }

      if (emailResult) {
        contactEmail = emailResult.email
        emailSource = emailResult.source
      }
    }

    // Deep email discovery — try website patterns + Google search if no email found yet
    if (!contactEmail) {
      const deep = await deepEmailDiscovery(lead.name, lead.address, lead.website)
      if (deep) {
        contactEmail = deep.email
        emailSource = deep.source
      }
    }

    try {
      const result = await db`
        INSERT INTO scout_leads (
          place_id, name, address, phone, website, category,
          rating, review_count, gmb_has_hours, gmb_has_photos,
          gmb_has_description, has_website, has_gmb,
          website_score, website_mobile, grade, score, lat, lng,
          contact_email, email_source
        ) VALUES (
          ${lead.place_id}, ${lead.name}, ${lead.address}, ${lead.phone},
          ${lead.website}, ${lead.category}, ${lead.rating}, ${lead.review_count},
          ${lead.gmb_has_hours}, ${lead.gmb_has_photos}, ${lead.gmb_has_description},
          ${lead.has_website}, ${lead.has_gmb}, ${lead.website_score},
          ${lead.website_mobile}, ${lead.grade}, ${lead.score}, ${lead.lat}, ${lead.lng},
          ${contactEmail}, ${emailSource}
        )
        ON CONFLICT (place_id) DO UPDATE SET
          score = EXCLUDED.score,
          grade = EXCLUDED.grade,
          website_score = EXCLUDED.website_score,
          website_mobile = EXCLUDED.website_mobile,
          contact_email = COALESCE(EXCLUDED.contact_email, scout_leads.contact_email),
          email_source = COALESCE(EXCLUDED.email_source, scout_leads.email_source),
          updated_at = now()
        RETURNING id, (xmax = 0) as is_new`

      const isNew = (result[0] as unknown as { is_new: boolean }).is_new
      saved++

      // Generate outreach email for newly inserted leads that have an email address
      if (isNew && contactEmail) {
        try {
          const email = await generateOutreach(lead)
          await db`
            UPDATE scout_leads
            SET outreach_email = ${email}, approval_status = 'pending'
            WHERE place_id = ${lead.place_id}`
        } catch {
          // Non-fatal — lead saved, email just not generated
        }
      }
    } catch {
      skipped++
    }
  }

  // Write heartbeat
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id,
      ${'## Scout — Prospect Search\n**Category:** ' + category.replace(/_/g, ' ') + '\n**Found:** ' + leads.length + ' businesses\n**Saved:** ' + saved + ' leads\n**Auto-dismissed (chains):** ' + dismissed + '\n**Grade A:** ' + leads.filter(l => l.grade === 'A').length + ' high-opportunity leads'},
      ARRAY['scout', 'leads', 'prospecting']
    FROM agents WHERE name = 'Scout' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`

  return NextResponse.json({ leads, saved, skipped })
}
