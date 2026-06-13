const LINKEDIN_API = 'https://api.linkedin.com/v2'

export interface LinkedInPostResult {
  id: string
  error?: { message: string; code: number }
}

// Post a text update to LinkedIn (personal profile or org page)
export async function postToLinkedIn(params: {
  accessToken: string
  authorUrn: string   // e.g. "urn:li:person:vIvf9e1-Ch" or "urn:li:organization:12345678"
  message: string
  link?: string
}): Promise<LinkedInPostResult> {
  const shareContent: Record<string, unknown> = {
    shareCommentary: { text: params.message },
    shareMediaCategory: params.link ? 'ARTICLE' : 'NONE',
  }

  if (params.link) {
    shareContent.media = [
      {
        status: 'READY',
        originalUrl: params.link,
      },
    ]
  }

  const body = {
    author: params.authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent,
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[LinkedIn] Post failed:', errText)
    let message = errText
    try { message = JSON.parse(errText)?.message ?? errText } catch { /* raw */ }
    return { id: '', error: { message, code: res.status } }
  }

  // LinkedIn returns the post URN in the x-restli-id header
  const postUrn = res.headers.get('x-restli-id') ?? ''
  return { id: postUrn }
}
