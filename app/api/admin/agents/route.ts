import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAllAgentsForAdmin, setAgentSystemEnabled } from '@/lib/agents'

function requireAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.isSystemAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET() {
  const session = await auth()
  const denied = requireAdmin(session)
  if (denied) return denied
  const agents = await getAllAgentsForAdmin()
  return NextResponse.json({ agents })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  const denied = requireAdmin(session)
  if (denied) return denied
  const { agentId, system_enabled } = await req.json() as { agentId: string; system_enabled: boolean }
  if (!agentId || typeof system_enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  await setAgentSystemEnabled(agentId, system_enabled)
  return NextResponse.json({ ok: true })
}
