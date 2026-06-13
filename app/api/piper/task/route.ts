import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateFollowUp, suggestStageMove } from '@/lib/piper'
import { logTokenUsage } from '@/lib/usage'

async function ollamaChat(prompt: string): Promise<string> {
  const model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'
  const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://localhost:11434'}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const data = await res.json()
  logTokenUsage({ agent: 'Piper', model, provider: 'ollama', promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 })
  return data.response ?? ''
}

export async function POST(req: NextRequest) {
  const { clientId, request } = await req.json()
  if (!request) return NextResponse.json({ error: 'request required' }, { status: 400 })

  type ClientRow = { id: string; name: string; stage: string; contact_name: string | null; contact_email: string | null; notes: string | null; updated_at: string }
  let clientContext = ''
  let client: ClientRow | null = null

  if (clientId) {
    const [row] = await db`SELECT * FROM clients WHERE id = ${clientId}`
    if (row) {
      client = row as unknown as ClientRow
      const daysInStage = Math.floor((Date.now() - new Date(client!.updated_at).getTime()) / 86400000)

      // Get recent contact log
      const log = await db`
        SELECT entry_type, content, created_at FROM contact_log
        WHERE client_id = ${clientId}
        ORDER BY created_at DESC LIMIT 5`

      const logStr = (log as unknown as { entry_type: string; content: string; created_at: string }[])
        .map(e => `[${e.entry_type}] ${e.content.slice(0, 100)}`)
        .join('\n')

      clientContext = `
Client: ${client!.name}
Stage: ${client!.stage}
Contact: ${client!.contact_name ?? 'unknown'} (${client!.contact_email ?? 'no email'})
Days in stage: ${daysInStage}
Notes: ${client!.notes ?? 'none'}
Recent activity:
${logStr || 'No recent activity'}`
    }
  }

  const prompt = `You are Piper, the Client Relations agent for TheoSYN Labs.
TheoSYN Labs helps small businesses and churches use AI ethically, from a Christian perspective.
Tone: warm, professional, faith-informed.
${clientContext ? `\nClient context:\n${clientContext}\n` : ''}
Task requested: ${request}

Complete the task. Be specific and actionable. If writing an email, write just the email body.`

  const output = await ollamaChat(prompt)

  // Save task record
  const [task] = await db`
    INSERT INTO piper_tasks (client_id, request, output, status)
    VALUES (${clientId ?? null}, ${request}, ${output}, 'complete')
    RETURNING *`

  // If it looks like an email and we have a client with email, create approval
  const looksLikeEmail = output.length > 100 && (request.toLowerCase().includes('email') || request.toLowerCase().includes('write') || request.toLowerCase().includes('draft'))
  if (looksLikeEmail && client?.contact_email && clientId) {
    await db`
      INSERT INTO piper_approvals (client_id, approval_type, to_email, to_name, subject, body)
      VALUES (
        ${clientId},
        'task_output',
        ${client.contact_email},
        ${client.contact_name ?? client.name},
        ${'Message for ' + client.name},
        ${output}
      )`
  }

  // Log to contact log
  if (clientId) {
    await db`
      INSERT INTO contact_log (client_id, entry_type, content, created_by)
      VALUES (${clientId}, 'piper_action', ${'Task: ' + request + '\n\nOutput:\n' + output.slice(0, 500)}, 'piper')`
  }

  await db`UPDATE agents SET last_heartbeat = now() WHERE name = 'Piper'`

  return NextResponse.json({ task, approvalCreated: looksLikeEmail && !!client?.contact_email })
}
