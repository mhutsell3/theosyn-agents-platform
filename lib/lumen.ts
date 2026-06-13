import { logTokenUsage } from '@/lib/usage'

async function ollamaChat(prompt: string, model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'): Promise<string> {
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Lumen', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

const LUMEN_CONTEXT = `
You are Lumen, the Finance & Admin agent for TheoSYN Labs.

TheoSYN Labs helps small businesses and churches use AI ethically, from a Christian perspective.
Your job: track revenue, flag overdue invoices, summarize financial health, and keep the books clean.
Tone: clear, precise, numbers-first. Financially savvy but accessible.
`

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export interface InvoiceAlert {
  id: string
  client_name: string | null
  amount: number
  status: string
  due_date: string | null
  daysOverdue: number | null
  invoice_number: string | null
}

export function flagOverdueInvoices(invoices: {
  id: string
  client_name: string | null
  amount: number | string
  status: string
  due_date: string | null
  invoice_number: string | null
}[]): InvoiceAlert[] {
  const today = new Date()
  return invoices
    .filter(i => i.status === 'Overdue' || (i.status === 'Sent' && i.due_date && new Date(i.due_date) < today))
    .map(i => ({
      ...i,
      amount: Number(i.amount),
      daysOverdue: i.due_date
        ? Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000)
        : null,
    }))
    .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))
}

export async function generateInvoiceReminder(invoice: {
  client_name: string | null
  amount: number
  invoice_number: string | null
  due_date: string | null
  daysOverdue: number | null
  description: string | null
}): Promise<string> {
  const prompt = `${LUMEN_CONTEXT}

Write a professional, warm invoice reminder email:

Client: ${invoice.client_name ?? 'Valued Client'}
Invoice #: ${invoice.invoice_number ?? 'N/A'}
Amount: ${fmt(invoice.amount)}
Due date: ${invoice.due_date ?? 'Past due'}
Days overdue: ${invoice.daysOverdue ?? 'Unknown'}
Service: ${invoice.description ?? 'Professional services'}

The email should:
- Be professional but warm and non-confrontational
- Reference the invoice number and amount clearly
- Mention the due date
- Include a gentle call to action
- Offer to answer any questions
- Sign off as "Milford at TheoSYN Labs"
- Keep it brief (2-3 paragraphs)

Write only the email body.`

  return ollamaChat(prompt)
}

export async function generateFinancialSummary(data: {
  collectedMTD: number
  outstandingTotal: number
  overdueTotal: number
  overdueCount: number
  expensesMTD: number
  totalRevenue: number
  overdueInvoices: InvoiceAlert[]
  monthlyTrend: { label: string; revenue: number; expenses: number }[]
}): Promise<string> {
  const netMTD = data.collectedMTD - data.expensesMTD
  const prevMonthRev = data.monthlyTrend[data.monthlyTrend.length - 2]?.revenue ?? 0
  const currMonthRev = data.monthlyTrend[data.monthlyTrend.length - 1]?.revenue ?? 0
  const revGrowth = prevMonthRev > 0 ? ((currMonthRev - prevMonthRev) / prevMonthRev * 100).toFixed(1) : 'N/A'

  const prompt = `${LUMEN_CONTEXT}

Generate a weekly financial health summary for TheoSYN Labs.

Financial data:
- Collected this month: ${fmt(data.collectedMTD)}
- Net this month (revenue - expenses): ${fmt(netMTD)}
- Outstanding invoices: ${fmt(data.outstandingTotal)}
- Overdue invoices: ${fmt(data.overdueTotal)} (${data.overdueCount} invoices)
- Expenses this month: ${fmt(data.expensesMTD)}
- Total all-time revenue: ${fmt(data.totalRevenue)}
- MoM revenue trend: ${revGrowth}%
- Overdue clients: ${data.overdueInvoices.map(i => `${i.client_name} (${fmt(i.amount)}, ${i.daysOverdue}d overdue)`).join(', ') || 'none'}

Write a concise financial summary (3-4 paragraphs) covering:
1. Monthly health snapshot (revenue vs expenses, net)
2. Cash flow concerns — outstanding and overdue
3. Trend analysis (growing, flat, or declining)
4. Recommended actions (who to chase, what to watch)

Format as markdown. Include specific dollar amounts.`

  return ollamaChat(prompt)
}

export async function generateMonthEndReport(data: {
  month: string
  revenue: number
  expenses: number
  invoicesPaid: number
  newClients: number
  activeProjects: number
}): Promise<string> {
  const prompt = `${LUMEN_CONTEXT}

Generate a month-end financial report for TheoSYN Labs.

Month: ${data.month}
Revenue collected: ${fmt(data.revenue)}
Expenses: ${fmt(data.expenses)}
Net profit: ${fmt(data.revenue - data.expenses)}
Invoices paid: ${data.invoicesPaid}
New clients: ${data.newClients}
Active projects: ${data.activeProjects}

Write a clean month-end summary with:
## ${data.month} Financial Summary
- Revenue, expenses, net profit
- Key wins
- Areas to improve
- Goal for next month

Format as markdown. Be specific with numbers.`

  return ollamaChat(prompt)
}
