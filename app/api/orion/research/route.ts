import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  extractProductName, researchCompetitors, researchPainPoints,
  researchReviews, buildAdMatrix, buildCreativeHooks, researchCompetitorAds,
} from '@/lib/orion'

export async function POST(req: NextRequest) {
  const { productUrl, brand } = await req.json()
  if (!productUrl?.trim()) return NextResponse.json({ error: 'Product URL required' }, { status: 400 })

  // Create job
  const productName = await extractProductName(productUrl)
  const [job] = await db`
    INSERT INTO orion_jobs (product_url, product_name, brand, status)
    VALUES (${productUrl}, ${productName}, ${brand ?? 'Blessed Bling Co'}, 'running')
    RETURNING id, product_name`

  const jobId = (job as unknown as { id: string }).id

  try {
    // Run all 6 research tasks
    const [competitors, painPoints, reviews, hooks, competitorAds] = await Promise.all([
      researchCompetitors(productName, brand ?? 'Blessed Bling Co'),
      researchPainPoints(productName),
      researchReviews(productName),
      buildCreativeHooks(productName, brand ?? 'Blessed Bling Co'),
      researchCompetitorAds(productName),
    ])

    // Ad matrix needs pain points first
    const adMatrix = await buildAdMatrix(
      productName,
      brand ?? 'Blessed Bling Co',
      painPoints.map(p => p.pain_point)
    )

    // Save all results
    for (const c of competitors) {
      await db`INSERT INTO orion_competitors (job_id, company_name, platform, store_link, listing_title, price, est_sales, rating)
        VALUES (${jobId}, ${c.company_name}, ${c.platform}, ${c.store_link}, ${c.listing_title}, ${c.price}, ${c.est_sales}, ${c.rating})`
    }
    for (const p of painPoints) {
      await db`INSERT INTO orion_pain_points (job_id, pain_point, severity, customer_quote, counter_angle)
        VALUES (${jobId}, ${p.pain_point}, ${p.severity}, ${p.customer_quote}, ${p.counter_angle})`
    }
    for (const r of reviews) {
      await db`INSERT INTO orion_reviews (job_id, reviewer_name, rating, category, review_snippet, core_complaint, source_link)
        VALUES (${jobId}, ${r.reviewer_name}, ${r.rating}, ${r.category}, ${r.review_snippet}, ${r.core_complaint}, ${r.source_link})`
    }
    for (const a of adMatrix) {
      await db`INSERT INTO orion_ad_matrix (job_id, adset_name, ad_name, hook, primary_text, headline, description, meta_targets)
        VALUES (${jobId}, ${a.adset_name}, ${a.ad_name}, ${a.hook}, ${a.primary_text}, ${a.headline}, ${a.description}, ${a.meta_targets})`
    }
    for (const h of hooks) {
      await db`INSERT INTO orion_hooks (job_id, hook_title, target_desire, hook_type, on_screen_text, headline)
        VALUES (${jobId}, ${h.hook_title}, ${h.target_desire}, ${h.hook_type}, ${h.on_screen_text}, ${h.headline})`
    }
    for (const ca of competitorAds) {
      await db`INSERT INTO orion_competitor_ads (job_id, brand_name, platform, ad_copy, est_spend, active_days, ad_link)
        VALUES (${jobId}, ${ca.brand_name}, ${ca.platform}, ${ca.ad_copy}, ${ca.est_spend}, ${ca.active_days}, ${ca.ad_link})`
    }

    await db`UPDATE orion_jobs SET status = 'complete' WHERE id = ${jobId}`
    await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Orion'`

    return NextResponse.json({
      jobId, productName,
      counts: { competitors: competitors.length, painPoints: painPoints.length, reviews: reviews.length, adMatrix: adMatrix.length, hooks: hooks.length, competitorAds: competitorAds.length }
    })
  } catch (err) {
    await db`UPDATE orion_jobs SET status = 'error', error = ${err instanceof Error ? err.message : 'Unknown error'} WHERE id = ${jobId}`
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Research failed' }, { status: 500 })
  }
}
