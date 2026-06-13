import crypto from 'crypto'

export interface XPostResult {
  id: string
  error?: { message: string; code: number }
}

// Build OAuth 1.0a Authorization header required by X API v2
function buildOAuthHeader(params: {
  method: string
  url: string
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessTokenSecret: string
}): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     params.consumerKey,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_token:            params.accessToken,
    oauth_version:          '1.0',
  }

  // Parameter string — OAuth params only (no body for JSON requests)
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&')

  const baseString = [
    params.method.toUpperCase(),
    encodeURIComponent(params.url),
    encodeURIComponent(paramString),
  ].join('&')

  const signingKey = `${encodeURIComponent(params.consumerSecret)}&${encodeURIComponent(params.accessTokenSecret)}`

  oauthParams.oauth_signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64')

  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
}

// Post a tweet via X API v2
export async function postToX(params: {
  text: string
  link?: string
}): Promise<XPostResult> {
  const consumerKey    = process.env.X_API_KEY ?? ''
  const consumerSecret = process.env.X_API_KEY_SECRET ?? ''
  const accessToken    = process.env.X_ACCESS_TOKEN ?? ''
  const accessSecret   = process.env.X_ACCESS_TOKEN_SECRET ?? ''

  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
    return { id: '', error: { message: 'X API credentials not configured', code: 500 } }
  }

  const url = 'https://api.twitter.com/2/tweets'

  // X posts are text only — append link if provided
  const text = params.link
    ? `${params.text}\n\n${params.link}`
    : params.text

  // Truncate to 280 chars
  const truncated = text.length > 280 ? text.slice(0, 277) + '...' : text

  const authHeader = buildOAuthHeader({
    method: 'POST',
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret: accessSecret,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: truncated }),
  })

  const data = await res.json()

  if (!res.ok) {
    const msg = data?.detail ?? data?.title ?? JSON.stringify(data)
    console.error('[X] Post failed:', msg)
    return { id: '', error: { message: msg, code: res.status } }
  }

  console.log('[X] Posted successfully:', data.data?.id)
  return { id: data.data?.id ?? '' }
}
