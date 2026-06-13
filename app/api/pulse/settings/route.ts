import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const settings = await db`
    SELECT pps.*, sa.page_name, sa.page_id, sa.platform, sa.active
    FROM pulse_page_settings pps
    JOIN social_accounts sa ON sa.id = pps.social_account_id
    ORDER BY sa.page_name ASC`

  // Also return unmonitored accounts (so user can add them)
  const monitored = (settings as unknown as { social_account_id: string }[]).map(s => s.social_account_id)
  const unmonitored = await db`
    SELECT id, page_name, page_id, platform
    FROM social_accounts
    WHERE active = true
      ${monitored.length > 0 ? db`AND id != ALL(${monitored}::uuid[])` : db``}
    ORDER BY page_name ASC`

  return NextResponse.json({ settings, unmonitored })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { social_account_id, ...rest } = body

  if (!social_account_id) return NextResponse.json({ error: 'social_account_id required' }, { status: 400 })

  const [existing] = await db`SELECT id FROM pulse_page_settings WHERE social_account_id = ${social_account_id}`

  if (existing) {
    const [updated] = await db`
      UPDATE pulse_page_settings SET
        enabled             = COALESCE(${rest.enabled ?? null}, enabled),
        reply_tone          = COALESCE(${rest.reply_tone ?? null}, reply_tone),
        auto_reply_simple   = COALESCE(${rest.auto_reply_simple ?? null}, auto_reply_simple),
        sign_off_name       = COALESCE(${rest.sign_off_name ?? null}, sign_off_name),
        monitor_days        = COALESCE(${rest.monitor_days ?? null}, monitor_days),
        flag_negative       = COALESCE(${rest.flag_negative ?? null}, flag_negative),
        flag_questions      = COALESCE(${rest.flag_questions ?? null}, flag_questions),
        dead_post_alert     = COALESCE(${rest.dead_post_alert ?? null}, dead_post_alert),
        spike_threshold     = COALESCE(${rest.spike_threshold ?? null}, spike_threshold),
        updated_at          = now()
      WHERE social_account_id = ${social_account_id}
      RETURNING *`
    return NextResponse.json({ setting: updated })
  }

  const [created] = await db`
    INSERT INTO pulse_page_settings (social_account_id, reply_tone, auto_reply_simple, sign_off_name, monitor_days, flag_negative, flag_questions, dead_post_alert, spike_threshold)
    VALUES (
      ${social_account_id},
      ${rest.reply_tone ?? 'Faith-informed'},
      ${rest.auto_reply_simple ?? false},
      ${rest.sign_off_name ?? 'Milford & The TheoSYN Team'},
      ${rest.monitor_days ?? 14},
      ${rest.flag_negative ?? true},
      ${rest.flag_questions ?? true},
      ${rest.dead_post_alert ?? true},
      ${rest.spike_threshold ?? 10}
    )
    RETURNING *`

  return NextResponse.json({ setting: created }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { social_account_id } = await req.json()
  await db`DELETE FROM pulse_page_settings WHERE social_account_id = ${social_account_id}`
  return NextResponse.json({ ok: true })
}
