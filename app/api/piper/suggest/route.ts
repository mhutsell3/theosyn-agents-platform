import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { suggestStageMove } from '@/lib/piper'

export async function POST(req: NextRequest) {
  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const [client] = await db`SELECT * FROM clients WHERE id = ${clientId}`
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const c = client as unknown as { name: string; stage: string; notes: string | null; updated_at: string }
  const daysInStage = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000)
  const suggestion = await suggestStageMove({ ...c, daysInStage })

  return NextResponse.json({ suggestion })
}
