import { logTokenUsage } from '@/lib/usage'
import { LEVEL_PERKS } from '@/lib/beacon-config'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

function ghlHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': GHL_VERSION,
    'Content-Type': 'application/json',
  }
}

// ── GHL Contact ────────────────────────────────────────────────────────────

export async function createGHLContact(student: {
  name: string
  email: string
  phone?: string | null
  purchase_level: string
}): Promise<string | null> {
  const [firstName, ...rest] = student.name.trim().split(' ')
  const lastName = rest.join(' ') || ''

  const body: Record<string, unknown> = {
    locationId: process.env.GHL_LOCATION_ID,
    firstName,
    lastName,
    email: student.email,
    tags: [`beacon-${student.purchase_level.toLowerCase()}`, 'theosyn-student'],
    source: 'TheoSYN Beacon',
  }
  if (student.phone) body.phone = student.phone

  const res = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[Beacon] GHL createContact failed:', errText)
    // GHL returns the existing contactId in the error body on duplicates — use it
    try {
      const errJson = JSON.parse(errText)
      const existingId = errJson?.meta?.contactId as string | undefined
      if (existingId) {
        console.log('[Beacon] GHL duplicate — tagging existing contactId:', existingId)
        // Apply tags to the existing contact so they still get properly segmented
        await updateGHLContact(existingId, {
          tags: [`beacon-${student.purchase_level.toLowerCase()}`, 'theosyn-student'],
        })
        return existingId
      }
    } catch { /* not JSON */ }
    return null
  }

  const data = await res.json()
  return data.contact?.id ?? null
}

export async function updateGHLContact(ghlContactId: string, updates: {
  tags?: string[]
  phone?: string
}): Promise<boolean> {
  const res = await fetch(`${GHL_BASE}/contacts/${ghlContactId}`, {
    method: 'PUT',
    headers: ghlHeaders(),
    body: JSON.stringify(updates),
  })
  return res.ok
}

// ── GHL Email ──────────────────────────────────────────────────────────────

export async function sendGHLEmail(params: {
  contactId: string
  email: string
  subject: string
  body: string // HTML
}): Promise<boolean> {
  const res = await fetch(`${GHL_BASE}/conversations/messages/outbound`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({
      locationId: process.env.GHL_LOCATION_ID,
      contactId: params.contactId,
      type: 'Email',
      subject: params.subject,
      html: params.body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[Beacon] GHL sendEmail failed:', err)
  }
  return res.ok
}

// ── Welcome Message ────────────────────────────────────────────────────────

async function ollamaChat(prompt: string, model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'): Promise<string> {
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Beacon', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}


export async function generateWelcomeEmail(student: {
  name: string
  purchase_level: string
}): Promise<{ subject: string; body: string }> {
  const perks = LEVEL_PERKS[student.purchase_level] ?? 'access to our community'
  const firstName = student.name.trim().split(' ')[0]

  const prompt = `You are Beacon, the community and course agent for TheoSYN Labs.
TheoSYN Labs helps small businesses and churches use AI ethically, from a Christian perspective.
Write a warm, genuine welcome email for a new community member.

Student name: ${firstName}
Membership level: ${student.purchase_level}
What they have access to: ${perks}

The email should:
- Open with a warm, faith-informed welcome (but not preachy)
- Briefly explain what they now have access to based on their ${student.purchase_level} level
- Tell them to expect login credentials and access instructions shortly
- Invite them to reach out if they have any questions
- Be warm, personal, and brief (3 short paragraphs)
- Sign off as "Milford & The TheoSYN Team"

Return JSON with exactly two fields:
{"subject": "...", "body": "..."}
The body should be plain text (no HTML).
Write only the JSON, no other text.`

  const raw = await ollamaChat(prompt)

  try {
    const parsed = JSON.parse(raw.trim())
    return { subject: parsed.subject ?? 'Welcome to the TheoSYN Community!', body: parsed.body ?? raw }
  } catch {
    // Fallback if Ollama doesn't return clean JSON
    return {
      subject: `Welcome to the TheoSYN Community, ${firstName}!`,
      body: raw,
    }
  }
}

// ── GHL Courses / Products ─────────────────────────────────────────────────

export interface GHLProduct {
  _id: string
  title: string
  description?: string
  image?: string
  locationId: string
}

export interface GHLSubCategory {
  _id: string
  title: string
  description?: string
  productId: string
}

export async function getGHLProducts(): Promise<GHLProduct[]> {
  const res = await fetch(
    `${GHL_BASE}/memberships/products?locationId=${process.env.GHL_LOCATION_ID}&limit=50`,
    { headers: ghlHeaders() }
  )
  if (!res.ok) {
    console.error('[Beacon] getGHLProducts failed:', await res.text())
    return []
  }
  const data = await res.json()
  // GHL returns { products: [...] } or the array directly
  return data.products ?? data.data ?? data ?? []
}

export async function createGHLSubCategory(params: {
  productId: string
  title: string
  description?: string
}): Promise<GHLSubCategory | null> {
  const res = await fetch(
    `${GHL_BASE}/memberships/products/${params.productId}/sub-categories`,
    {
      method: 'POST',
      headers: ghlHeaders(),
      body: JSON.stringify({
        title: params.title,
        description: params.description ?? '',
      }),
    }
  )
  if (!res.ok) {
    console.error('[Beacon] createGHLSubCategory failed:', await res.text())
    return null
  }
  const data = await res.json()
  return data.subCategory ?? data.data ?? data ?? null
}

// ── Level label helper ─────────────────────────────────────────────────────
export { PURCHASE_LEVELS, LEVEL_COLOR } from '@/lib/beacon-config'
export type { PurchaseLevel } from '@/lib/beacon-config'
