import { db } from '@/lib/db'
import { logTokenUsage } from '@/lib/usage'
import { readAgentSkill } from '@/lib/agent-skill'

const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN!
const OLLAMA_URL   = process.env.OLLAMA_URL   ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'
const GRAPH_URL    = 'https://graph.facebook.com/v19.0'

// ── Account config ────────────────────────────────────────────────
export interface AdAccount {
  id: number
  accountId: string
  name: string
  track_cpc: boolean
  track_cpl_like: boolean
  track_cpl_follow: boolean
  track_lpv: boolean
  track_cpp: boolean
  track_roas: boolean
  track_cpl_lead: boolean
}

export async function getAdAccounts(): Promise<AdAccount[]> {
  const rows = await db`SELECT * FROM remi_ad_accounts WHERE enabled = true ORDER BY created_at ASC`
  return (rows as any[]).map(r => ({
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    track_cpc: r.track_cpc,
    track_cpl_like: r.track_cpl_like,
    track_cpl_follow: r.track_cpl_follow,
    track_lpv: r.track_lpv,
    track_cpp: r.track_cpp,
    track_roas: r.track_roas,
    track_cpl_lead: r.track_cpl_lead,
  }))
}

// ── Meta Graph API helpers ────────────────────────────────────────
const INSIGHT_FIELDS = [
  'campaign_id', 'campaign_name',
  'spend', 'impressions', 'clicks', 'reach', 'frequency',
  'ctr', 'cpm', 'actions', 'action_values', 'cost_per_action_type',
].join(',')

function sumActions(arr: { action_type: string; value: string }[], types: string[]): number {
  if (!arr) return 0
  return arr
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value ?? '0'), 0)
}

export interface CampaignMetrics {
  accountId: string
  accountName: string
  campaignId: string
  campaignName: string
  status: string
  date: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpm: number
  reach: number
  frequency: number
  conversions: number
  conversionValue: number
  addToCart: number
  roas: number
  cpa: number
}

export async function fetchAccountInsights(
  account: AdAccount,
  datePreset = 'yesterday',
  since?: string,
  until?: string,
): Promise<CampaignMetrics[]> {
  const params = new URLSearchParams({
    access_token: ACCESS_TOKEN,
    level: 'campaign',
    fields: INSIGHT_FIELDS,
    time_increment: '1',
    limit: '100',
  })

  if (since && until) {
    params.set('time_range', JSON.stringify({ since, until }))
  } else {
    params.set('date_preset', datePreset)
  }

  const res = await fetch(`${GRAPH_URL}/${account.accountId}/insights?${params}`, {
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API error for ${account.name}: ${err}`)
  }

  const data = await res.json()
  const rows = data.data ?? []

  return rows.map((r: Record<string, unknown>) => {
    const actions       = (r.actions as { action_type: string; value: string }[]) ?? []
    const actionValues  = (r.action_values as { action_type: string; value: string }[]) ?? []
    const spend         = parseFloat(r.spend as string ?? '0')
    // Use omni_purchase (not purchase) to match Meta Ads Manager exactly and avoid double-counting.
    // omni_purchase is the canonical cross-channel metric that includes website pixel purchases.
    // Including both 'purchase' and 'omni_purchase' doubles the count.
    const conversions   = sumActions(actions, ['omni_purchase', 'lead', 'complete_registration'])
    const conversionValue = sumActions(actionValues, ['omni_purchase'])
    // omni_add_to_cart matches Meta Ads Manager's "Adds to Cart" column exactly.
    const addToCart     = sumActions(actions, ['omni_add_to_cart'])
    const roas          = spend > 0 && conversionValue > 0 ? conversionValue / spend : 0
    const cpa           = conversions > 0 ? spend / conversions : 0

    return {
      accountId:       account.accountId,
      accountName:     account.name,
      campaignId:      r.campaign_id as string,
      campaignName:    r.campaign_name as string,
      status:          'ACTIVE',
      date:            (r.date_start as string) ?? new Date().toISOString().slice(0, 10),
      spend,
      impressions:     parseInt(r.impressions as string ?? '0'),
      clicks:          parseInt(r.clicks as string ?? '0'),
      ctr:             parseFloat(r.ctr as string ?? '0'),
      cpm:             parseFloat(r.cpm as string ?? '0'),
      reach:           parseInt(r.reach as string ?? '0'),
      frequency:       parseFloat(r.frequency as string ?? '0'),
      conversions,
      conversionValue,
      addToCart,
      roas,
      cpa,
    }
  })
}

// ── Ad Set level insights ─────────────────────────────────────────
const ADSET_FIELDS = [
  'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
  'spend', 'impressions', 'clicks', 'reach', 'frequency',
  'ctr', 'cpm', 'actions', 'action_values',
].join(',')

export interface AdSetMetrics {
  accountId: string; accountName: string
  campaignId: string; campaignName: string
  adsetId: string; adsetName: string
  date: string
  spend: number; impressions: number; clicks: number
  ctr: number; cpm: number; reach: number; frequency: number
  conversions: number; conversionValue: number; addToCart: number; roas: number; cpa: number
}

export async function fetchAdSetInsights(account: AdAccount, datePreset = 'yesterday', since?: string, until?: string): Promise<AdSetMetrics[]> {
  const params = new URLSearchParams({ access_token: ACCESS_TOKEN, level: 'adset', fields: ADSET_FIELDS, time_increment: '1', limit: '200' })
  if (since && until) params.set('time_range', JSON.stringify({ since, until }))
  else params.set('date_preset', datePreset)

  const res = await fetch(`${GRAPH_URL}/${account.accountId}/insights?${params}`, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Meta API (adset) error for ${account.name}: ${await res.text()}`)
  const rows = (await res.json()).data ?? []

  return rows.map((r: Record<string, unknown>) => {
    const actions = (r.actions as { action_type: string; value: string }[]) ?? []
    const actionValues = (r.action_values as { action_type: string; value: string }[]) ?? []
    const spend = parseFloat(r.spend as string ?? '0')
    const conversions = sumActions(actions, ['omni_purchase', 'lead', 'complete_registration'])
    const conversionValue = sumActions(actionValues, ['omni_purchase'])
    const addToCart = sumActions(actions, ['omni_add_to_cart'])
    return {
      accountId: account.accountId, accountName: account.name,
      campaignId: r.campaign_id as string, campaignName: r.campaign_name as string,
      adsetId: r.adset_id as string, adsetName: r.adset_name as string,
      date: (r.date_start as string) ?? new Date().toISOString().slice(0, 10),
      spend, impressions: parseInt(r.impressions as string ?? '0'), clicks: parseInt(r.clicks as string ?? '0'),
      ctr: parseFloat(r.ctr as string ?? '0'), cpm: parseFloat(r.cpm as string ?? '0'),
      reach: parseInt(r.reach as string ?? '0'), frequency: parseFloat(r.frequency as string ?? '0'),
      conversions, conversionValue, addToCart,
      roas: spend > 0 && conversionValue > 0 ? conversionValue / spend : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
    }
  })
}

export async function saveAdSetSnapshots(metrics: AdSetMetrics[]) {
  for (const m of metrics) {
    await db`
      INSERT INTO remi_adset_snapshots (
        account_id, account_name, campaign_id, campaign_name, adset_id, adset_name, date,
        spend, impressions, clicks, ctr, cpm, reach, frequency, conversions, conversion_value, add_to_cart, roas, cpa
      ) VALUES (
        ${m.accountId}, ${m.accountName}, ${m.campaignId}, ${m.campaignName}, ${m.adsetId}, ${m.adsetName}, ${m.date},
        ${m.spend}, ${m.impressions}, ${m.clicks}, ${m.ctr}, ${m.cpm}, ${m.reach}, ${m.frequency},
        ${m.conversions}, ${m.conversionValue}, ${m.addToCart}, ${m.roas}, ${m.cpa}
      )
      ON CONFLICT (account_id, adset_id, date) DO UPDATE SET
        spend = EXCLUDED.spend, impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
        ctr = EXCLUDED.ctr, cpm = EXCLUDED.cpm, reach = EXCLUDED.reach, frequency = EXCLUDED.frequency,
        conversions = EXCLUDED.conversions, conversion_value = EXCLUDED.conversion_value,
        add_to_cart = EXCLUDED.add_to_cart,
        roas = EXCLUDED.roas, cpa = EXCLUDED.cpa`
  }
}

// ── Ad level insights ─────────────────────────────────────────────
const AD_FIELDS = [
  'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name',
  'spend', 'impressions', 'clicks', 'reach', 'frequency',
  'ctr', 'cpm', 'actions', 'action_values',
].join(',')

export interface AdMetrics {
  accountId: string; accountName: string
  campaignId: string; campaignName: string
  adsetId: string; adsetName: string
  adId: string; adName: string
  date: string
  spend: number; impressions: number; clicks: number
  ctr: number; cpm: number; reach: number; frequency: number
  conversions: number; conversionValue: number; addToCart: number; roas: number; cpa: number
}

export async function fetchAdInsights(account: AdAccount, datePreset = 'yesterday', since?: string, until?: string): Promise<AdMetrics[]> {
  const params = new URLSearchParams({ access_token: ACCESS_TOKEN, level: 'ad', fields: AD_FIELDS, time_increment: '1', limit: '200' })
  if (since && until) params.set('time_range', JSON.stringify({ since, until }))
  else params.set('date_preset', datePreset)

  const res = await fetch(`${GRAPH_URL}/${account.accountId}/insights?${params}`, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Meta API (ad) error for ${account.name}: ${await res.text()}`)
  const rows = (await res.json()).data ?? []

  return rows.map((r: Record<string, unknown>) => {
    const actions = (r.actions as { action_type: string; value: string }[]) ?? []
    const actionValues = (r.action_values as { action_type: string; value: string }[]) ?? []
    const spend = parseFloat(r.spend as string ?? '0')
    const conversions = sumActions(actions, ['omni_purchase', 'lead', 'complete_registration'])
    const conversionValue = sumActions(actionValues, ['omni_purchase'])
    const addToCart = sumActions(actions, ['omni_add_to_cart'])
    return {
      accountId: account.accountId, accountName: account.name,
      campaignId: r.campaign_id as string, campaignName: r.campaign_name as string,
      adsetId: r.adset_id as string, adsetName: r.adset_name as string,
      adId: r.ad_id as string, adName: r.ad_name as string,
      date: (r.date_start as string) ?? new Date().toISOString().slice(0, 10),
      spend, impressions: parseInt(r.impressions as string ?? '0'), clicks: parseInt(r.clicks as string ?? '0'),
      ctr: parseFloat(r.ctr as string ?? '0'), cpm: parseFloat(r.cpm as string ?? '0'),
      reach: parseInt(r.reach as string ?? '0'), frequency: parseFloat(r.frequency as string ?? '0'),
      conversions, conversionValue, addToCart,
      roas: spend > 0 && conversionValue > 0 ? conversionValue / spend : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
    }
  })
}

export async function saveAdSnapshots(metrics: AdMetrics[]) {
  for (const m of metrics) {
    await db`
      INSERT INTO remi_ad_snapshots (
        account_id, account_name, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, date,
        spend, impressions, clicks, ctr, cpm, reach, frequency, conversions, conversion_value, add_to_cart, roas, cpa
      ) VALUES (
        ${m.accountId}, ${m.accountName}, ${m.campaignId}, ${m.campaignName}, ${m.adsetId}, ${m.adsetName}, ${m.adId}, ${m.adName}, ${m.date},
        ${m.spend}, ${m.impressions}, ${m.clicks}, ${m.ctr}, ${m.cpm}, ${m.reach}, ${m.frequency},
        ${m.conversions}, ${m.conversionValue}, ${m.addToCart}, ${m.roas}, ${m.cpa}
      )
      ON CONFLICT (account_id, ad_id, date) DO UPDATE SET
        spend = EXCLUDED.spend, impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
        ctr = EXCLUDED.ctr, cpm = EXCLUDED.cpm, reach = EXCLUDED.reach, frequency = EXCLUDED.frequency,
        conversions = EXCLUDED.conversions, conversion_value = EXCLUDED.conversion_value,
        add_to_cart = EXCLUDED.add_to_cart,
        roas = EXCLUDED.roas, cpa = EXCLUDED.cpa`
  }
}

// ── Save snapshots to DB ──────────────────────────────────────────
export async function saveSnapshots(metrics: CampaignMetrics[]) {
  for (const m of metrics) {
    await db`
      INSERT INTO remi_snapshots (
        account_id, account_name, campaign_id, campaign_name, status, date,
        spend, impressions, clicks, ctr, cpm, reach, frequency,
        conversions, conversion_value, add_to_cart, roas, cpa
      ) VALUES (
        ${m.accountId}, ${m.accountName}, ${m.campaignId}, ${m.campaignName},
        ${m.status}, ${m.date}, ${m.spend}, ${m.impressions}, ${m.clicks},
        ${m.ctr}, ${m.cpm}, ${m.reach}, ${m.frequency},
        ${m.conversions}, ${m.conversionValue}, ${m.addToCart}, ${m.roas}, ${m.cpa}
      )
      ON CONFLICT (account_id, campaign_id, date)
      DO UPDATE SET
        spend = EXCLUDED.spend, impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks, ctr = EXCLUDED.ctr, cpm = EXCLUDED.cpm,
        reach = EXCLUDED.reach, frequency = EXCLUDED.frequency,
        conversions = EXCLUDED.conversions, conversion_value = EXCLUDED.conversion_value,
        add_to_cart = EXCLUDED.add_to_cart,
        roas = EXCLUDED.roas, cpa = EXCLUDED.cpa, status = EXCLUDED.status`
  }
}

// ── Generate recommendations via Ollama ──────────────────────────
export interface Recommendation {
  campaignId: string
  campaignName: string
  accountId: string
  accountName: string
  type: 'pause' | 'reduce_budget' | 'scale' | 'refresh_creative' | 'review'
  priority: 'high' | 'medium' | 'low'
  reason: string
  actionData: Record<string, unknown>
}

export function buildRecommendations(metrics: CampaignMetrics[]): Recommendation[] {
  const recs: Recommendation[] = []

  for (const m of metrics) {
    if (m.spend < 1) continue

    const loss = m.spend - m.conversionValue

    // Burning money — ROAS < 1 with meaningful spend
    if (m.roas > 0 && m.roas < 1.0 && m.spend > 20) {
      recs.push({
        campaignId: m.campaignId, campaignName: m.campaignName,
        accountId: m.accountId, accountName: m.accountName,
        type: 'pause', priority: 'high',
        reason: `ROAS is ${m.roas.toFixed(2)}x — spending $${m.spend.toFixed(2)} but only returning $${m.conversionValue.toFixed(2)}. Losing money.`,
        actionData: {
          campaign_id: m.campaignId,
          action: 'pause',
          metrics: { spend: m.spend, roas: m.roas, cpa: m.cpa, conversions: m.conversions, conversion_value: m.conversionValue, frequency: m.frequency, impressions: m.impressions },
          what_is_wrong: `This campaign is losing $${loss.toFixed(2)} — for every $1 spent you are getting back $${m.roas.toFixed(2)} in revenue. With ${m.conversions} conversion${m.conversions !== 1 ? 's' : ''} at a CPA of $${m.cpa > 0 ? m.cpa.toFixed(2) : 'N/A'}, the economics do not work at current spend levels.`,
          what_will_happen: `Remi will call the Meta API and set this campaign status to PAUSED. Spend will stop immediately. No budget changes will be made — the campaign can be resumed manually in Meta Ads Manager when creative or targeting is updated.`,
          expected_outcome: `Stop the bleeding. Estimated daily savings based on current spend rate: ~$${(m.spend).toFixed(2)}/day.`,
          execution: 'automatic',
        },
      })
    }

    // Low ROAS but not losing money — reduce budget
    if (m.roas >= 1.0 && m.roas < 1.8 && m.spend > 50) {
      const reducedBudget = m.spend * 0.6
      const savings       = m.spend - reducedBudget
      recs.push({
        campaignId: m.campaignId, campaignName: m.campaignName,
        accountId: m.accountId, accountName: m.accountName,
        type: 'reduce_budget', priority: 'medium',
        reason: `ROAS is ${m.roas.toFixed(2)}x — marginal returns on $${m.spend.toFixed(2)} spend. Reduce budget until creative is refreshed.`,
        actionData: {
          campaign_id: m.campaignId,
          action: 'reduce_budget',
          metrics: { spend: m.spend, roas: m.roas, cpa: m.cpa, conversions: m.conversions, frequency: m.frequency },
          recommended_action: `Reduce daily budget by 40% — from ~$${m.spend.toFixed(2)} to ~$${reducedBudget.toFixed(2)}/day`,
          recommended_budget: reducedBudget.toFixed(2),
          budget_reduction: savings.toFixed(2),
          projected_savings: savings.toFixed(2),
          what_is_wrong: `ROAS of ${m.roas.toFixed(2)}x is below the 1.8x healthy threshold. You are generating some return but not enough to justify the current spend level. CPA is $${m.cpa > 0 ? m.cpa.toFixed(2) : 'N/A'} with ${m.conversions} conversion${m.conversions !== 1 ? 's' : ''}.`,
          what_will_happen: `Go to Meta Ads Manager → this campaign → Edit Budget. Reduce the daily budget by 40% to ~$${reducedBudget.toFixed(2)}/day. This preserves the campaign and keeps it in Meta's algorithm while cutting wasted spend. Do not pause — pausing resets the learning phase.`,
          expected_outcome: `Save ~$${savings.toFixed(2)}/day in wasted spend while keeping the campaign alive. Monitor ROAS for 3-5 days. If it improves, gradually increase budget. If it stays flat or drops, pause the campaign and refresh the creative before restarting.`,
          execution: 'manual',
        },
      })
    }

    // Strong performer — scale it
    if (m.roas >= 3.0 && m.spend > 30) {
      const dailySpend   = m.spend   // spend over the synced period (best proxy we have)
      const increase25   = dailySpend * 0.25
      const newBudget    = dailySpend + increase25
      const addedRevenue = increase25 * m.roas
      recs.push({
        campaignId: m.campaignId, campaignName: m.campaignName,
        accountId: m.accountId, accountName: m.accountName,
        type: 'scale', priority: 'high',
        reason: `ROAS is ${m.roas.toFixed(2)}x with $${m.spend.toFixed(2)} spend. Strong performer — increase budget to capture more volume.`,
        actionData: {
          campaign_id: m.campaignId,
          action: 'scale',
          metrics: { spend: m.spend, roas: m.roas, cpa: m.cpa, conversions: m.conversions, conversion_value: m.conversionValue, frequency: m.frequency },
          recommended_action: `Increase daily budget by 25% — from ~$${dailySpend.toFixed(2)} to ~$${newBudget.toFixed(2)}/day`,
          recommended_budget: newBudget.toFixed(2),
          budget_increase: increase25.toFixed(2),
          projected_added_revenue: addedRevenue.toFixed(2),
          what_is_wrong: `Nothing is wrong — this campaign is a winner. At ${m.roas.toFixed(2)}x ROAS it is generating $${m.conversionValue.toFixed(2)} from $${m.spend.toFixed(2)} in spend. Frequency is ${m.frequency.toFixed(1)}x which means the audience is not yet fatigued.`,
          what_will_happen: `Go to Meta Ads Manager → this campaign → Edit Budget. Increase the daily budget by 25% to ~$${newBudget.toFixed(2)}/day. Do not increase by more than 25% at once — larger jumps force Meta's algorithm back into the learning phase, which can tank performance for 7-14 days.`,
          expected_outcome: `The additional $${increase25.toFixed(2)}/day in spend should generate ~$${addedRevenue.toFixed(2)}/day in additional revenue at the current ${m.roas.toFixed(2)}x ROAS. Monitor for 3 days — if ROAS holds, scale again by another 20-25%.`,
          execution: 'manual',
        },
      })
    }

    // Creative fatigue — high frequency
    if (m.frequency > 3.5 && m.impressions > 1000) {
      recs.push({
        campaignId: m.campaignId, campaignName: m.campaignName,
        accountId: m.accountId, accountName: m.accountName,
        type: 'refresh_creative', priority: m.frequency > 5 ? 'high' : 'medium',
        reason: `Frequency is ${m.frequency.toFixed(1)}x — audience is seeing the same ad too often. Creative fatigue setting in.`,
        actionData: {
          campaign_id: m.campaignId,
          action: 'refresh_creative',
          metrics: { spend: m.spend, roas: m.roas, frequency: m.frequency, impressions: m.impressions, reach: m.reach, ctr: m.ctr },
          what_is_wrong: `Your audience of ${m.reach.toLocaleString()} people has seen this ad an average of ${m.frequency.toFixed(1)} times. Above 3.5x frequency, ad fatigue sets in — CTR drops, CPM rises, and ROAS deteriorates. ${m.frequency > 5 ? 'At ' + m.frequency.toFixed(1) + 'x this is critical.' : ''}`,
          what_will_happen: `This is a creative team action. Upload 2-3 new ad creatives to this campaign in Meta Ads Manager. Do not change targeting or budget — only swap the creative. Meta will automatically optimize toward the best performer. Consider: new hook, different visual style, or new offer angle.`,
          expected_outcome: `Fresh creative typically resets CTR and reduces CPM within 3-5 days as Meta finds the best placements for the new ads. Watch frequency — it should reset below 2x as new creative rolls out.`,
          execution: 'manual',
        },
      })
    }

    // High CPA — needs attention
    if (m.cpa > 100 && m.conversions > 0 && m.roas < 2) {
      recs.push({
        campaignId: m.campaignId, campaignName: m.campaignName,
        accountId: m.accountId, accountName: m.accountName,
        type: 'review', priority: 'medium',
        reason: `CPA is $${m.cpa.toFixed(2)} — above $100 target. Review audience targeting and ad creative.`,
        actionData: {
          campaign_id: m.campaignId,
          action: 'review',
          metrics: { spend: m.spend, roas: m.roas, cpa: m.cpa, conversions: m.conversions, ctr: m.ctr, cpm: m.cpm },
          what_is_wrong: `Cost per acquisition is $${m.cpa.toFixed(2)} with ${m.conversions} conversion${m.conversions !== 1 ? 's' : ''} from $${m.spend.toFixed(2)} in spend. CTR is ${(m.ctr).toFixed(2)}% and CPM is $${m.cpm.toFixed(2)}. High CPA can signal: wrong audience, weak offer, or poor landing page conversion rate.`,
          what_will_happen: `This is a review action. Check three things in Meta Ads Manager: (1) Audience — is it too broad or too narrow? (2) Creative — is the hook aligned with what the landing page promises? (3) Landing page — what is the conversion rate from click to purchase/lead?`,
          expected_outcome: `Identify the bottleneck causing high CPA. If it is audience — narrow or shift. If it is creative — test a new angle. If it is the landing page — that is outside of Meta and needs to be fixed on-site.`,
          execution: 'manual',
        },
      })
    }
  }

  const order = { high: 0, medium: 1, low: 2 }
  return recs.sort((a, b) => order[a.priority] - order[b.priority])
}

export async function saveRecommendations(recs: Recommendation[]) {
  for (const r of recs) {
    await db`
      INSERT INTO remi_recommendations (account_id, account_name, campaign_id, campaign_name, type, priority, reason, action_data)
      VALUES (${r.accountId}, ${r.accountName}, ${r.campaignId}, ${r.campaignName}, ${r.type}, ${r.priority}, ${r.reason}, ${JSON.stringify(r.actionData)})`
  }
}

// ── Heartbeat report via Ollama ───────────────────────────────────
export async function generateHeartbeat(metrics: CampaignMetrics[], recs: Recommendation[]): Promise<string> {
  const skill = await readAgentSkill('remi')
  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0)
  const totalConvValue = metrics.reduce((s, m) => s + m.conversionValue, 0)
  const overallRoas = totalSpend > 0 ? totalConvValue / totalSpend : 0
  const totalConversions = metrics.reduce((s, m) => s + m.conversions, 0)

  const summary = metrics.map(m =>
    `- ${m.accountName} / ${m.campaignName}: $${m.spend.toFixed(2)} spend, ROAS ${m.roas.toFixed(2)}x, CPA $${m.cpa > 0 ? m.cpa.toFixed(2) : 'N/A'}, freq ${m.frequency.toFixed(1)}x`
  ).join('\n')

  const prompt = `You are Remi, the Meta Ads Intelligence agent for TheoSYN Labs.
${skill ? `\n## Your Skill File (methodology & rules)\n${skill}\n` : ''}
Write a concise daily ad performance report in markdown. Be direct and data-driven.

Overall: $${totalSpend.toFixed(2)} total spend | ${overallRoas.toFixed(2)}x blended ROAS | ${totalConversions} conversions | $${totalConvValue.toFixed(2)} revenue

Campaign breakdown:
${summary}

Top recommendations queued:
${recs.slice(0, 3).map(r => `- [${r.priority.toUpperCase()}] ${r.campaignName}: ${r.reason}`).join('\n') || '- None — all campaigns performing within range'}

Write 3-4 short sections: Overall Performance, Winners, Concerns, Action Queue. Keep it tight — this goes into an executive dashboard.`

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Remi', model: OLLAMA_MODEL, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response?.trim() ?? ''
}

// ── Execute approved actions ──────────────────────────────────────
export async function executePause(campaignId: string): Promise<void> {
  const params = new URLSearchParams({ access_token: ACCESS_TOKEN, status: 'PAUSED' })
  const res = await fetch(`${GRAPH_URL}/${campaignId}?${params}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to pause campaign ${campaignId}: ${await res.text()}`)
}
