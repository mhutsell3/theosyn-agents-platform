import { NextResponse } from 'next/server'
import { getAgentStatuses } from '@/lib/agents'

export async function GET() {
  try {
    const agents = await getAgentStatuses()
    return NextResponse.json({ agents })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
