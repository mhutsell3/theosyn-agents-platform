import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pushLeadToFunnel } from '@/lib/flow'

export async function POST(req: Request) {
  try {
    const { leadId, pipelineId, stageId, tags } = await req.json()
    if (!leadId || !pipelineId || !stageId) {
      return NextResponse.json({ error: 'leadId, pipelineId, stageId required' }, { status: 400 })
    }

    const leads = await db`SELECT * FROM scout_leads WHERE id = ${leadId} LIMIT 1` as unknown as {
      id: string; name: string; email: string; phone: string | null
      company: string | null; website: string | null; grade: string
    }[]

    if (!leads.length) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const lead = leads[0]
    const result = await pushLeadToFunnel({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      website: lead.website,
      pipelineId,
      stageId,
      tags: tags ?? [`grade-${lead.grade.toLowerCase()}`],
    })

    if (result.contactId) {
      await db`
        UPDATE scout_leads
        SET ghl_contact_id = ${result.contactId}, updated_at = now()
        WHERE id = ${leadId}
      `
    }

    return NextResponse.json({ ok: !!result.contactId, ...result })
  } catch (err) {
    console.error('[Flow] push-lead error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
