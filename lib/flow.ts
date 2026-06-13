const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

function ghlHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': GHL_VERSION,
    'Content-Type': 'application/json',
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface GHLPipeline {
  id: string
  name: string
  stages: GHLStage[]
}

export interface GHLStage {
  id: string
  name: string
  position: number
}

export interface GHLOpportunity {
  id: string
  name: string
  contactId: string
  pipelineId: string
  pipelineStageId: string
  status: string
  monetaryValue?: number
  assignedTo?: string
  createdAt: string
  updatedAt: string
  contact?: {
    name: string
    email: string
    phone?: string
  }
}

export interface GHLWorkflow {
  id: string
  name: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface FlowStats {
  totalContacts: number
  pipelines: { id: string; name: string; stageCount: number; opportunityCount: number }[]
  workflows: { id: string; name: string; status: string }[]
}

// ── Pipelines ──────────────────────────────────────────────────────────────

export async function getPipelines(): Promise<GHLPipeline[]> {
  const res = await fetch(
    `${GHL_BASE}/opportunities/pipelines?locationId=${process.env.GHL_LOCATION_ID}`,
    { headers: ghlHeaders() }
  )
  if (!res.ok) {
    console.error('[Flow] getPipelines failed:', await res.text())
    return []
  }
  const data = await res.json()
  return data.pipelines ?? []
}

export async function getOpportunitiesByPipeline(pipelineId: string): Promise<GHLOpportunity[]> {
  const res = await fetch(
    `${GHL_BASE}/opportunities/search?location_id=${process.env.GHL_LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`,
    { headers: ghlHeaders() }
  )
  if (!res.ok) {
    console.error('[Flow] getOpportunities failed:', await res.text())
    return []
  }
  const data = await res.json()
  return data.opportunities ?? []
}

// ── Push Scout lead into GHL pipeline ─────────────────────────────────────

export async function pushLeadToFunnel(lead: {
  name: string
  email: string
  phone?: string | null
  company?: string | null
  website?: string | null
  pipelineId: string
  stageId: string
  tags?: string[]
}): Promise<{ contactId: string | null; opportunityId: string | null }> {
  // 1. Create or find contact
  const [firstName, ...rest] = (lead.name || 'Unknown').trim().split(' ')
  const lastName = rest.join(' ') || ''

  const contactBody: Record<string, unknown> = {
    locationId: process.env.GHL_LOCATION_ID,
    firstName,
    lastName,
    email: lead.email,
    tags: ['scout-lead', ...(lead.tags ?? [])],
    source: 'TheoSYN Scout',
  }
  if (lead.phone) contactBody.phone = lead.phone
  if (lead.company) contactBody.companyName = lead.company
  if (lead.website) contactBody.website = lead.website

  const contactRes = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify(contactBody),
  })

  let contactId: string | null = null
  if (contactRes.ok) {
    const d = await contactRes.json()
    contactId = d.contact?.id ?? null
  } else {
    // Duplicate — extract existing ID
    try {
      const errJson = await contactRes.json()
      contactId = errJson?.meta?.contactId ?? null
    } catch { /* ignore */ }
  }

  if (!contactId) return { contactId: null, opportunityId: null }

  // 2. Create opportunity in pipeline
  const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({
      locationId: process.env.GHL_LOCATION_ID,
      pipelineId: lead.pipelineId,
      pipelineStageId: lead.stageId,
      contactId,
      name: lead.company || lead.name,
      status: 'open',
    }),
  })

  let opportunityId: string | null = null
  if (oppRes.ok) {
    const d = await oppRes.json()
    opportunityId = d.opportunity?.id ?? null
  } else {
    console.error('[Flow] createOpportunity failed:', await oppRes.text())
  }

  return { contactId, opportunityId }
}

// ── Move opportunity to a new stage ───────────────────────────────────────

export async function moveOpportunityStage(opportunityId: string, stageId: string): Promise<boolean> {
  const res = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
    method: 'PUT',
    headers: ghlHeaders(),
    body: JSON.stringify({ pipelineStageId: stageId }),
  })
  return res.ok
}

// ── Workflows ──────────────────────────────────────────────────────────────

export async function getWorkflows(): Promise<GHLWorkflow[]> {
  const res = await fetch(
    `${GHL_BASE}/workflows/?locationId=${process.env.GHL_LOCATION_ID}`,
    { headers: ghlHeaders() }
  )
  if (!res.ok) {
    console.error('[Flow] getWorkflows failed:', await res.text())
    return []
  }
  const data = await res.json()
  return data.workflows ?? []
}

export async function triggerWorkflow(workflowId: string, contactId: string): Promise<boolean> {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/workflow/${workflowId}`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({ eventStartTime: new Date().toISOString() }),
  })
  if (!res.ok) {
    console.error('[Flow] triggerWorkflow failed:', await res.text())
  }
  return res.ok
}

// ── Contacts ───────────────────────────────────────────────────────────────

export interface GHLContact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  companyName?: string
  tags: string[]
  source?: string
  dateAdded: string
  lastActivity?: string
}

export async function getContacts(params?: {
  query?: string
  limit?: number
  startAfter?: string
}): Promise<{ contacts: GHLContact[]; total: number; nextPage?: string }> {
  const limit = params?.limit ?? 50
  let url = `${GHL_BASE}/contacts/?locationId=${process.env.GHL_LOCATION_ID}&limit=${limit}`
  if (params?.query) url += `&query=${encodeURIComponent(params.query)}`
  if (params?.startAfter) url += `&startAfter=${params.startAfter}`

  const res = await fetch(url, { headers: ghlHeaders() })
  if (!res.ok) {
    console.error('[Flow] getContacts failed:', await res.text())
    return { contacts: [], total: 0 }
  }
  const data = await res.json()
  return {
    contacts: data.contacts ?? [],
    total: data.meta?.total ?? 0,
    nextPage: data.meta?.nextPageUrl ?? undefined,
  }
}

// ── Stats overview ─────────────────────────────────────────────────────────

export async function getFlowStats(): Promise<FlowStats> {
  const [pipelines, workflows] = await Promise.all([
    getPipelines(),
    getWorkflows(),
  ])

  // Count contacts (simple location count)
  let totalContacts = 0
  try {
    const res = await fetch(
      `${GHL_BASE}/contacts/?locationId=${process.env.GHL_LOCATION_ID}&limit=1`,
      { headers: ghlHeaders() }
    )
    if (res.ok) {
      const d = await res.json()
      totalContacts = d.meta?.total ?? 0
    }
  } catch { /* ignore */ }

  // Get opportunity counts per pipeline
  const pipelineStats = await Promise.all(
    pipelines.map(async p => {
      const opps = await getOpportunitiesByPipeline(p.id)
      return {
        id: p.id,
        name: p.name,
        stageCount: p.stages?.length ?? 0,
        opportunityCount: opps.length,
      }
    })
  )

  return {
    totalContacts,
    pipelines: pipelineStats,
    workflows: workflows.map(w => ({ id: w.id, name: w.name, status: w.status })),
  }
}
