import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code')
  const shop  = process.env.SHOPIFY_STORE_URL!

  if (!code) return NextResponse.json({ error: 'No code received' }, { status: 400 })

  // Exchange code for access token
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Token exchange failed: ${err}` }, { status: 500 })
  }

  const { access_token } = await res.json()

  // Save token to .env.local
  try {
    const envPath = join(process.cwd(), '.env.local')
    let env = readFileSync(envPath, 'utf-8')
    if (env.includes('SHOPIFY_ACCESS_TOKEN=')) {
      env = env.replace(/SHOPIFY_ACCESS_TOKEN=.*/, `SHOPIFY_ACCESS_TOKEN=${access_token}`)
    } else {
      env += `\nSHOPIFY_ACCESS_TOKEN=${access_token}`
    }
    writeFileSync(envPath, env)
  } catch (err) {
    console.error('[Forge] Failed to save token to .env.local:', err)
  }

  return new NextResponse(`
    <html><body style="background:#09090b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px">
      <h2 style="color:#34d399">✓ Shopify Connected!</h2>
      <p style="color:#71717a">Access token saved. Restart the server to apply.</p>
      <code style="background:#18181b;padding:8px 16px;border-radius:8px;color:#818cf8">${access_token.slice(0, 12)}...</code>
      <a href="/forge" style="color:#6366f1;margin-top:8px">← Go to Forge</a>
      <p style="color:#ef4444;font-size:12px">Run: pm2 restart theosyn</p>
    </body></html>
  `, { headers: { 'Content-Type': 'text/html' } })
}
