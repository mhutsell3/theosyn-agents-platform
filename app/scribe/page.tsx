import { db } from '@/lib/db'
import ScribeDashboard from '@/components/ScribeDashboard'

export const metadata = { title: 'Scribe — Curriculum | TheoSYN' }
export const revalidate = 0

export default async function ScribePage() {
  const [topics, materials, recentResearch, sageBriefs] = await Promise.all([
    db`
      SELECT t.*,
        COUNT(m.id) FILTER (WHERE m.status = 'draft') as drafts,
        COUNT(m.id) FILTER (WHERE m.status = 'approved') as approved,
        COUNT(m.id) FILTER (WHERE m.status = 'published') as published,
        COUNT(r.id) as research_count
      FROM scribe_topics t
      LEFT JOIN scribe_materials m ON m.topic_id = t.id
      LEFT JOIN scribe_research r ON r.topic_id = t.id
      GROUP BY t.id
      ORDER BY t.track, t.order_index`,

    db`
      SELECT m.*, t.title as topic_title, t.track
      FROM scribe_materials m
      LEFT JOIN scribe_topics t ON t.id = m.topic_id
      ORDER BY m.created_at DESC
      LIMIT 20`,

    db`
      SELECT r.*, t.title as topic_title
      FROM scribe_research r
      LEFT JOIN scribe_topics t ON t.id = r.topic_id
      ORDER BY r.created_at DESC
      LIMIT 10`,

    db`SELECT id, topic, content, created_at FROM sage_briefs ORDER BY created_at DESC LIMIT 10`,
  ])

  const counts = {
    topics: (topics as unknown[]).length,
    drafts: (materials as unknown as { status: string }[]).filter(m => m.status === 'draft').length,
    approved: (materials as unknown as { status: string }[]).filter(m => m.status === 'approved').length,
    published: (materials as unknown as { status: string }[]).filter(m => m.status === 'published').length,
    research: (recentResearch as unknown[]).length,
  }

  return (
    <ScribeDashboard
      topics={topics as any[]}
      materials={materials as any[]}
      recentResearch={recentResearch as any[]}
      sageBriefs={sageBriefs as any[]}
      counts={counts}
    />
  )
}
