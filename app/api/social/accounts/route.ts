import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateToken } from '@/lib/meta'

export async function GET() {
  const accounts = await db`
    SELECT sa.*, a.name as agent_name, a.last_heartbeat
    FROM social_accounts sa
    LEFT JOIN agents a ON a.id = sa.agent_id
    ORDER BY sa.created_at DESC`
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const { page_id, access_token, platform } = await req.json()

  if (!page_id || !access_token) {
    return NextResponse.json({ error: 'page_id and access_token are required' }, { status: 400 })
  }

  // Validate the token and get page name
  const validation = await validateToken({ pageId: page_id, accessToken: access_token })
  if (!validation.valid) {
    return NextResponse.json({ error: 'Invalid Page ID or Access Token' }, { status: 400 })
  }

  const pageName = validation.pageName ?? page_id

  // Create a dedicated agent for this page
  const emoji = platform === 'Instagram' ? '📸' : platform === 'LinkedIn' ? '💼' : platform === 'X' ? '🐦' : '📘'
  const [agent] = await db`
    INSERT INTO agents (name, persona, role, avatar_emoji)
    VALUES (
      ${`${pageName} Agent`},
      ${`${platform} Page Manager`},
      ${`Auto-posts content, monitors engagement, and reports on ${pageName} page performance`},
      ${emoji}
    )
    RETURNING *`

  const [account] = await db`
    INSERT INTO social_accounts (platform, page_name, page_id, access_token, agent_id)
    VALUES (${platform ?? 'Facebook'}, ${pageName}, ${page_id}, ${access_token}, ${agent.id})
    RETURNING id, platform, page_name, page_id, active, created_at, agent_id`

  return NextResponse.json({ account, agent }, { status: 201 })
}
