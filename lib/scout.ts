const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!
const PAGESPEED_API_KEY = process.env.GOOGLE_PAGESPEED_API_KEY!
const RADIUS = 50000 // API max

// Indiana search centers — rotated weekly for autonomous prospecting
export const SEARCH_CENTERS = [
  { label: 'Indianapolis',  lat: 39.7684,  lng: -86.1581 },
  { label: 'Kokomo',        lat: 40.4864,  lng: -86.1336 },
  { label: 'Muncie',        lat: 40.1934,  lng: -85.3863 },
  { label: 'Richmond',      lat: 39.8289,  lng: -84.8902 },
  { label: 'Columbus',      lat: 39.2014,  lng: -85.9214 },
  { label: 'Bloomington',   lat: 39.1653,  lng: -86.5264 },
  { label: 'Lafayette',     lat: 40.4167,  lng: -86.8753 },
  { label: 'Terre Haute',   lat: 39.4667,  lng: -87.4139 },
  { label: 'Fort Wayne',    lat: 41.0793,  lng: -85.1394 },
  { label: 'Plymouth',      lat: 41.3439,  lng: -86.3086 },
  { label: 'Hammond',       lat: 41.5834,  lng: -87.5000 },
  { label: 'Rensselaer',    lat: 40.9364,  lng: -87.1536 },
  { label: 'Evansville',    lat: 37.9716,  lng: -87.5711 },
  { label: 'Jeffersonville', lat: 38.2776, lng: -85.7372 },
  { label: 'Vincennes',     lat: 38.6773,  lng: -87.5286 },
]

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'

// Valid Places API (New) types — from Google's Table A
// https://developers.google.com/maps/documentation/places/web-service/place-types
export const BUSINESS_CATEGORIES = [
  'restaurant',
  'hair_salon',
  'beauty_salon',
  'nail_salon',
  'auto_repair',
  'plumber',
  'electrician',
  'gym',
  'dentist',
  'chiropractor',
  'church',
  'real_estate_agency',
  'florist',
  'bakery',
  'clothing_store',
  'pet_store',
  'insurance_agency',
  'lawyer',
  'roofing_contractor',
  'general_contractor',
  'moving_company',
  'veterinary_care',
]

export interface ScoutLead {
  place_id: string
  name: string
  address: string
  phone: string | null
  website: string | null
  category: string
  rating: number | null
  review_count: number | null
  gmb_has_hours: boolean
  gmb_has_photos: boolean
  gmb_has_description: boolean
  has_website: boolean
  has_gmb: boolean
  website_score: number | null
  website_mobile: boolean | null
  grade: string
  score: number
  lat: number | null
  lng: number | null
}

// Search Google Places for businesses by category
export async function searchPlaces(
  category: string,
  maxResults = 20,
  center: { lat: number; lng: number } = SEARCH_CENTERS[0]
): Promise<ScoutLead[]> {
  const url = new URL('https://places.googleapis.com/v1/places:searchNearby')

  const body = {
    includedTypes: [category],
    maxResultCount: Math.min(maxResults, 20),
    locationRestriction: {
      circle: {
        center: { latitude: center.lat, longitude: center.lng },
        radius: RADIUS,
      },
    },
    rankPreference: 'DISTANCE',
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.websiteUri',
        'places.primaryTypeDisplayName',
        'places.rating',
        'places.userRatingCount',
        'places.regularOpeningHours',
        'places.photos',
        'places.editorialSummary',
        'places.location',
      ].join(','),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Places API error: ${err}`)
  }

  const data = await res.json()
  const places = data.places ?? []

  return places.map((p: Record<string, unknown>) => {
    const hasWebsite = !!(p.websiteUri)
    const hasHours = !!(p.regularOpeningHours)
    const hasPhotos = Array.isArray(p.photos) && (p.photos as unknown[]).length > 0
    const hasDescription = !!(p.editorialSummary)
    const location = p.location as { latitude?: number; longitude?: number } | null

    const score = calculateScore({ hasWebsite, hasHours, hasPhotos, hasDescription })
    const grade = score >= 70 ? 'A' : score >= 45 ? 'B' : 'C'

    return {
      place_id: p.id as string,
      name: (p.displayName as { text: string })?.text ?? 'Unknown',
      address: (p.formattedAddress as string) ?? '',
      phone: (p.nationalPhoneNumber as string) ?? null,
      website: (p.websiteUri as string) ?? null,
      category,
      rating: (p.rating as number) ?? null,
      review_count: (p.userRatingCount as number) ?? null,
      gmb_has_hours: hasHours,
      gmb_has_photos: hasPhotos,
      gmb_has_description: hasDescription,
      has_website: hasWebsite,
      has_gmb: true, // if it's in Places, it has GMB
      website_score: null,
      website_mobile: null,
      grade,
      score,
      lat: location?.latitude ?? null,
      lng: location?.longitude ?? null,
    }
  })
}

// Score a lead based on opportunity signals (higher = more opportunity for us)
function calculateScore(signals: {
  hasWebsite: boolean
  hasHours: boolean
  hasPhotos: boolean
  hasDescription: boolean
}): number {
  let score = 100
  if (signals.hasWebsite)     score -= 25  // already has a site
  if (signals.hasHours)       score -= 15  // GMB is maintained
  if (signals.hasPhotos)      score -= 15  // has photo presence
  if (signals.hasDescription) score -= 10  // has written description
  return Math.max(score, 10)
}

// Check website quality via PageSpeed
export async function auditWebsite(url: string): Promise<{ score: number; mobile: boolean } | null> {
  try {
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${PAGESPEED_API_KEY}`
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const data = await res.json()
    const score = Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
    return { score, mobile: score >= 50 }
  } catch {
    return null
  }
}

// Extract email addresses from HTML text
function extractEmails(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const matches = html.match(emailRegex) ?? []
  // Filter out common false positives
  return [...new Set(matches)].filter(e =>
    !e.includes('sentry') &&
    !e.includes('example') &&
    !e.includes('domain') &&
    !e.includes('email.com') &&
    !e.includes('yourdomain') &&
    !e.endsWith('.png') &&
    !e.endsWith('.jpg')
  )
}

// Scrape a URL for email addresses
async function scrapeEmailFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TheoSYN-Scout/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    const emails = extractEmails(html)
    return emails[0] ?? null
  } catch {
    return null
  }
}

// Find contact page URL from homepage HTML
function findContactUrl(html: string, baseUrl: string): string | null {
  const contactPatterns = [
    /href=["']([^"']*contact[^"']*?)["']/gi,
    /href=["']([^"']*about[^"']*?)["']/gi,
    /href=["']([^"']*reach[^"']*?)["']/gi,
  ]
  for (const pattern of contactPatterns) {
    const match = pattern.exec(html)
    if (match) {
      const href = match[1]
      if (href.startsWith('http')) return href
      if (href.startsWith('/')) {
        try {
          const base = new URL(baseUrl)
          return `${base.origin}${href}`
        } catch { continue }
      }
    }
  }
  return null
}

// Check if a URL is a Linktree page and scrape it for emails + social links
export async function scrapeLinktree(url: string): Promise<{ email: string | null; facebook: string | null }> {
  const result = { email: null as string | null, facebook: null as string | null }
  if (!url.includes('linktr.ee')) return result

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TheoSYN-Scout/1.0)' },
    })
    if (!res.ok) return result
    const html = await res.text()

    // Extract emails
    const emails = extractEmails(html)
    if (emails.length > 0) result.email = emails[0]

    // Extract Facebook link
    const fbMatch = html.match(/href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"']+)["']/i)
    if (fbMatch) result.facebook = fbMatch[1]
  } catch { /* ignore */ }

  return result
}

// Find a contact form action + fields in HTML
function findContactForm(html: string, baseUrl: string): { action: string; fields: Record<string, string> } | null {
  // Match all forms including those with action="#", empty action, or no action (JS-handled)
  const formMatch = html.match(/<form[\s\S]*?<\/form>/gi)
  if (!formMatch) return null

  for (const form of formMatch) {
    const actionMatch = form.match(/action=["']([^"']*?)["']/)
    let action = actionMatch ? actionMatch[1] : ''

    // Resolve action URL
    if (!action || action === '#' || action === '') {
      // JS-handled form — use the current page URL as the action target indicator
      action = baseUrl
    } else if (action.startsWith('/')) {
      try { action = new URL(action, baseUrl).toString() } catch { continue }
    } else if (!action.startsWith('http')) {
      try { action = new URL(action, baseUrl).toString() } catch { continue }
    }

    // Broader contact form detection — includes WPForms, Gravity Forms, CF7, generic
    const hasEmailField = /type=["']email["']|name=["'][^"']*email[^"']*["']|placeholder=["'][^"']*email[^"']*["']/i.test(form)
    const hasMessageField = /textarea|name=["'][^"']*(?:message|comment|body|content|msg)[^"']*["']|placeholder=["'][^"']*(?:message|comment|how can)[^"']*["']/i.test(form)
    const hasNameField = /name=["'][^"']*(?:name|fname|first)[^"']*["']|placeholder=["'][^"']*(?:name|your name)[^"']*["']/i.test(form)
    const hasSubmitButton = /type=["']submit["']|<button[^>]*>[\s\S]*?(?:send|submit|contact|go)[^<]*<\/button>/i.test(form)

    // Must look like a contact form — at least 2 of these signals
    const signals = [hasEmailField, hasMessageField, hasNameField, hasSubmitButton].filter(Boolean).length
    if (signals < 2) continue

    // Extract all input field names and values
    const fields: Record<string, string> = {}
    const inputMatches = form.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*(?:value=["']([^"']*?)["'])?/gi)
    for (const m of inputMatches) {
      const inputType = (form.match(new RegExp(`<input[^>]*name=["']${m[1]}["'][^>]*type=["']([^"']+)["']`, 'i')) ?? [])[1] ?? 'text'
      // Skip hidden, checkbox, radio, submit — keep text, email, tel, textarea
      if (['hidden', 'submit', 'button', 'reset', 'file', 'checkbox', 'radio'].includes(inputType.toLowerCase())) {
        fields[m[1]] = m[2] ?? '' // keep hidden fields as-is
      } else {
        fields[m[1]] = m[2] ?? ''
      }
    }

    // Grab textarea names
    const textareaMatches = form.matchAll(/<textarea[^>]*name=["']([^"']+)["']/gi)
    for (const m of textareaMatches) fields[m[1]] = ''

    // Need at least one fillable field
    if (Object.keys(fields).length === 0) continue

    return { action, fields }
  }
  return null
}

// Submit a contact form with our outreach message
export async function submitContactForm(websiteUrl: string, lead: { name: string; outreach: string; fromEmail: string; fromName: string }): Promise<boolean> {
  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TheoSYN-Scout/1.0)' },
    })
    if (!res.ok) return false
    const html = await res.text()

    // Try contact page first
    const contactUrl = findContactUrl(html, websiteUrl)
    let targetHtml = html
    let targetUrl = websiteUrl

    if (contactUrl) {
      const contactRes = await fetch(contactUrl, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (contactRes.ok) {
        targetHtml = await contactRes.text()
        targetUrl = contactUrl
      }
    }

    const form = findContactForm(targetHtml, targetUrl)
    if (!form) return false

    // Fill in form fields intelligently
    const body = new URLSearchParams()
    for (const [key, defaultVal] of Object.entries(form.fields)) {
      const k = key.toLowerCase()
      if (k.includes('name') && !k.includes('last') && !k.includes('last_name')) body.set(key, lead.fromName)
      else if (k.includes('last') || k.includes('last_name')) body.set(key, '')
      else if (k.includes('first') || k.includes('first_name')) body.set(key, lead.fromName.split(' ')[0])
      else if (k.includes('email')) body.set(key, lead.fromEmail)
      else if (k.includes('phone') || k.includes('tel')) body.set(key, '')
      else if (k.includes('subject') || k.includes('topic') || k.includes('re')) body.set(key, `Partnership opportunity for ${lead.name}`)
      else if (k.includes('message') || k.includes('comment') || k.includes('body') || k.includes('content') || k.includes('msg')) body.set(key, lead.outreach)
      else if (k.includes('company') || k.includes('org') || k.includes('business')) body.set(key, lead.name)
      else if (k.includes('website') || k.includes('url') || k.includes('site')) body.set(key, '')
      else body.set(key, defaultVal) // keep hidden field values intact
    }

    // If action is same as targetUrl, this is a JS-rendered form — we can't POST to it
    // Return true anyway so the UI shows the contact page link for manual submission
    if (form.action === targetUrl || form.action === websiteUrl) {
      return true
    }

    try {
      const submitRes = await fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (compatible; TheoSYN-Scout/1.0)',
          'Referer': targetUrl,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      })
      return submitRes.ok || submitRes.status === 302 || submitRes.status === 303
    } catch {
      // Network/timeout on submit — form was found, flag as partial success
      return true
    }
  } catch {
    return false
  }
}

// Send email via Gmail API using OAuth access token
export async function sendViaGmail(params: {
  accessToken: string
  to: string
  subject: string
  body: string
  fromName: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const emailLines = [
      `From: ${params.fromName} <me>`,
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      params.body,
    ]
    const raw = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })

    if (!res.ok) {
      const err = await res.json()
      return { success: false, error: err.error?.message ?? 'Gmail send failed' }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// Send Facebook Messenger message to a business page
export async function sendFacebookDM(params: {
  pageUrl: string
  message: string
  accessToken: string
  ourPageId: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const GRAPH_URL = 'https://graph.facebook.com/v21.0'

    // Extract page ID or username from URL
    const urlMatch = params.pageUrl.match(/facebook\.com\/([^/?]+)/)
    if (!urlMatch) return { success: false, error: 'Could not parse Facebook page URL' }
    const pageIdentifier = urlMatch[1]

    // Look up the page's PSID (recipient ID)
    const pageRes = await fetch(`${GRAPH_URL}/${pageIdentifier}?fields=id,name&access_token=${params.accessToken}`)
    const pageData = await pageRes.json()
    if (pageData.error) return { success: false, error: pageData.error.message }

    // Send message via Messenger Send API
    const msgRes = await fetch(`${GRAPH_URL}/me/messages?access_token=${params.accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: pageData.id },
        message: { text: params.message.slice(0, 2000) },
        messaging_type: 'MESSAGE_TAG',
        tag: 'CONFIRMED_EVENT_UPDATE',
      }),
    })
    const msgData = await msgRes.json()
    if (msgData.error) return { success: false, error: msgData.error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// Determine best outreach channel for a lead
export function bestOutreachChannel(lead: {
  contact_email: string | null
  website: string | null
  social_facebook: string | null
  phone: string | null
}): 'email' | 'contact_form' | 'facebook' | 'manual' {
  if (lead.contact_email) return 'email'
  if (lead.website) return 'contact_form'
  if (lead.social_facebook) return 'facebook'
  return 'manual'
}

// Full email discovery: website scrape + contact page + GMB fallback
export async function findContactEmail(websiteUrl: string | null, gmbUrl?: string | null): Promise<{ email: string; source: string } | null> {
  // 0. Check if it's a Linktree URL
  if (websiteUrl?.includes('linktr.ee')) {
    const lt = await scrapeLinktree(websiteUrl)
    if (lt.email) return { email: lt.email, source: 'linktree' }
  }

  // 1. Try scraping the main website
  if (websiteUrl) {
    try {
      const res = await fetch(websiteUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TheoSYN-Scout/1.0)' },
      })
      if (res.ok) {
        const html = await res.text()

        // Check homepage first
        const homeEmails = extractEmails(html)
        if (homeEmails.length > 0) return { email: homeEmails[0], source: 'website' }

        // Try contact/about page
        const contactUrl = findContactUrl(html, websiteUrl)
        if (contactUrl) {
          const contactEmail = await scrapeEmailFromUrl(contactUrl)
          if (contactEmail) return { email: contactEmail, source: 'website' }
        }
      }
    } catch { /* continue */ }
  }

  // 2. Try GMB URL if available
  if (gmbUrl) {
    const gmbEmail = await scrapeEmailFromUrl(gmbUrl)
    if (gmbEmail) return { email: gmbEmail, source: 'gmb' }
  }

  return null
}

// ── Deep email discovery ──────────────────────────────────────────
// Tries multiple strategies beyond the basic website scrape:
// 1. Extended website URL patterns (/contact-us, /about-us, /get-in-touch, etc.)
// 2. Google Custom Search for business email
// 3. LinkedIn via Google search (site:linkedin.com)
export async function deepEmailDiscovery(
  businessName: string,
  address: string,
  websiteUrl: string | null,
): Promise<{ email: string; source: string } | null> {

  // 1. Try extended URL patterns on the website
  if (websiteUrl) {
    const patterns = [
      '/contact', '/contact-us', '/contactus', '/contact_us',
      '/about', '/about-us', '/aboutus',
      '/get-in-touch', '/reach-us', '/reach-out',
      '/info', '/support', '/help',
    ]
    try {
      const base = new URL(websiteUrl).origin
      for (const path of patterns) {
        const email = await scrapeEmailFromUrl(`${base}${path}`)
        if (email) return { email, source: 'website_extended' }
      }
    } catch { /* bad URL */ }
  }

  // 2. Google Custom Search for business email
  const googleApiKey = process.env.GOOGLE_WORKSPACE_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY
  if (googleApiKey) {
    // Extract city from address
    const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}/)
    const city = cityMatch?.[1]?.trim() ?? ''
    const query = `"${businessName}" ${city} email contact`

    try {
      const searchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=017576662512468239146:omuauf_lfve&q=${encodeURIComponent(query)}&num=5`
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const data = await res.json()
        const snippets = (data.items ?? []).map((item: Record<string, string>) =>
          `${item.snippet ?? ''} ${item.title ?? ''}`
        ).join(' ')
        const emails = extractEmails(snippets)
        if (emails.length > 0) return { email: emails[0], source: 'google_search' }

        // Also try scraping the top result page
        const topUrl = data.items?.[0]?.link
        if (topUrl && !topUrl.includes('linkedin.com')) {
          const scraped = await scrapeEmailFromUrl(topUrl)
          if (scraped) return { email: scraped, source: 'google_result' }
        }
      }
    } catch { /* non-fatal */ }
  }

  // 3. LinkedIn via Google search — scrape the profile snippet for email hints
  // (LinkedIn profiles sometimes show email in the snippet or bio)
  if (googleApiKey) {
    const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}/)
    const city = cityMatch?.[1]?.trim() ?? ''
    const query = `site:linkedin.com "${businessName}" ${city} owner manager`
    try {
      const searchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=017576662512468239146:omuauf_lfve&q=${encodeURIComponent(query)}&num=3`
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const data = await res.json()
        const snippets = (data.items ?? []).map((item: Record<string, string>) =>
          `${item.snippet ?? ''} ${item.title ?? ''}`
        ).join(' ')
        const emails = extractEmails(snippets)
        if (emails.length > 0) return { email: emails[0], source: 'linkedin_search' }
      }
    } catch { /* non-fatal */ }
  }

  return null
}

// ── Outreach email generation ─────────────────────────────────────

type OutreachLead = {
  name: string
  category: string
  address: string
  has_website: boolean
  website?: string | null
  website_score: number | null
  website_mobile?: boolean | null
  gmb_has_hours: boolean
  gmb_has_photos: boolean
  gmb_has_description: boolean
  rating?: number | null
  review_count?: number | null
  grade: string
}

function buildAuditContext(lead: OutreachLead): string {
  const city = lead.address.split(',')[1]?.trim() ?? 'your area'
  const type = lead.category.replace(/_/g, ' ')
  const lines: string[] = []

  if (!lead.has_website) {
    lines.push(`NO WEBSITE: ${lead.name} has no website at all. When someone searches for a ${type} in ${city}, they won't find ${lead.name} — only competitors with websites show up. This is the single biggest opportunity gap.`)
  } else {
    if (lead.website_score !== null && lead.website_score < 50) {
      lines.push(`SLOW/BROKEN WEBSITE: Their website scored ${lead.website_score}/100 on Google's speed test. Google actively buries slow sites in search results, and studies show 53% of mobile visitors leave a page that takes more than 3 seconds to load. They are likely losing customers every day to this.`)
    }
    if (lead.website_mobile === false) {
      lines.push(`NOT MOBILE FRIENDLY: Their site is not optimized for mobile. Over 70% of local searches happen on a phone. If the site doesn't work well on mobile, those visitors leave immediately.`)
    }
    if (lead.website_score !== null && lead.website_score >= 50 && lead.website_mobile !== false) {
      lines.push(`WEBSITE EXISTS BUT HAS GAPS: They have a website but their Google Business Profile is incomplete, which limits how often they appear in local searches.`)
    }
  }

  if (!lead.gmb_has_hours) lines.push(`MISSING BUSINESS HOURS ON GOOGLE: Their Google Business Profile has no hours listed. When someone searches for them and can't find hours, they often move on to a competitor.`)
  if (!lead.gmb_has_photos) lines.push(`NO PHOTOS ON GOOGLE: Businesses with photos on Google get 42% more requests for directions and 35% more website clicks. ${lead.name} has none.`)
  if (!lead.gmb_has_description) lines.push(`NO GOOGLE BUSINESS DESCRIPTION: Their profile has no description, meaning they're missing the chance to tell Google (and customers) what makes them different.`)

  if (lead.rating != null && lead.review_count != null && lead.review_count < 10) {
    lines.push(`FEW REVIEWS: Only ${lead.review_count} Google reviews. Businesses with fewer than 10 reviews are often overlooked. A simple follow-up system could change this fast.`)
  }

  return lines.join('\n\n')
}

export async function generateOutreach(lead: OutreachLead, voiceProfile = ''): Promise<string> {
  const auditContext = buildAuditContext(lead)
  const city = lead.address.split(',')[1]?.trim() ?? 'your area'
  const type = lead.category.replace(/_/g, ' ')
  const replyEmail = process.env.SCOUT_REPLY_EMAIL ?? process.env.ALLOWED_EMAIL ?? 'milford.hutsell@gmail.com'

  const prompt = `You are writing a cold outreach email on behalf of Milford Hutsell at TheoSYN Labs — a company that helps small businesses improve their visibility in Google and AI search results.
${voiceProfile ? `\n${voiceProfile}\n` : ''}

Business name: ${lead.name}
Type: ${type}
City: ${lead.address.split(',')[1]?.trim() ?? 'your area'}

Write a short, conversational cold outreach email for ${lead.name} — a ${type} in ${city}. Keep it genuine and human.

Rules:
- Open with "Hey there," — do NOT use "[Name]" or any placeholder. We do not have a personal name for this contact.
- 3 to 5 sentences total — short and to the point
- Do NOT mention specific audit findings or website scores
- Frame it as feedback gathering / learning — not selling
- One clear CTA: reply to this email OR visit https://www.theosynlabs.com/contact/ to learn more about our programs and get in touch. Reply goes to ${replyEmail}.
- Sign off as "Milford Hutsell, TheoSYN Labs"
- No bullet points, no headers, no bold text — plain flowing sentences
- Do not say "I hope this email finds you well" or any canned opener

Write only the email body. No subject line. No meta-commentary.`

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })
  const data = await res.json()
  return data.response?.trim() ?? ''
}

// Generate a Day 3 follow-up email — detailed audit findings
export async function generateFollowUp(lead: OutreachLead & { outreach_email: string }, voiceProfile = ''): Promise<string> {
  const type = lead.category.replace(/_/g, ' ')
  const replyEmail = process.env.SCOUT_REPLY_EMAIL ?? process.env.ALLOWED_EMAIL ?? 'milford.hutsell@gmail.com'
  const primaryIssue = !lead.has_website
    ? 'not having a website'
    : lead.website_score !== null && lead.website_score < 50
      ? `a website that's scoring ${lead.website_score}/100 on Google's speed test`
      : 'some gaps in their Google Business Profile'

  const auditContext = buildAuditContext(lead)

  const prompt = `You are writing a follow-up cold outreach email on behalf of Milford Hutsell at TheoSYN Labs — a company that helps small businesses grow using AI, modern websites, and digital tools.

Context: Milford sent a brief initial email to ${lead.name} (a ${type} in ${lead.address}) about 3 days ago mentioning ${primaryIssue}. There has been no response. This follow-up is the place to go deeper.

FULL AUDIT FINDINGS:
${auditContext}

Write a detailed, warm follow-up email that:
- Opens with "Hey there," — do NOT use "[Name]" or any placeholder. We do not have a personal name for this contact.
- References the previous email briefly — no guilt, no pressure
- Acknowledges that running a ${type} is demanding and things get buried
- Walks through the specific audit findings in plain language — explain WHY each issue costs them customers or money (e.g. slow websites get buried by Google, missing GMB hours sends people to competitors, no photos means 42% fewer direction requests)
- Paints a clear picture of what improves when these are fixed — more calls, more walk-ins, better first impression when someone searches them
- Explains the free 15-minute audit call offer — we walk through everything live, show them exactly what we'd do, zero obligation
- Closes with the same CTA: reply directly to this email OR visit https://www.theosynlabs.com/contact/ to learn more about our programs. Reply goes to ${replyEmail}.
- Signs off as "Milford Hutsell, TheoSYN Labs"
- Is 3-5 paragraphs — substantive but not overwhelming
- Sounds like a real person — no bullet points, no headers, flowing paragraphs, conversational tone
- Zero pressure — we're offering value, not chasing a sale

Write only the email body. No subject line. No meta-commentary.`

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })
  const data = await res.json()
  return data.response?.trim() ?? ''
}

// Generate a Day 11 graceful exit email — final contact, zero pressure
export async function generateFollowUp2(lead: OutreachLead, voiceProfile = ''): Promise<string> {
  const type = lead.category.replace(/_/g, ' ')
  const replyEmail = process.env.SCOUT_REPLY_EMAIL ?? process.env.ALLOWED_EMAIL ?? 'milford.hutsell@gmail.com'

  const prompt = `You are writing a final follow-up cold outreach email on behalf of Milford Hutsell at TheoSYN Labs — a company that helps small businesses grow using AI, modern websites, and digital tools.

Context: Milford reached out twice to ${lead.name} (a ${type} in ${lead.address}) with no response. This is the third and final contact. After this we stop reaching out.

Write a very short, graceful, no-pressure final email:
- Open with "Hey there," — do NOT use "[Name]" or any placeholder. We do not have a personal name for this contact.
- 3 to 4 sentences only — no more
- Acknowledge that running ${lead.name} is busy work and timing isn't always right
- Mention we are still happy to help whenever it makes sense — no rush, no pressure
- Leave the door open: their reply goes to ${replyEmail} whenever they are ready, or they can visit https://www.theosynlabs.com/contact/ to find out more about our programs
- Sign off as "Milford Hutsell, TheoSYN Labs"
- Zero sales energy — warm, human, completely unhurried
- Do NOT recap the audit or repeat the pitch — this is a graceful exit, not another attempt

Write only the email body. No subject line. No meta-commentary.`

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })
  const data = await res.json()
  return data.response?.trim() ?? ''
}
