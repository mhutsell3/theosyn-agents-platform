import { NextRequest, NextResponse } from 'next/server'
import {
  getAdAccounts, fetchAccountInsights, saveSnapshots,
  fetchAdSetInsights, saveAdSetSnapshots,
  fetchAdInsights, saveAdSnapshots,
  buildRecommendations, saveRecommendations,
} from '@/lib/remi'
import { isAgentEnabled } from '@/lib/agent-settings'

export async function POST(req: NextRequest) {
  if (!await isAgentEnabled('Remi')) return NextResponse.json({ skipped: true, reason: 'Agent disabled' })

  const body = await req.json().catch(() => ({}))
  const { datePreset = 'yesterday', since, until, accountId } = body

  let accounts = await getAdAccounts()
  if (accounts.length === 0) return NextResponse.json({ error: 'No ad accounts configured. Go to Settings → Ad Accounts to add one.' }, { status: 400 })
  if (accountId) accounts = accounts.filter(a => a.accountId === accountId)

  console.log('[Remi] Syncing accounts:', accounts.map(a => `${a.name}=${a.accountId}`), since ? `${since}→${until}` : datePreset)

  const allCampaigns = [], allAdSets = [], allAds = [], errors = []

  for (const account of accounts) {
    // Campaign level
    try {
      const metrics = await fetchAccountInsights(account, datePreset, since, until)
      await saveSnapshots(metrics)
      allCampaigns.push(...metrics)
      console.log(`[Remi] Campaigns: ${metrics.length} for ${account.name}`)
    } catch (err) {
      console.error(`[Remi] Campaign error for ${account.name}:`, err)
      errors.push({ account: account.name, level: 'campaign', error: String(err) })
    }

    // Ad Set level
    try {
      const metrics = await fetchAdSetInsights(account, datePreset, since, until)
      await saveAdSetSnapshots(metrics)
      allAdSets.push(...metrics)
      console.log(`[Remi] Ad Sets: ${metrics.length} for ${account.name}`)
    } catch (err) {
      console.error(`[Remi] Ad Set error for ${account.name}:`, err)
      errors.push({ account: account.name, level: 'adset', error: String(err) })
    }

    // Ad level
    try {
      const metrics = await fetchAdInsights(account, datePreset, since, until)
      await saveAdSnapshots(metrics)
      allAds.push(...metrics)
      console.log(`[Remi] Ads: ${metrics.length} for ${account.name}`)
    } catch (err) {
      console.error(`[Remi] Ad error for ${account.name}:`, err)
      errors.push({ account: account.name, level: 'ad', error: String(err) })
    }
  }

  const recs = buildRecommendations(allCampaigns)
  if (recs.length > 0) await saveRecommendations(recs)

  return NextResponse.json({
    accounts: accounts.length,
    campaigns: allCampaigns.length,
    adsets: allAdSets.length,
    ads: allAds.length,
    recommendations: recs.length,
    errors,
  })
}
