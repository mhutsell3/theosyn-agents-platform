import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Also delete the associated agent
  const [account] = await db`SELECT agent_id FROM social_accounts WHERE id = ${id}`
  if (account?.agent_id) {
    await db`DELETE FROM agents WHERE id = ${account.agent_id}`
  }
  await db`DELETE FROM social_accounts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { active } = await req.json()
  const [account] = await db`UPDATE social_accounts SET active = ${active} WHERE id = ${id} RETURNING *`
  return NextResponse.json(account)
}
