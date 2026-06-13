import { GoogleGenerativeAI } from '@google/generative-ai'
import { logTokenUsage } from '@/lib/usage'

async function gemini(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-001'
  const model = genAI.getGenerativeModel({ model: modelName })
  const result = await model.generateContent(prompt)
  const usage = result.response.usageMetadata
  if (usage) {
    logTokenUsage({ agent: 'Orion', model: modelName, provider: 'gemini', promptTokens: usage.promptTokenCount ?? 0, completionTokens: usage.candidatesTokenCount ?? 0 })
  }
  return result.response.text()
}

function parseJson<T>(text: string): T | null {
  const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

const BASE_CONTEXT = `You are Orion, a product research intelligence agent for e-commerce brands.
You specialize in competitive analysis, customer sentiment, and Meta ad strategy.
Always return structured JSON arrays as requested. Be specific, realistic, and data-driven.`

export async function extractProductName(url: string): Promise<string> {
  const text = await gemini(`${BASE_CONTEXT}
Extract a clean product name from this URL or product listing link. Return just the product name, nothing else.
URL: ${url}`)
  return text.trim().slice(0, 100)
}

export async function researchCompetitors(productName: string, brand: string): Promise<{
  company_name: string; platform: string; store_link: string
  listing_title: string; price: string; est_sales: string; rating: string
}[]> {
  const text = await gemini(`${BASE_CONTEXT}

Research the top 10 competitors selling "${productName}" similar to what ${brand} sells.
Search across Etsy, eBay, Shopify stores, and TikTok Shop.

Return a JSON array of exactly 10 objects:
[{
  "company_name": "Store or brand name",
  "platform": "Etsy|eBay|Shopify|TikTok Shop",
  "store_link": "https://... (best guess real URL)",
  "listing_title": "Actual product listing title",
  "price": "$XX.XX",
  "est_sales": "Est. monthly sales or traffic",
  "rating": "4.5/5 or equivalent"
}]

Focus on real, successful competitors. Include actual store URLs where known.`)
  return parseJson(text) ?? []
}

export async function researchPainPoints(productName: string): Promise<{
  pain_point: string; severity: string; customer_quote: string; counter_angle: string
}[]> {
  const text = await gemini(`${BASE_CONTEXT}

Research the top customer pain points, complaints, and objections for "${productName}" based on Amazon reviews, Reddit, and social media.

Return a JSON array of 8-10 objects:
[{
  "pain_point": "Specific complaint or objection",
  "severity": "High|Medium|Low",
  "customer_quote": "Example real-sounding customer quote expressing this pain",
  "counter_angle": "How to counter this in marketing copy"
}]

Be specific to this product category. Include real objections buyers have.`)
  return parseJson(text) ?? []
}

export async function researchReviews(productName: string): Promise<{
  reviewer_name: string; rating: number; category: string
  review_snippet: string; core_complaint: string; source_link: string
}[]> {
  const text = await gemini(`${BASE_CONTEXT}

Mine realistic customer reviews for "${productName}" from Amazon and similar platforms.
Base these on real review patterns for this product category.

Return a JSON array of 10-15 objects:
[{
  "reviewer_name": "First name + last initial",
  "rating": 1-5,
  "category": "Quality|Shipping|Value|Design|Usability|Durability",
  "review_snippet": "Realistic 1-2 sentence review",
  "core_complaint": "Main issue (or empty string if positive review)",
  "source_link": "https://amazon.com/s?k=${encodeURIComponent(productName)}"
}]

Mix of positive (4-5 star) and critical (1-3 star) reviews. Be specific.`)
  return parseJson(text) ?? []
}

export async function buildAdMatrix(productName: string, brand: string, painPoints: string[]): Promise<{
  adset_name: string; ad_name: string; hook: string
  primary_text: string; headline: string; description: string; meta_targets: string
}[]> {
  const painSummary = painPoints.slice(0, 5).join(', ')
  const text = await gemini(`${BASE_CONTEXT}

Create a Meta Ads ABO campaign matrix for "${productName}" by ${brand}.
Known customer pain points: ${painSummary}

Build exactly 3 adsets with 3 ads each (9 total). Each adset targets a different audience angle.

Adset angles:
1. "Problem-Aware" — targets people who know they have the problem
2. "Desire-Based" — targets people who want the outcome/transformation
3. "Social Proof" — targets people who need validation/FOMO

Return a JSON array of exactly 9 objects:
[{
  "adset_name": "Adset name with angle",
  "ad_name": "Ad 1 of 3 name",
  "hook": "Opening hook line (first 3 seconds)",
  "primary_text": "Full ad primary text (2-3 paragraphs with emojis)",
  "headline": "Short punchy headline (under 40 chars)",
  "description": "Link description (under 30 chars)",
  "meta_targets": "Specific interests, demographics, behaviors to target"
}]

Write copy that converts. Be specific to ${brand}'s aesthetic and audience.`)
  return parseJson(text) ?? []
}

export async function buildCreativeHooks(productName: string, brand: string): Promise<{
  hook_title: string; target_desire: string; hook_type: string
  on_screen_text: string; headline: string
}[]> {
  const text = await gemini(`${BASE_CONTEXT}

Generate the top 10 direct-response creative hooks for "${productName}" by ${brand}.
These are for Meta and TikTok video ads.

Hook types to use: Problem/Agitate, Curiosity Gap, Social Proof, Transformation, Controversy, How-To, Testimonial, Fear of Missing Out, Comparison, Authority

Return a JSON array of 10 objects:
[{
  "hook_title": "Hook name/angle",
  "target_desire": "Core desire or pain this targets",
  "hook_type": "Problem/Agitate|Curiosity Gap|Social Proof|Transformation|Controversy|How-To|Testimonial|FOMO|Comparison|Authority",
  "on_screen_text": "Exact text shown on screen in first 3 seconds",
  "headline": "Ad headline that reinforces this hook"
}]

Make these scroll-stopping and conversion-focused.`)
  return parseJson(text) ?? []
}

export async function researchCompetitorAds(productName: string): Promise<{
  brand_name: string; platform: string; ad_copy: string
  est_spend: string; active_days: string; ad_link: string
}[]> {
  const text = await gemini(`${BASE_CONTEXT}

Research the top 10 winning competitor ads for "${productName}" from Facebook Ad Library and TikTok.
Focus on ads that have been running long (high spend = winning creative).

Return a JSON array of 10 objects:
[{
  "brand_name": "Competitor brand/store name",
  "platform": "Facebook|TikTok",
  "ad_copy": "Sample of their ad copy or description of the creative",
  "est_spend": "Low|Medium|High|Very High (based on how long it has run)",
  "active_days": "Estimated days active",
  "ad_link": "https://www.facebook.com/ads/library/?q=${encodeURIComponent(productName)} or TikTok equivalent"
}]

Focus on ads that are clearly winning (long-running, high engagement signals).`)
  return parseJson(text) ?? []
}
