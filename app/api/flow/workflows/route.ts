import { NextResponse } from 'next/server'
import { getWorkflows, triggerWorkflow } from '@/lib/flow'

export async function GET() {
  try {
    const workflows = await getWorkflows()
    return NextResponse.json({ workflows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { workflowId, contactId } = await req.json()
    if (!workflowId || !contactId) {
      return NextResponse.json({ error: 'workflowId and contactId required' }, { status: 400 })
    }
    const ok = await triggerWorkflow(workflowId, contactId)
    return NextResponse.json({ ok })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
