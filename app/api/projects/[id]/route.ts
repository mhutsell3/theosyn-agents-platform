import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { phase, notes, due_date } = await req.json()

  const [project] = await db`
    UPDATE projects SET
      phase     = coalesce(${phase}, phase),
      notes     = coalesce(${notes}, notes),
      due_date  = coalesce(${due_date}, due_date)
    WHERE id = ${id}
    RETURNING *`

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db`DELETE FROM projects WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
