import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateDailyStandup, StandupData } from '@/lib/theo'
import { flagStaleClients } from '@/lib/piper'
import { assessProjectRisks } from '@/lib/atlas'
import { flagOverdueInvoices } from '@/lib/lumen'

export async function POST() {
  const now = new Date()
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  // Today in ET — strip to midnight
  const todayStart = new Date(now.toLocaleDateString('en-US', { timeZone: 'America/New_York' })).toISOString()

  // Pull all data in parallel — includes today-specific queries
  const [
    clients, projects, invoices, expenses,
    postsScheduled, postsPublishedThisWeek, ideasInBacklog,
    scoutLeads, recentResearch, agents,
    // Today's activity
    leadsContactedToday, outreachSentToday,
    postsPublishedToday, followUpsSentToday,
    materialsCreatedToday, newLeadsToday,
  ] = await Promise.all([
    db`SELECT id, name, stage, contact_name, contact_email, notes, updated_at, created_at FROM clients WHERE stage != 'Completed'`,
    db`SELECT p.id, p.name, p.phase, p.due_date, p.updated_at, p.notes, c.name as client_name FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.phase != 'Delivered'`,
    db`SELECT id, client_name, amount, status, due_date, invoice_number FROM invoices`,
    db`SELECT amount FROM expenses WHERE expense_date >= ${monthStart}`,
    db`SELECT COUNT(*) as count FROM content_posts WHERE status = 'Scheduled'`,
    db`SELECT COUNT(*) as count FROM content_posts WHERE status = 'Published' AND updated_at >= ${weekAgo}`,
    db`SELECT COUNT(*) as count FROM content_ideas`,
    db`SELECT grade, outreach_status, approval_status, scraped_at FROM scout_leads WHERE scraped_at >= ${weekAgo}`,
    db`SELECT topic FROM sage_briefs WHERE created_at >= ${weekAgo} ORDER BY created_at DESC LIMIT 5`,
    db`SELECT name, last_heartbeat FROM agents`,
    // Today's data
    db`SELECT COUNT(*) as count FROM scout_leads WHERE outreach_status = 'contacted' AND updated_at >= ${todayStart}`,
    db`SELECT COUNT(*) as count FROM scout_leads WHERE outreach_sent_at >= ${todayStart}`,
    db`SELECT COUNT(*) as count FROM content_posts WHERE status = 'Published' AND updated_at >= ${todayStart}`,
    db`SELECT COUNT(*) as count FROM scout_leads WHERE follow_up_sent_at >= ${todayStart} OR follow_up_2_sent_at >= ${todayStart}`,
    db`SELECT COUNT(*) as count FROM scribe_materials WHERE created_at >= ${todayStart}`,
    db`SELECT COUNT(*) as count FROM scout_leads WHERE scraped_at >= ${todayStart}`,
  ])

  // Process each branch
  const clientList = clients as unknown as { id: string; name: string; stage: string; contact_name: string | null; contact_email: string | null; notes: string | null; updated_at: string; created_at: string }[]
  const staleClients = flagStaleClients(clientList)
  const newClientsThisWeek = clientList.filter(c => new Date(c.created_at) >= new Date(weekAgo)).length

  const projectList = projects as unknown as { id: string; name: string; phase: string; client_name: string | null; due_date: string | null; updated_at: string; notes: string | null }[]
  const projectRisks = assessProjectRisks(projectList)
  const overdueProjects = projectRisks.filter(r => r.risk === 'overdue')
  const atRiskProjects = projectRisks.filter(r => r.risk === 'at_risk')

  const invoiceList = invoices as unknown as { id: string; client_name: string | null; amount: number; status: string; due_date: string | null; invoice_number: string | null }[]
  const overdueInvoices = flagOverdueInvoices(invoiceList)
  const collectedMTD = invoiceList.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0)
  const outstandingTotal = invoiceList.filter(i => i.status === 'Sent' || i.status === 'Overdue').reduce((s, i) => s + Number(i.amount), 0)

  const scoutList = scoutLeads as unknown as { grade: string; outreach_status: string; approval_status: string | null; scraped_at: string }[]
  const newLeadsThisWeek = scoutList.length
  const gradeATotal = (await db`SELECT COUNT(*) as count FROM scout_leads WHERE grade = 'A'`)[0] as unknown as { count: string }
  const pendingApprovals = scoutList.filter(l => l.approval_status === 'pending').length +
    Number(((await db`SELECT COUNT(*) as count FROM scout_leads WHERE approval_status = 'pending'`)[0] as unknown as { count: string }).count)
  const contactedThisWeek = scoutList.filter(l => l.outreach_status === 'contacted').length

  const agentList = agents as unknown as { name: string; last_heartbeat: string | null }[]
  const agentsOnline = agentList.filter(a => {
    if (!a.last_heartbeat) return false
    return Date.now() - new Date(a.last_heartbeat).getTime() < 24 * 60 * 60 * 1000
  }).length

  const n = (row: unknown) => Number((row as unknown as { count: string }[])[0]?.count ?? 0)

  const data: StandupData = {
    date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }),
    totalClients: clientList.length,
    activeClients: clientList.filter(c => c.stage === 'Active').length,
    staleClients,
    newClientsThisWeek,
    activeProjects: projectList.length,
    overdueProjects,
    atRiskProjects,
    collectedMTD,
    outstandingTotal,
    overdueInvoices,
    postsScheduled: Number((postsScheduled[0] as unknown as { count: string }).count),
    postsPublishedThisWeek: Number((postsPublishedThisWeek[0] as unknown as { count: string }).count),
    ideasInBacklog: Number((ideasInBacklog[0] as unknown as { count: string }).count),
    newLeadsThisWeek,
    gradeALeads: Number(gradeATotal.count),
    pendingApprovals,
    contactedThisWeek,
    recentResearchTopics: (recentResearch as unknown as { topic: string }[]).map(r => r.topic),
    agentsOnline,
    totalAgents: agentList.length,
    // Today's activity
    leadsContactedToday: n(leadsContactedToday),
    outreachSentToday: n(outreachSentToday),
    postsPublishedToday: n(postsPublishedToday),
    followUpsSentToday: n(followUpsSentToday),
    materialsCreatedToday: n(materialsCreatedToday),
    newLeadsToday: n(newLeadsToday),
  }

  const standup = await generateDailyStandup(data)

  // Save to heartbeats as Theo's standup
  await db`
    INSERT INTO heartbeats (agent_id, content, tags)
    SELECT id, ${`## Daily Standup — ${data.date}\n\n${standup}`}, ARRAY['standup', 'theo', 'daily']
    FROM agents WHERE name = 'Theo' LIMIT 1`

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Theo'`

  return NextResponse.json({ standup, data })
}
