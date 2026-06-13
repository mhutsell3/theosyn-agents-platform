const GRAPH_URL = 'https://graph.facebook.com/v21.0'

export interface InstagramPostResult {
  id: string
  error?: { message: string; code: number }
}

// Post a text+image to Instagram via the Content Publishing API (two-step)
// Instagram requires an image — we use a branded default if none is provided
export async function postToInstagram(params: {
  igAccountId: string   // Instagram Business Account ID
  accessToken: string   // Facebook Page access token
  caption: string       // Post text / caption
  imageUrl?: string     // Public image URL — falls back to branded default
}): Promise<InstagramPostResult> {
  const imageUrl = params.imageUrl ?? process.env.INSTAGRAM_DEFAULT_IMAGE_URL

  if (!imageUrl) {
    return {
      id: '',
      error: { message: 'No image URL provided and INSTAGRAM_DEFAULT_IMAGE_URL not set', code: 400 },
    }
  }

  // Step 1: Create media container
  const containerRes = await fetch(
    `${GRAPH_URL}/${params.igAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: params.caption,
        access_token: params.accessToken,
      }),
    }
  )

  const containerData = await containerRes.json()

  if (!containerRes.ok || containerData.error) {
    const msg = containerData.error?.message ?? 'Failed to create media container'
    console.error('[Instagram] Container creation failed:', msg)
    return { id: '', error: { message: msg, code: containerRes.status } }
  }

  const containerId = containerData.id
  console.log('[Instagram] Media container created:', containerId)

  // Step 2: Publish the container
  const publishRes = await fetch(
    `${GRAPH_URL}/${params.igAccountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: params.accessToken,
      }),
    }
  )

  const publishData = await publishRes.json()

  if (!publishRes.ok || publishData.error) {
    const msg = publishData.error?.message ?? 'Failed to publish media'
    console.error('[Instagram] Publish failed:', msg)
    return { id: '', error: { message: msg, code: publishRes.status } }
  }

  console.log('[Instagram] Published successfully:', publishData.id)
  return { id: publishData.id }
}
