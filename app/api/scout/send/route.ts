import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/auth'
import { sendViaGmail, submitContactForm, sendFacebookDM, bestOutreachChannel } from '@/lib/scout'

export async function POST(req: NextRequest) {
  const session = await auth()
  const accessToken = (session as { accessToken?: string })?.accessToken

  const { id, channel: requestedChannel } = await req.json()
  if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })

  const [lead] = await db`SELECT * FROM scout_leads WHERE id = ${id}`
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const l = lead as {
    id: string
    name: string
    outreach_email: string | null
    contact_email: string | null
    website: string | null
    social_facebook: string | null
    phone: string | null
    category: string
  }

  if (!l.outreach_email) {
    return NextResponse.json({ error: 'Generate an outreach email first' }, { status: 400 })
  }

  const channel = requestedChannel ?? bestOutreachChannel(l)
  const fromName = 'Milford Hutsell'
  const fromEmail = process.env.SCOUT_REPLY_EMAIL ?? process.env.ALLOWED_EMAIL ?? 'milford.hutsell@gmail.com'
  const subject = `Quick question about ${l.name}'s online presence`

  let success = false
  let error: string | undefined
  let usedChannel = channel

  if (channel === 'email' && l.contact_email && accessToken) {
    const result = await sendViaGmail({
      accessToken,
      to: l.contact_email,
      subject,
      body: l.outreach_email,
      fromName,
    })
    success = result.success
    error = result.error

  } else if (channel === 'contact_form' && l.website) {
    success = await submitContactForm(l.website, {
      name: l.name,
      outreach: l.outreach_email,
      fromEmail,
      fromName,
    })
    if (!success) error = `No contact form found on ${l.website} — try visiting their site directly`

  } else if (channel === 'facebook' && l.social_facebook) {
    // Get our page access token from social_accounts
    const [account] = await db`
      SELECT access_token, page_id FROM social_accounts
      WHERE platform = 'Facebook' AND active = true
      LIMIT 1`

    if (!account) {
      return NextResponse.json({ error: 'No Facebook account connected' }, { status: 400 })
    }

    const result = await sendFacebookDM({
      pageUrl: l.social_facebook,
      message: l.outreach_email,
      accessToken: (account as { access_token: string }).access_token,
      ourPageId: (account as { page_id: string }).page_id,
    })
    success = result.success
    error = result.error

  } else {
    return NextResponse.json({
      error: `Cannot send via ${channel} — missing ${channel === 'email' ? 'email address' : channel === 'facebook' ? 'Facebook page URL' : 'website'}`,
    }, { status: 400 })
  }

  if (success) {
    // Mark as contacted
    await db`
      UPDATE scout_leads
      SET outreach_status = 'contacted',
          outreach_sent_at = now(),
          updated_at = now()
      WHERE id = ${id}`

    // Log to activity feed
    await db`
      INSERT INTO heartbeats (agent_id, content, tags)
      SELECT id,
        ${'## Scout — Outreach Sent\n**Lead:** ' + l.name + '\n**Channel:** ' + usedChannel + '\n**Subject:** ' + subject},
        ARRAY['scout', 'outreach', 'contacted']
      FROM agents WHERE name = 'Scout' LIMIT 1`

    await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Scout'`
  }

  return NextResponse.json({ success, channel: usedChannel, error })
}
