import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getOrgSettings, upsertOrgSetting } from '@/lib/agents'

export async function GET() {
  const session = await auth()
  if (!session?.user?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const settings = await getOrgSettings(session.user.orgId)
  // Mask secret values in response
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(settings)) {
    masked[k] = v ? '••••••••' + v.slice(-4) : ''
  }
  return NextResponse.json({ settings: masked })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as Record<string, string>
  const allowed = ['gemini_api_key', 'openai_api_key', 'anthropic_api_key', 'ollama_host']
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.includes(key)) continue
    if (value && value.trim()) {
      await upsertOrgSetting(session.user.orgId, key, value.trim())
    }
  }
  return NextResponse.json({ ok: true })
}
