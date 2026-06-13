import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const AGENTS = [
  'theo', 'nova', 'sage', 'scout', 'piper', 'atlas', 'lumen',
  'beacon', 'pulse', 'scribe', 'logos', 'orion', 'forge', 'remi',
]

function skillPath(agent: string) {
  return path.join(process.cwd(), 'config', 'agents', `${agent}.md`)
}

// GET — read skill file
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentParam } = await params
  const agent = agentParam.toLowerCase()
  if (!AGENTS.includes(agent)) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }

  const filePath = skillPath(agent)
  if (!existsSync(filePath)) {
    return NextResponse.json({ content: '' })
  }

  const content = await readFile(filePath, 'utf-8')
  return NextResponse.json({ content })
}

// PUT — save skill file
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentParam } = await params
  const agent = agentParam.toLowerCase()
  if (!AGENTS.includes(agent)) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }

  const { content } = await req.json()
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }

  await writeFile(skillPath(agent), content, 'utf-8')
  return NextResponse.json({ ok: true })
}

// POST — save + git commit + push
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentParam } = await params
  const agent = agentParam.toLowerCase()
  if (!AGENTS.includes(agent)) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }

  const { content, message } = await req.json()
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }

  const filePath = skillPath(agent)
  await writeFile(filePath, content, 'utf-8')

  const commitMsg = message?.trim() || `Update ${agent} skill — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`

  try {
    const cwd = process.cwd()
    const relPath = `config/agents/${agent}.md`
    const gitEnv = {
      ...process.env,
      GIT_SSH_COMMAND: 'ssh -i ~/.ssh/github -o StrictHostKeyChecking=no',
      GIT_AUTHOR_NAME: 'TheoSYN Command Center',
      GIT_AUTHOR_EMAIL: 'milford.hutsell@gmail.com',
      GIT_COMMITTER_NAME: 'TheoSYN Command Center',
      GIT_COMMITTER_EMAIL: 'milford.hutsell@gmail.com',
    }
    await execAsync(`git add "${relPath}"`, { cwd, env: gitEnv })
    await execAsync(`git commit -m "${commitMsg.replace(/"/g, "'")}"`, { cwd, env: gitEnv })
    await execAsync(`git push origin master`, { cwd, env: gitEnv })
    return NextResponse.json({ ok: true, committed: true, message: commitMsg })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Nothing to commit is fine — file is saved to disk, git just has no diff
    if (
      msg.includes('nothing to commit') ||
      msg.includes('nothing added to commit') ||
      msg.includes('working tree clean') ||
      msg.includes('no changes added')
    ) {
      return NextResponse.json({ ok: true, committed: false, message: 'No changes to commit — file saved to disk' })
    }
    console.error('[AgentSkills] git error:', msg)
    return NextResponse.json({ ok: true, committed: false, gitError: msg })
  }
}
