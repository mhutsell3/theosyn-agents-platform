export type AgentStatus = 'online' | 'offline' | 'idle'

export type ClientStage = 'Discovery' | 'Proposal' | 'Onboarding' | 'Active' | 'Completed'
export type ClientType = 'Church' | 'Small Business' | 'Nonprofit' | 'Individual'

export interface Client {
  id: string
  name: string
  type: ClientType
  stage: ClientStage
  contact_name: string | null
  contact_email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const STAGES: ClientStage[] = ['Discovery', 'Proposal', 'Onboarding', 'Active', 'Completed']

export type ProjectType = 'AI Workflow Automation' | 'Training Program' | 'Coaching / Consulting' | 'Custom AI Tool Build'
export type ProjectPhase = 'Planning' | 'Building' | 'Review' | 'Delivered'

export interface Project {
  id: string
  name: string
  client_id: string | null
  client_name?: string | null
  type: ProjectType
  phase: ProjectPhase
  due_date: string | null
  notes: string | null
  notion_url: string | null
  created_at: string
  updated_at: string
}

export const PROJECT_PHASES: ProjectPhase[] = ['Planning', 'Building', 'Review', 'Delivered']

export type ContentChannel = 'YouTube' | 'TikTok' | 'X' | 'LinkedIn' | 'Facebook' | 'Instagram' | 'Email'
export type ContentStatus = 'Idea' | 'Draft' | 'Scheduled' | 'Published'

export interface ContentPost {
  id: string
  title: string
  channel: ContentChannel
  status: ContentStatus
  scheduled_date: string | Date | null
  published_date: string | Date | null
  post_time: string | null
  draft_content: string | null
  approved: boolean
  posted_at: string | null
  notes: string | null
  url: string | null
  created_at: string
  updated_at: string
}

export interface ContentVariant {
  id: string
  post_id: string
  channel: ContentChannel
  draft_content: string
  status: ContentStatus
  scheduled_date: string | Date | null
  post_time: string | null
  posted_at: string | null
  created_at: string
}

export interface ContentIdea {
  id: string
  title: string
  channel: ContentChannel | null
  notes: string | null
  created_at: string
}

export interface ContentMetrics {
  id: string
  month: string
  leads_generated: number
  email_subscribers: number
  notes: string | null
}

export const CONTENT_CHANNELS: ContentChannel[] = ['YouTube', 'TikTok', 'X', 'LinkedIn', 'Facebook', 'Instagram', 'Email']

export interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string | null
  type: 'content' | 'project' | 'client' | 'event'
  color: string
  notes?: string | null
  source_id?: string | null
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue'

export interface Invoice {
  id: string
  client_id: string | null
  client_name: string | null
  amount: number
  status: InvoiceStatus
  description: string | null
  issue_date: string | Date
  due_date: string | Date | null
  paid_date: string | Date | null
  invoice_number: string | null
  stripe_payment_url: string | null
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  name: string
  amount: number
  category: string
  recurring: boolean
  recurrence: string | null
  expense_date: string | Date
  notes: string | null
  created_at: string
}

export interface ServicePackage {
  id: string
  name: string
  description: string | null
  price: number
  price_type: 'fixed' | 'monthly' | 'hourly'
  active: boolean
  created_at: string
}

export const INVOICE_STATUSES: InvoiceStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue']

export const invoiceStatusColor: Record<InvoiceStatus, string> = {
  Draft:   'bg-zinc-700 text-zinc-300',
  Sent:    'bg-blue-900 text-blue-300',
  Paid:    'bg-emerald-900 text-emerald-300',
  Overdue: 'bg-rose-900 text-rose-300',
}

export interface ManualEvent {
  id: string
  title: string
  event_date: string
  event_time: string | null
  end_date: string | null
  type: string
  notes: string | null
  color: string
  created_at: string
}
export const CONTENT_STATUSES: ContentStatus[] = ['Idea', 'Draft', 'Scheduled', 'Published']

export const channelColor: Record<ContentChannel, string> = {
  YouTube:   'bg-red-900 text-red-300',
  TikTok:    'bg-pink-900 text-pink-300',
  X:         'bg-zinc-700 text-zinc-200',
  LinkedIn:  'bg-blue-900 text-blue-300',
  Facebook:  'bg-indigo-900 text-indigo-300',
  Instagram: 'bg-purple-900 text-purple-300',
  Email:     'bg-amber-900 text-amber-300',
}

export const statusColor: Record<ContentStatus, string> = {
  Idea:      'bg-zinc-700 text-zinc-400',
  Draft:     'bg-amber-900 text-amber-300',
  Scheduled: 'bg-blue-900 text-blue-300',
  Published: 'bg-emerald-900 text-emerald-300',
}
export const PROJECT_TYPES: ProjectType[] = ['AI Workflow Automation', 'Training Program', 'Coaching / Consulting', 'Custom AI Tool Build']

export const phaseColor: Record<ProjectPhase, string> = {
  Planning:  'bg-zinc-700 text-zinc-300',
  Building:  'bg-blue-900 text-blue-300',
  Review:    'bg-amber-900 text-amber-300',
  Delivered: 'bg-emerald-900 text-emerald-300',
}

export const projectTypeColor: Record<ProjectType, string> = {
  'AI Workflow Automation': 'bg-indigo-900 text-indigo-300',
  'Training Program':       'bg-purple-900 text-purple-300',
  'Coaching / Consulting':  'bg-sky-900 text-sky-300',
  'Custom AI Tool Build':   'bg-rose-900 text-rose-300',
}

export const CLIENT_TYPES: ClientType[] = ['Church', 'Small Business', 'Nonprofit', 'Individual']

export const stageColor: Record<ClientStage, string> = {
  Discovery: 'bg-zinc-700 text-zinc-300',
  Proposal:  'bg-blue-900 text-blue-300',
  Onboarding:'bg-amber-900 text-amber-300',
  Active:    'bg-emerald-900 text-emerald-300',
  Completed: 'bg-indigo-900 text-indigo-300',
}

export const typeColor: Record<ClientType, string> = {
  'Church':        'bg-purple-900 text-purple-300',
  'Small Business':'bg-sky-900 text-sky-300',
  'Nonprofit':     'bg-rose-900 text-rose-300',
  'Individual':    'bg-orange-900 text-orange-300',
}

export interface Agent {
  id: string
  name: string
  persona: string
  role: string
  last_heartbeat: string | null
  avatar_emoji: string
  category: 'smb' | 'church'
  enabled: boolean
  created_at: string
}

export interface Heartbeat {
  id: string
  agent_id: string
  content: string
  tags: string[]
  created_at: string
  agent?: Agent
}

export function agentStatus(agent: Agent): AgentStatus {
  if (!agent.last_heartbeat) return 'offline'
  const diff = Date.now() - new Date(agent.last_heartbeat).getTime()
  if (diff < 24 * 60 * 60 * 1000) return 'online'
  if (diff < 48 * 60 * 60 * 1000) return 'idle'
  return 'offline'
}
