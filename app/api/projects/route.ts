import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectPage } from '@/lib/notion'

export async function GET() {
  const projects = await db`
    SELECT p.*, c.name as client_name
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    ORDER BY p.due_date ASC NULLS LAST`
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const { name, client_id, type, phase, due_date, notes } = await req.json()

  if (!name || !type || !phase) {
    return NextResponse.json({ error: 'name, type and phase are required' }, { status: 400 })
  }

  // Get client name for the Notion page
  let client_name: string | null = null
  if (client_id) {
    const [client] = await db`SELECT name FROM clients WHERE id = ${client_id}`
    client_name = client?.name ?? null
  }

  // Create Notion page in parallel with DB insert
  const [notionUrl, [project]] = await Promise.all([
    createProjectPage({ name, type, phase, client_name, due_date, notes }),
    db`INSERT INTO projects (name, client_id, type, phase, due_date, notes)
       VALUES (${name}, ${client_id}, ${type}, ${phase}, ${due_date}, ${notes})
       RETURNING *`,
  ])

  // Store Notion URL back on the project
  if (notionUrl) {
    await db`UPDATE projects SET notion_url = ${notionUrl} WHERE id = ${project.id}`
    project.notion_url = notionUrl
  }

  return NextResponse.json(project, { status: 201 })
}
