export const runtime = 'edge'

const VALID_SIZES = [
  '1024x1024',
  '768x1344',
  '864x1152',
  '1344x768',
  '1152x864',
  '1440x720',
  '720x1440'
]

const DEFAULT_SIZE = '1024x1024'

// Read config from environment (set at deploy time)
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || 'http://172.25.136.193:8080/v1'
const ZAI_API_KEY = process.env.ZAI_API_KEY || 'Z.ai'
const ZAI_CHAT_ID = process.env.ZAI_CHAT_ID || ''
const ZAI_USER_ID = process.env.ZAI_USER_ID || ''
const ZAI_TOKEN = process.env.ZAI_TOKEN || ''

export async function POST(req) {
  try {
    const body = await req.json()
    const { prompt, size } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json(
        { error: 'Prompt is required and must be a non-empty string.' },
        { status: 400 }
      )
    }

    const resolvedSize = VALID_SIZES.includes(size) ? size : DEFAULT_SIZE

    // Call the z-ai image generation API directly via fetch (edge-compatible)
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ZAI_API_KEY}`,
      'X-Z-AI-From': 'Z',
    }
    if (ZAI_CHAT_ID) headers['X-Chat-Id'] = ZAI_CHAT_ID
    if (ZAI_USER_ID) headers['X-User-Id'] = ZAI_USER_ID
    if (ZAI_TOKEN) headers['X-Token'] = ZAI_TOKEN

    const apiUrl = `${ZAI_BASE_URL}/images/generations`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: prompt.trim(),
        size: resolvedSize,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[image] API returned ${response.status}:`, errorBody)
      return Response.json(
        { error: `Image generation API error (${response.status})` },
        { status: response.status >= 500 ? 502 : response.status }
      )
    }

    const result = await response.json()

    // The API returns data with either base64 or url
    const item = result?.data?.[0]
    if (!item) {
      return Response.json({ error: 'No image data returned.' }, { status: 502 })
    }

    let imageData
    if (item.base64) {
      imageData = `data:image/png;base64,${item.base64}`
    } else if (item.url) {
      // Fetch the URL and convert to base64
      const imgRes = await fetch(item.url)
      const imgBuffer = await imgRes.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
      imageData = `data:image/png;base64,${base64}`
    } else {
      return Response.json({ error: 'No image data in response.' }, { status: 502 })
    }

    return Response.json({
      image: imageData,
      size: resolvedSize,
    })
  } catch (err) {
    console.error('[image] Generation failed:', err)
    const message = err?.message || 'Image generation failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
