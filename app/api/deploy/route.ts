import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(req: Request) {
  const secret = req.headers.get('x-deploy-secret') ?? new URL(req.url).searchParams.get('secret')

  if (secret !== process.env.DEPLOY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Run in background — don't await the full build (takes too long for HTTP timeout)
  execAsync('cd /opt/theosyn-command-center && GIT_SSH_COMMAND="ssh -i /home/mhutsell3/.ssh/github" git pull && npm run build && pm2 restart theosyn')
    .then(() => console.log('[Deploy] ✓ Deploy completed'))
    .catch(err => console.error('[Deploy] ✗ Deploy failed:', err.message))

  return NextResponse.json({ ok: true, message: 'Deploy started — check pm2 logs in ~2 minutes' })
}
