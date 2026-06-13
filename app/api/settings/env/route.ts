import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env.local')

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    result[key] = val
  }
  return result
}

function serializeEnv(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n'
}

// GET — read .env.local from disk
export async function GET() {
  try {
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : ''
    const vars = parseEnv(content)
    return NextResponse.json({ vars })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH — update one or more keys in .env.local
export async function PATCH(req: NextRequest) {
  try {
    const { updates } = await req.json() as { updates: Record<string, string> }
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : ''
    const vars = parseEnv(content)
    Object.assign(vars, updates)
    fs.writeFileSync(ENV_PATH, serializeEnv(vars), 'utf8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE — remove a key from .env.local
export async function DELETE(req: NextRequest) {
  try {
    const { key } = await req.json() as { key: string }
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : ''
    const vars = parseEnv(content)
    delete vars[key]
    fs.writeFileSync(ENV_PATH, serializeEnv(vars), 'utf8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
