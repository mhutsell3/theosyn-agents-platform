import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const MAX_ACCOUNTS = 5

export async function GET() {
  const rows = await db`SELECT * FROM remi_ad_accounts ORDER BY created_at ASC`
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const count = await db`SELECT COUNT(*)::int AS n FROM remi_ad_accounts`
  if ((count[0] as { n: number }).n >= MAX_ACCOUNTS) {
    return NextResponse.json({ error: `Maximum of ${MAX_ACCOUNTS} ad accounts allowed` }, { status: 400 })
  }

  const body = await req.json()
  const { name, account_id } = body
  if (!name || !account_id) return NextResponse.json({ error: 'name and account_id required' }, { status: 400 })

  const row = await db`
    INSERT INTO remi_ad_accounts (name, account_id, enabled, track_cpc, track_cpl_like, track_cpl_follow, track_lpv, track_cpp, track_roas, track_cpl_lead)
    VALUES (
      ${name}, ${account_id}, true,
      ${body.track_cpc ?? true},
      ${body.track_cpl_like ?? false},
      ${body.track_cpl_follow ?? false},
      ${body.track_lpv ?? false},
      ${body.track_cpp ?? true},
      ${body.track_roas ?? true},
      ${body.track_cpl_lead ?? false}
    )
    RETURNING *`
  return NextResponse.json(row[0])
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const row = await db`
    UPDATE remi_ad_accounts SET
      name             = COALESCE(${fields.name ?? null},             name),
      account_id       = COALESCE(${fields.account_id ?? null},       account_id),
      enabled          = COALESCE(${fields.enabled ?? null},          enabled),
      track_cpc        = COALESCE(${fields.track_cpc ?? null},        track_cpc),
      track_cpl_like   = COALESCE(${fields.track_cpl_like ?? null},   track_cpl_like),
      track_cpl_follow = COALESCE(${fields.track_cpl_follow ?? null}, track_cpl_follow),
      track_lpv        = COALESCE(${fields.track_lpv ?? null},        track_lpv),
      track_cpp        = COALESCE(${fields.track_cpp ?? null},        track_cpp),
      track_roas       = COALESCE(${fields.track_roas ?? null},       track_roas),
      track_cpl_lead   = COALESCE(${fields.track_cpl_lead ?? null},   track_cpl_lead)
    WHERE id = ${id}
    RETURNING *`
  return NextResponse.json(row[0])
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db`DELETE FROM remi_ad_accounts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
