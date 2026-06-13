import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { searchAdzunaJobs, enrichWithPlaces, generateJobOutreach } from '@/lib/linkedin'
import { findContactEmail } from '@/lib/scout'

export async function POST(req: NextRequest) {
  const { role, generateOutreach = true } = await req.json()
  if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 })

  const jobs = await searchAdzunaJobs(role)
  let saved = 0
  let skipped = 0
  const results = []

  for (const job of jobs) {
    if (!job.companyName) { skipped++; continue }

    try {
      const places = await enrichWithPlaces(job.companyName, job.location)

      let contactEmail: string | null = null
      let emailSource: string | null = null
      if (places.website) {
        const emailResult = await findContactEmail(places.website)
        if (emailResult) {
          contactEmail = emailResult.email
          emailSource = emailResult.source
        }
      }

      let outreachEmail: string | null = null
      let approvalStatus = 'none'
      if (generateOutreach) {
        try {
          outreachEmail = await generateJobOutreach({
            companyName: job.companyName,
            jobTitle: job.title,
            address: places.address,
            contactEmail,
          })
          approvalStatus = 'pending'
        } catch { /* skip outreach if Ollama fails */ }
      }

      const score = 75 + (places.hasGmb ? 0 : 10) + (!places.website ? 10 : 0)
      const grade = score >= 70 ? 'A' : 'B'
      const placeId = `linkedin_${job.jobId}`

      await db`
        INSERT INTO scout_leads (
          place_id, name, address, phone, website, category,
          has_website, has_gmb, grade, score, contact_email, email_source,
          outreach_email, approval_status, notes
        ) VALUES (
          ${placeId},
          ${job.companyName},
          ${places.address},
          ${places.phone},
          ${places.website ?? null},
          ${'hiring_' + role.replace(/\s+/g, '_')},
          ${!!places.website},
          ${places.hasGmb},
          ${grade},
          ${score},
          ${contactEmail},
          ${emailSource},
          ${outreachEmail},
          ${approvalStatus},
          ${'Hiring: ' + job.title + '\nJob URL: ' + job.jobUrl}
        )
        ON CONFLICT (place_id) DO UPDATE SET
          notes = EXCLUDED.notes,
          updated_at = now()`

      saved++
      results.push({ company: job.companyName, role: job.title, grade, hasEmail: !!contactEmail, hasPhone: !!places.phone })
    } catch {
      skipped++
    }
  }

  // Write heartbeat — non-fatal
  try {
    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      SELECT id,
        ${'## Scout — LinkedIn Jobs Search\n**Role:** ' + role + '\n**Jobs found:** ' + jobs.length + '\n**Leads saved:** ' + saved + '\n**Grade A:** ' + results.filter(r => r.grade === 'A').length + '\n\n' + results.slice(0, 5).map(r => `- ${r.company} — hiring ${r.role} ${r.hasEmail ? '✉️' : ''} ${r.hasPhone ? '📞' : ''}`).join('\n')},
        ARRAY['scout', 'linkedin', 'jobs', 'prospecting']
      FROM agents WHERE name = 'Scout' LIMIT 1`
    await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`
  } catch { /* non-fatal */ }

  return NextResponse.json({ jobs: results, saved, skipped })
}
