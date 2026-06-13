import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logTokenUsage } from '@/lib/usage'

async function ollamaChat(prompt: string): Promise<string> {
  const model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Piper', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

// Called by n8n when a Scout lead replies to our outreach
export async function POST(req: NextRequest) {
  const { leadId, leadName, senderEmail, subject, body } = await req.json()

  if (!leadId || !senderEmail) {
    return NextResponse.json({ error: 'leadId and senderEmail required' }, { status: 400 })
  }

  // Get lead details + original outreach for context
  const [lead] = await db`SELECT * FROM scout_leads WHERE id = ${leadId}`
  const l = lead as unknown as {
    id: string; name: string; category: string; outreach_email: string | null
    website: string | null; address: string | null
  } | null

  // Log the received reply to contact log
  await db`
    INSERT INTO contact_log (lead_id, entry_type, content, created_by)
    VALUES (
      ${leadId},
      'email_received',
      ${'Reply received from ' + senderEmail + '\nSubject: ' + (subject ?? '') + '\n\n' + (body ?? '')},
      'piper'
    )`

  // Draft nurture response
  const prompt = `You are Piper, the Client Relations agent for TheoSYN Labs.
TheoSYN Labs helps small businesses and churches use AI ethically, from a Christian perspective.
Tone: warm, professional, faith-informed. Not pushy or salesy.

A lead has replied to our outreach email. Draft a warm nurturing response.

Lead: ${l?.name ?? leadName ?? 'this business'}
Category: ${l?.category ?? 'business'}
Location: ${l?.address ?? 'Indiana'}
Our original outreach: ${l?.outreach_email ? l.outreach_email.slice(0, 300) : 'initial prospecting email'}

Their reply:
"${body ?? '(no body captured)'}"

Subject: ${subject ?? '(reply)'}

Write a warm, genuine reply that:
- Acknowledges what they said specifically
- Moves the conversation forward naturally
- Offers a clear next step (discovery call, more info, etc.)
- Is brief (2-3 paragraphs)
- Signs off as "Milford at TheoSYN Labs"

Write only the email body.`

  const replyDraft = await ollamaChat(prompt)

  // Save to lead inbox
  const [inboxItem] = await db`
    INSERT INTO piper_lead_inbox (lead_id, lead_name, sender_email, subject, body, reply_draft)
    VALUES (
      ${leadId},
      ${l?.name ?? leadName ?? senderEmail},
      ${senderEmail},
      ${subject ?? null},
      ${body ?? null},
      ${replyDraft}
    )
    RETURNING *`

  // Create approval for the reply
  await db`
    INSERT INTO piper_approvals (lead_id, approval_type, to_email, to_name, subject, body)
    VALUES (
      ${leadId},
      'nurture',
      ${senderEmail},
      ${l?.name ?? leadName ?? senderEmail},
      ${'Re: ' + (subject ?? 'Your inquiry')},
      ${replyDraft}
    )`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Piper'`

  return NextResponse.json({ ok: true, inboxItem })
}
