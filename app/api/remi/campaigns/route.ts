import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('account') ?? null
  const level     = searchParams.get('level') ?? 'campaign'

  // Accept explicit since/until — fall back to days offset for backwards compat
  const today = new Date().toISOString().slice(0, 10)
  const since = searchParams.get('since') ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const until = searchParams.get('until') ?? today

  if (level === 'adset') {
    const rows = await db`
      SELECT
        account_id, account_name, campaign_id, campaign_name,
        adset_id, adset_name,
        SUM(spend)::numeric            AS spend,
        SUM(impressions)::int          AS impressions,
        SUM(clicks)::int               AS clicks,
        SUM(conversions)::int          AS conversions,
        SUM(conversion_value)::numeric AS conversion_value,
        SUM(add_to_cart)::int          AS add_to_cart,
        AVG(roas)::numeric             AS roas,
        AVG(cpa)::numeric              AS cpa,
        AVG(frequency)::numeric        AS frequency,
        AVG(ctr)::numeric              AS ctr,
        AVG(cpm)::numeric              AS cpm
      FROM remi_adset_snapshots
      WHERE date >= ${since}::date AND date <= ${until}::date
        AND (${accountId}::text IS NULL OR account_id = ${accountId})
      GROUP BY account_id, account_name, campaign_id, campaign_name, adset_id, adset_name
      ORDER BY spend DESC`

    return NextResponse.json({ rows })
  }

  if (level === 'ad') {
    const rows = await db`
      SELECT
        account_id, account_name, campaign_id, campaign_name,
        adset_id, adset_name, ad_id, ad_name,
        SUM(spend)::numeric            AS spend,
        SUM(impressions)::int          AS impressions,
        SUM(clicks)::int               AS clicks,
        SUM(conversions)::int          AS conversions,
        SUM(conversion_value)::numeric AS conversion_value,
        SUM(add_to_cart)::int          AS add_to_cart,
        AVG(roas)::numeric             AS roas,
        AVG(cpa)::numeric              AS cpa,
        AVG(frequency)::numeric        AS frequency,
        AVG(ctr)::numeric              AS ctr,
        AVG(cpm)::numeric              AS cpm
      FROM remi_ad_snapshots
      WHERE date >= ${since}::date AND date <= ${until}::date
        AND (${accountId}::text IS NULL OR account_id = ${accountId})
      GROUP BY account_id, account_name, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name
      ORDER BY spend DESC`

    return NextResponse.json({ rows })
  }

  // Campaign level (default)
  const campaigns = await db`
    SELECT
      account_id, account_name, campaign_id, campaign_name,
      SUM(spend)::numeric            AS spend,
      SUM(impressions)::int          AS impressions,
      SUM(clicks)::int               AS clicks,
      SUM(conversions)::int          AS conversions,
      SUM(conversion_value)::numeric AS conversion_value,
      AVG(roas)::numeric             AS roas,
      AVG(cpa)::numeric              AS cpa,
      AVG(frequency)::numeric        AS frequency,
      AVG(ctr)::numeric              AS ctr,
      AVG(cpm)::numeric              AS cpm
    FROM remi_snapshots
    WHERE date >= ${since}::date AND date <= ${until}::date
      AND (${accountId}::text IS NULL OR account_id = ${accountId})
    GROUP BY account_id, account_name, campaign_id, campaign_name
    ORDER BY spend DESC`

  const accounts = await db`
    SELECT
      account_id, account_name,
      SUM(spend)::numeric            AS total_spend,
      SUM(conversions)::int          AS total_conversions,
      SUM(conversion_value)::numeric AS total_conversion_value,
      CASE WHEN SUM(spend) > 0 THEN SUM(conversion_value) / SUM(spend) ELSE 0 END AS roas,
      CASE WHEN SUM(conversions) > 0 THEN SUM(spend) / SUM(conversions) ELSE 0 END AS cpa
    FROM remi_snapshots
    WHERE date >= ${since}::date AND date <= ${until}::date
    GROUP BY account_id, account_name
    ORDER BY total_spend DESC`

  return NextResponse.json({ campaigns, accounts })
}
