const GRAPH_URL = 'https://graph.facebook.com/v21.0'

export interface MetaPostResult {
  id: string
  error?: { message: string; code: number }
}

export interface MetaEngagement {
  likes: number
  comments: number
  shares: number
  reach: number
}

// Post to a Facebook page
export async function postToFacebook(params: {
  pageId: string
  accessToken: string
  message: string
  link?: string
}): Promise<MetaPostResult> {
  const body = new URLSearchParams({
    message: params.message,
    access_token: params.accessToken,
  })
  if (params.link) body.set('link', params.link)

  const res = await fetch(`${GRAPH_URL}/${params.pageId}/feed`, {
    method: 'POST',
    body,
  })
  return res.json()
}

// Get engagement metrics for a post
export async function getPostEngagement(params: {
  postId: string
  accessToken: string
}): Promise<MetaEngagement> {
  const fields = 'likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique)'
  const res = await fetch(
    `${GRAPH_URL}/${params.postId}?fields=${fields}&access_token=${params.accessToken}`
  )
  const data = await res.json()

  return {
    likes: data.likes?.summary?.total_count ?? 0,
    comments: data.comments?.summary?.total_count ?? 0,
    shares: data.shares?.count ?? 0,
    reach: data.insights?.data?.[0]?.values?.[0]?.value ?? 0,
  }
}

// Get recent comments on a post
export async function getPostComments(params: {
  postId: string
  accessToken: string
}): Promise<{ id: string; message: string; from: { name: string } }[]> {
  const res = await fetch(
    `${GRAPH_URL}/${params.postId}/comments?fields=id,message,from&access_token=${params.accessToken}`
  )
  const data = await res.json()
  return data.data ?? []
}

// Reply to a comment
export async function replyToComment(params: {
  commentId: string
  accessToken: string
  message: string
}): Promise<MetaPostResult> {
  const body = new URLSearchParams({
    message: params.message,
    access_token: params.accessToken,
  })
  const res = await fetch(`${GRAPH_URL}/${params.commentId}/comments`, {
    method: 'POST',
    body,
  })
  return res.json()
}

// Validate a page access token
export async function validateToken(params: {
  pageId: string
  accessToken: string
}): Promise<{ valid: boolean; pageName?: string }> {
  const res = await fetch(
    `${GRAPH_URL}/${params.pageId}?fields=name&access_token=${params.accessToken}`
  )
  const data = await res.json()
  if (data.error) return { valid: false }
  return { valid: true, pageName: data.name }
}
