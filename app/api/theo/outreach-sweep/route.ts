import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  bestOutreachChannel,
  generateOutreach,
  sendViaGmail,
  submitContactForm,
  deepEmailDiscovery,
} from '@/lib/scout'

/**
 * POST /api/theo/outreach-sweep
 *
 * Theo's autonomous lead orchestration sweep.
 * Runs through all pending leads and:
 *  - Sends outreach automatically if a contact method exists (email or contact form)
 *  - Marks as 'no_contact' if nothing found — these are the only ones Milford sees
 *  - Skips already contacted / dismissed leads
 */
export async function POST() {
  // Get Gmail access token from DB (stored via OAuth)
  const [tokenRow] = await db`
    SELECT access_token FROM social_accounts
    WHERE platform = 'Gmail' AND active = true
    LIMIT 1`
  const accessToken = (tokenRow as { access_token?: string } | undefined)?.access_token ?? null

  // Pull all pending leads that haven't been contacted yet
  const leads = await db`
    SELECT * FROM scout_leads
    WHERE outreach_status IS DISTINCT FROM 'contacted'
      AND approval_status NOT IN ('dismissed', 'no_contact', 'auto_sent')
      AND grade IN ('A', 'B')
    ORDER BY score DESC
    LIMIT 50`

  const results = {
    total: leads.length,
    sent: 0,
    no_contact: 0,
    errors: 0,
    skipped: 0,
  }

  for (const rawLead of leads as unknown as {
    id: string
    name: string
    address: string
    category: string
    website: string | null
    contact_email: string | null
    social_facebook: string | null
    phone: string | null
    outreach_email: string | null
    has_website: boolean
    website_score: number | null
    gmb_has_hours: boolean
    gmb_has_photos: boolean
    gmb_has_description: boolean
    grade: string
  }[]) {
    try {
      let contactEmail = rawLead.contact_email
      let emailSource: string | null = null

      // If no email yet — try deep discovery before giving up
      if (!contactEmail) {
        const deep = await deepEmailDiscovery(rawLead.name, rawLead.address, rawLead.website)
        if (deep) {
          contactEmail = deep.email
          emailSource = deep.source
          // Save discovered email back to the lead
          await db`
            UPDATE scout_leads
            SET contact_email = ${contactEmail}, email_source = ${emailSource}
            WHERE id = ${rawLead.id}`
        }
      }

      const lead = { ...rawLead, contact_email: contactEmail }
      const channel = bestOutreachChannel(lead)

      // No contact method at all — flag for Milford, skip
      if (channel === 'manual') {
        await db`
          UPDATE scout_leads
          SET approval_status = 'no_contact', updated_at = now()
          WHERE id = ${rawLead.id}`
        results.no_contact++
        continue
      }

      // Generate outreach if not already generated
      let outreachEmail = rawLead.outreach_email
      if (!outreachEmail) {
        outreachEmail = await generateOutreach(rawLead)
        await db`UPDATE scout_leads SET outreach_email = ${outreachEmail} WHERE id = ${rawLead.id}`
      }

      const fromName = 'Milford Hutsell'
      const fromEmail = process.env.SCOUT_REPLY_EMAIL ?? process.env.ALLOWED_EMAIL ?? 'milford.hutsell@gmail.com'
      const subject = `Quick question about ${rawLead.name}'s online presence`

      let success = false

      if (channel === 'email' && contactEmail && accessToken) {
        const result = await sendViaGmail({
          accessToken,
          to: contactEmail,
          subject,
          body: outreachEmail,
          fromName,
        })
        success = result.success

      } else if (channel === 'contact_form' && rawLead.website) {
        success = await submitContactForm(rawLead.website, {
          name: rawLead.name,
          outreach: outreachEmail,
          fromEmail,
          fromName,
        })
      }

      if (success) {
        await db`
          UPDATE scout_leads
          SET outreach_status = 'contacted',
              approval_status = 'auto_sent',
              outreach_sent_at = now(),
              updated_at = now()
          WHERE id = ${rawLead.id}`
        results.sent++
      } else {
        // Send failed — fall back to no_contact so Milford can follow up manually
        await db`
          UPDATE scout_leads
          SET approval_status = 'no_contact', updated_at = now()
          WHERE id = ${rawLead.id}`
        results.no_contact++
      }

    } catch (err) {
      console.error(`[Theo] Outreach sweep error for lead ${rawLead.id}:`, err)
      results.errors++
    }
  }

  // Log to heartbeat feed
  const summary = `## Theo — Autonomous Outreach Sweep\n` +
    `**Leads processed:** ${results.total}\n` +
    `**Outreach sent:** ${results.sent}\n` +
    `**No contact found (needs review):** ${results.no_contact}\n` +
    `**Errors:** ${results.errors}`

  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${summary}, ARRAY['theo', 'outreach', 'autonomous']
    FROM agents WHERE name = 'Theo' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Theo'`

  return NextResponse.json(results)
}
