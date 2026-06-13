import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const approvals = await db`
    SELECT
      pa.*,
      c.name as client_name,
      sl.name as lead_name
    FROM piper_approvals pa
    LEFT JOIN clients c ON c.id = pa.client_id
    LEFT JOIN scout_leads sl ON sl.id = pa.lead_id
    WHERE pa.status = 'pending'
    ORDER BY pa.created_at DESC`
  return NextResponse.json({ approvals })
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  const [updated] = await db`
    UPDATE piper_approvals SET status = ${status} WHERE id = ${id} RETURNING *`
  return NextResponse.json({ approval: updated })
}
