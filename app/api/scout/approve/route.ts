import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/auth'
import { sendViaGmail, submitContactForm, sendFacebookDM, bestOutreachChannel } from '@/lib/scout'

// GET — fetch all pending approval leads
export async function GET() {
  const leads = await db`
    SELECT * FROM scout_leads
    WHERE approval_status = 'pending'
    ORDER BY score DESC, scraped_at DESC`
  return NextResponse.json(leads)
}

// POST — approve and send, or dismiss
export async function POST(req: NextRequest) {
  const session = await auth()
  const accessToken = (session as { accessToken?: string })?.accessToken

  const { id, action, editedEmail } = await req.json()
  // action: 'approve' | 'dismiss'
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  const [lead] = await db`SELECT * FROM scout_leads WHERE id = ${id}`
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  if (action === 'dismiss') {
    await db`UPDATE scout_leads SET approval_status = 'dismissed', updated_at = now() WHERE id = ${id}`
    return NextResponse.json({ ok: true, action: 'dismissed' })
  }

  if (action === 'approve') {
    const l = lead as {
      id: string; name: string; outreach_email: string | null
      contact_email: string | null; website: string | null
      social_facebook: string | null; phone: string | null
      category: string
    }

    const emailBody = editedEmail ?? l.outreach_email
    if (!emailBody) return NextResponse.json({ error: 'No outreach email to send' }, { status: 400 })

    // Save any edits
    if (editedEmail) {
      await db`UPDATE scout_leads SET outreach_email = ${editedEmail} WHERE id = ${id}`
    }

    const channel = bestOutreachChannel(l)
    const subject = `Quick question about ${l.name}'s online presence`
    const fromName = 'Milford Hutsell'
    const fromEmail = process.env.SCOUT_REPLY_EMAIL ?? process.env.ALLOWED_EMAIL ?? 'milford.hutsell@gmail.com'

    let success = false
    let error: string | undefined
    let usedChannel = channel

    if (channel === 'email' && l.contact_email && accessToken) {
      const result = await sendViaGmail({ accessToken, to: l.contact_email, subject, body: emailBody, fromName })
      success = result.success
      error = result.error

    } else if (channel === 'contact_form' && l.website) {
      success = await submitContactForm(l.website, { name: l.name, outreach: emailBody, fromEmail, fromName })
      if (!success) error = 'Contact form not found or submission failed'

    } else if (channel === 'facebook' && l.social_facebook) {
      const [account] = await db`SELECT access_token, page_id FROM social_accounts WHERE platform = 'Facebook' AND active = true LIMIT 1`
      if (!account) return NextResponse.json({ error: 'No Facebook account connected' }, { status: 400 })
      const result = await sendFacebookDM({
        pageUrl: l.social_facebook,
        message: emailBody,
        accessToken: (account as { access_token: string }).access_token,
        ourPageId: (account as { page_id: string }).page_id,
      })
      success = result.success
      error = result.error
    } else {
      return NextResponse.json({ error: `No send channel available for this lead` }, { status: 400 })
    }

    if (success) {
      await db`
        UPDATE scout_leads
        SET approval_status = 'approved', outreach_status = 'contacted', updated_at = now()
        WHERE id = ${id}`

      await db`
        INSERT INTO heartbeats (agent_id, content, tags)
        SELECT id,
          ${'## Scout — Outreach Sent ✓\n**Lead:** ' + l.name + '\n**Channel:** ' + usedChannel + '\n**Subject:** ' + subject},
          ARRAY['scout', 'outreach', 'sent']
        FROM agents WHERE name = 'Scout' LIMIT 1`

      await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`
    } else {
      await db`UPDATE scout_leads SET approval_status = 'pending', updated_at = now() WHERE id = ${id}`
    }

    return NextResponse.json({ success, channel: usedChannel, error })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
