import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const clients = await db`SELECT * FROM clients ORDER BY updated_at DESC`
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const { name, type, stage, contact_name, contact_email, notes } = await req.json()

  if (!name || !type || !stage) {
    return NextResponse.json({ error: 'name, type and stage are required' }, { status: 400 })
  }

  const [client] = await db`
    INSERT INTO clients (name, type, stage, contact_name, contact_email, notes)
    VALUES (${name}, ${type}, ${stage}, ${contact_name}, ${contact_email}, ${notes})
    RETURNING *`

  return NextResponse.json(client, { status: 201 })
}
