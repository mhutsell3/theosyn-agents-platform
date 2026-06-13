import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const resources = await db`SELECT * FROM sage_resources ORDER BY saved_at DESC LIMIT 50`
  return NextResponse.json(resources)
}

export async function POST(req: NextRequest) {
  const { title, url, category, summary } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const [resource] = await db`
    INSERT INTO sage_resources (title, url, category, summary)
    VALUES (${title}, ${url ?? null}, ${category ?? 'General'}, ${summary ?? null})
    RETURNING *`

  return NextResponse.json(resource)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await db`DELETE FROM sage_resources WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
