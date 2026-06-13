import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateProjectPlan } from '@/lib/atlas'

export async function POST(req: NextRequest) {
  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const [project] = await db`
    SELECT p.*, c.name as client_name
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${projectId}`

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const p = project as unknown as { name: string; type: string; client_name: string | null; notes: string | null }
  const plan = await generateProjectPlan(p)

  return NextResponse.json({ plan })
}
