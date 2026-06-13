import { db } from '@/lib/db'
import LogosPanel from '@/components/LogosPanel'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Logos — TheoSYN',
  description: 'Devotional & Faith Content Agent',
}

export const revalidate = 0

export default async function LogosPage() {
  const [topics, guides] = await Promise.all([
    db`SELECT * FROM logos_topics WHERE active = true ORDER BY category, title`,
    db`
      SELECT g.*, t.title as topic_title, t.category
      FROM logos_guides g
      LEFT JOIN logos_topics t ON t.id = g.topic_id
      ORDER BY g.created_at DESC
      LIMIT 30`,
  ])

  return (
    <LogosPanel
      topics={topics as unknown as any[]}
      guides={guides as unknown as any[]}
    />
  )
}
