import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assessProjectRisks } from '@/lib/atlas'

export async function GET() {
  const projects = await db`
    SELECT p.id, p.name, p.phase, p.due_date, p.updated_at, p.notes, c.name as client_name
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.phase != 'Delivered'
    ORDER BY p.due_date ASC NULLS LAST`

  const risks = assessProjectRisks(
    projects as unknown as { id: string; name: string; phase: string; client_name: string | null; due_date: string | null; updated_at: string; notes: string | null }[]
  )

  return NextResponse.json({
    risks,
    overdue: risks.filter(r => r.risk === 'overdue').length,
    atRisk: risks.filter(r => r.risk === 'at_risk').length,
    onTrack: risks.filter(r => r.risk === 'on_track').length,
  })
}
