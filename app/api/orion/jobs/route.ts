import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('id')

  if (jobId) {
    const [job, competitors, painPoints, reviews, adMatrix, hooks, competitorAds] = await Promise.all([
      db`SELECT * FROM orion_jobs WHERE id = ${jobId}`,
      db`SELECT * FROM orion_competitors WHERE job_id = ${jobId} ORDER BY created_at`,
      db`SELECT * FROM orion_pain_points WHERE job_id = ${jobId} ORDER BY created_at`,
      db`SELECT * FROM orion_reviews WHERE job_id = ${jobId} ORDER BY created_at`,
      db`SELECT * FROM orion_ad_matrix WHERE job_id = ${jobId} ORDER BY created_at`,
      db`SELECT * FROM orion_hooks WHERE job_id = ${jobId} ORDER BY created_at`,
      db`SELECT * FROM orion_competitor_ads WHERE job_id = ${jobId} ORDER BY created_at`,
    ])
    return NextResponse.json({ job: job[0], competitors, painPoints, reviews, adMatrix, hooks, competitorAds })
  }

  const jobs = await db`SELECT * FROM orion_jobs ORDER BY created_at DESC LIMIT 20`
  return NextResponse.json({ jobs })
}
