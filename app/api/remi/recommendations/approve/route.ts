import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { executePause } from '@/lib/remi'

export async function POST(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const rows = await db`SELECT * FROM remi_recommendations WHERE id = ${id} LIMIT 1`
  const rec = rows[0] as { id: number; type: string; action_data: { campaign_id?: string } }
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let executed = false
  let execError = null

  try {
    if (rec.type === 'pause' && rec.action_data?.campaign_id) {
      await executePause(rec.action_data.campaign_id)
      executed = true
    }
    // Other action types (reduce_budget, scale) logged for manual action for now
  } catch (err) {
    execError = String(err)
  }

  await db`
    UPDATE remi_recommendations
    SET status = 'approved', executed_at = now()
    WHERE id = ${id}`

  return NextResponse.json({ ok: true, executed, execError })
}
