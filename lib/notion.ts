const NOTION_TOKEN = process.env.NOTION_TOKEN!
const NOTION_PROJECTS_PAGE_ID = process.env.NOTION_PROJECTS_PAGE_ID!

const headers = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
}

export async function createProjectPage(project: {
  name: string
  type: string
  phase: string
  client_name: string | null
  due_date: string | null
  notes: string | null
}): Promise<string | null> {
  const content = [
    `## Project Brief`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| **Client** | ${project.client_name ?? '—'} |`,
    `| **Type** | ${project.type} |`,
    `| **Phase** | ${project.phase} |`,
    `| **Due Date** | ${project.due_date ?? '—'} |`,
    ``,
    `---`,
    ``,
    `## Notes`,
    ``,
    project.notes ?? '_No notes yet._',
    ``,
    `---`,
    ``,
    `## Deliverables`,
    ``,
    `- [ ] `,
    ``,
    `## Meeting Notes`,
    ``,
    `_Add meeting notes here._`,
    ``,
    `## Resources`,
    ``,
    `_Add links, files, and references here._`,
  ].join('\n')

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        parent: { page_id: NOTION_PROJECTS_PAGE_ID },
        icon: { type: 'emoji', emoji: '🏗️' },
        properties: {
          title: [{ type: 'text', text: { content: project.name } }],
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: content } }],
            },
          },
        ],
      }),
    })

    const data = await res.json()
    return data.url ?? null
  } catch (err) {
    console.error('Notion page creation failed:', err)
    return null
  }
}
