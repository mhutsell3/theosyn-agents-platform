import { logTokenUsage } from '@/lib/usage'
export { TARGET_JOB_ROLES } from '@/lib/scout-config'

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID!
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY!
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'

export interface AdzunaJob {
  jobId: string
  title: string
  companyName: string
  location: string
  postedAt: string | null
  jobUrl: string
  description: string | null
  salary: string | null
}

// Search Adzuna for jobs in Indiana by role
export async function searchAdzunaJobs(role: string, locationQuery = 'Indiana'): Promise<AdzunaJob[]> {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    throw new Error('Adzuna credentials not configured — add ADZUNA_APP_ID and ADZUNA_APP_KEY to .env.local')
  }

  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    results_per_page: '25',
    what: role,
    where: locationQuery,
  })

  const res = await fetch(
    `https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`,
    {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Adzuna API error: ${err}`)
  }

  const data = await res.json()
  const jobs = data.results ?? []

  return jobs.map((j: Record<string, unknown>) => {
    const company = (j.company as Record<string, unknown>)
    const loc = (j.location as Record<string, unknown>)
    const salary = j.salary_min
      ? `$${Number(j.salary_min).toLocaleString()} - $${Number(j.salary_max ?? j.salary_min).toLocaleString()}`
      : null

    return {
      jobId: String(j.id ?? ''),
      title: (j.title as string) ?? '',
      companyName: (company?.display_name as string) ?? '',
      location: (loc?.display_name as string) ?? locationQuery,
      postedAt: (j.created as string) ?? null,
      jobUrl: (j.redirect_url as string) ?? '',
      description: (j.description as string) ?? null,
      salary,
    }
  }).filter((j: AdzunaJob) => j.companyName && j.title)
}

// Look up a company on Google Places to get contact info
export async function enrichWithPlaces(companyName: string, location: string): Promise<{
  placeId: string | null
  phone: string | null
  website: string | null
  address: string | null
  rating: number | null
  hasGmb: boolean
}> {
  const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

  try {
    const query = `${companyName} ${location}`
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return { placeId: null, phone: null, website: null, address: null, rating: null, hasGmb: false }

    const data = await res.json()
    const place = data.places?.[0]
    if (!place) return { placeId: null, phone: null, website: null, address: null, rating: null, hasGmb: false }

    return {
      placeId: place.id ?? null,
      phone: place.nationalPhoneNumber ?? null,
      website: place.websiteUri ?? null,
      address: place.formattedAddress ?? null,
      rating: place.rating ?? null,
      hasGmb: true,
    }
  } catch {
    return { placeId: null, phone: null, website: null, address: null, rating: null, hasGmb: false }
  }
}

// Generate outreach email referencing the specific job posting
export async function generateJobOutreach(lead: {
  companyName: string
  jobTitle: string
  address: string | null
  contactEmail: string | null
}): Promise<string> {
  const prompt = `You are Scout, the lead generation agent for TheoSYN Labs — a company that helps small businesses use AI to work smarter.

Write a short, warm, personalized cold outreach email to this business:

Company: ${lead.companyName}
They are currently hiring for: ${lead.jobTitle}
Location: ${lead.address ?? 'Indianapolis area'}

The email should:
- Open by referencing that you noticed they are hiring for a ${lead.jobTitle}
- Explain how AI tools could handle 60-80% of that role's repetitive tasks
- Position TheoSYN Labs as someone who can show them how — saving money and time
- Offer a free 15-minute AI efficiency consultation as the CTA
- Be brief (3 short paragraphs), warm, non-pushy
- Sign off as "Milford at TheoSYN Labs"
- Sound human and specific to their hiring situation

Write only the email body.`

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Scout', model: OLLAMA_MODEL, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response?.trim() ?? ''
}
