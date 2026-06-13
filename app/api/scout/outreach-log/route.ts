import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')
  const sinceClause = since ? new Date(since) : new Date(Date.now() - 90 * 86400000) // default: last 90 days

  // Include leads where:
  // - Any sent_at timestamp is set (new tracking), OR
  // - outreach_status = 'contacted' (older leads sent before outreach_sent_at column existed)
  const rows = await db`
    SELECT
      id, name, address, category, grade,
      contact_email, email_source,
      outreach_email,
      outreach_sent_at,
      follow_up_email,
      follow_up_sent_at,
      follow_up_2_email,
      follow_up_2_sent_at,
      outreach_status,
      approval_status,
      updated_at
    FROM scout_leads
    WHERE (
      outreach_sent_at IS NOT NULL
      OR follow_up_sent_at IS NOT NULL
      OR follow_up_2_sent_at IS NOT NULL
      OR outreach_status IN ('contacted', 'responded', 'converted', 'dismissed')
    )
    AND GREATEST(
      COALESCE(outreach_sent_at, '1970-01-01'),
      COALESCE(follow_up_sent_at, '1970-01-01'),
      COALESCE(follow_up_2_sent_at, '1970-01-01'),
      COALESCE(updated_at, '1970-01-01')
    ) >= ${sinceClause.toISOString()}
    ORDER BY GREATEST(
      COALESCE(outreach_sent_at, '1970-01-01'),
      COALESCE(follow_up_sent_at, '1970-01-01'),
      COALESCE(follow_up_2_sent_at, '1970-01-01'),
      COALESCE(updated_at, '1970-01-01')
    ) DESC
    LIMIT 500`

  interface LeadRow {
    id: string
    name: string
    address: string
    category: string
    grade: string
    contact_email: string | null
    email_source: string | null
    outreach_email: string | null
    outreach_sent_at: string | null
    follow_up_email: string | null
    follow_up_sent_at: string | null
    follow_up_2_email: string | null
    follow_up_2_sent_at: string | null
    outreach_status: string
    approval_status: string | null
    updated_at: string | null
  }

  const events = []

  for (const r of rows as unknown as LeadRow[]) {
    // For older leads with no outreach_sent_at, use updated_at as the best estimate
    const initialSentAt = r.outreach_sent_at ?? (
      r.outreach_status !== 'new' && !r.follow_up_sent_at && !r.follow_up_2_sent_at
        ? r.updated_at
        : null
    )

    if (initialSentAt) {
      events.push({
        lead_id: r.id,
        name: r.name,
        address: r.address,
        category: r.category,
        grade: r.grade,
        contact_email: r.contact_email,
        outreach_status: r.outreach_status,
        email_type: 'initial' as const,
        email_type_label: 'Day 0 — Cold Outreach',
        sent_at: initialSentAt,
        body: r.outreach_email,
        // flag that this timestamp is estimated
        timestamp_estimated: !r.outreach_sent_at,
      })
    }

    if (r.follow_up_sent_at) {
      events.push({
        lead_id: r.id,
        name: r.name,
        address: r.address,
        category: r.category,
        grade: r.grade,
        contact_email: r.contact_email,
        outreach_status: r.outreach_status,
        email_type: 'followup1' as const,
        email_type_label: 'Day 3 — Follow-Up',
        sent_at: r.follow_up_sent_at,
        body: r.follow_up_email,
        timestamp_estimated: false,
      })
    }

    if (r.follow_up_2_sent_at) {
      events.push({
        lead_id: r.id,
        name: r.name,
        address: r.address,
        category: r.category,
        grade: r.grade,
        contact_email: r.contact_email,
        outreach_status: r.outreach_status,
        email_type: 'followup2' as const,
        email_type_label: 'Day 11 — Graceful Exit',
        sent_at: r.follow_up_2_sent_at,
        body: r.follow_up_2_email,
        timestamp_estimated: false,
      })
    }
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())

  return NextResponse.json({ events, total: events.length })
}
