import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const expenses = await db`SELECT * FROM expenses ORDER BY expense_date DESC`
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const { name, amount, category, recurring, recurrence, expense_date, notes } = await req.json()
  if (!name || !amount) return NextResponse.json({ error: 'name and amount required' }, { status: 400 })
  const [expense] = await db`
    INSERT INTO expenses (name, amount, category, recurring, recurrence, expense_date, notes)
    VALUES (${name}, ${amount}, ${category ?? 'General'}, ${recurring ?? false}, ${recurrence}, ${expense_date}, ${notes})
    RETURNING *`
  return NextResponse.json(expense, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await db`DELETE FROM expenses WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
