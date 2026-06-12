import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAgentStatuses } from '@/lib/agents'

export async function GET() {
  const session = await auth()
  if (!session?.user?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const agents = await getAgentStatuses(session.user.orgId)
    return NextResponse.json({ agents })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
