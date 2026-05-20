export const runtime = 'edge'

// ── Image Generation: ZAI (primary) → Pollinations AI (fallback) ──
//
// ZAI API: https://api.z.ai/api/paas/v4
//   - POST /images/generations with Bearer token auth
//   - Returns base64 encoded images
//   - May be geo-restricted (401 from certain regions)
//
// Pollinations AI (fallback): https://pollinations.ai
//   - Free, no API key required
//   - GET endpoint, returns image directly
//   - Rate limit: 1 concurrent request per IP. 402 = queue full.

import { imageGeneration } from '@/lib/zai'

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

// Pollinations config
const POLLINATIONS_MODEL = 'flux'
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || ''
const MAX_RETRIES = 5
const RETRY_BASE_MS = 3000

// ── ZAI Image Generation (Primary) ──

async function generateWithZAI(prompt, size) {
  const result = await imageGeneration({ prompt, size })
  // ZAI returns { data: [{ base64, format }] }
  if (result.data && result.data.length > 0) {
    const item = result.data[0]
    const base64Data = item.base64 || item.url || ''
    const format = item.format || 'png'
    const imageData = base64Data.startsWith('data:')
      ? base64Data
      : `data:image/${format};base64,${base64Data}`
    return {
      image: imageData,
      provider: 'zai',
      size,
      model: 'zai-image',
    }
  }
  throw new Error('ZAI returned no image data')
}

// ── Pollinations Image Generation (Fallback) ──

function enhancePrompt(rawPrompt) {
  const hasQualityWords = /professional|high.quality|detailed|4k|8k|ultra|cinematic|studio/i.test(rawPrompt)
  if (hasQualityWords) return rawPrompt
  return `${rawPrompt}, professional quality, highly detailed, sharp focus, studio lighting`
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'image/*' },
    })
    if (res.ok) return res
    if (res.status === 402 && attempt < retries) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt)
      console.warn(`[image] Pollinations 402 (queue full), retry ${attempt + 1}/${retries} in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    return res
  }
}

async function generateWithPollinations(prompt, size) {
  const [width, height] = size.split('x').map(Number)
  const enhancedPrompt = enhancePrompt(prompt.trim())
  const encodedPrompt = encodeURIComponent(enhancedPrompt)
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model: POLLINATIONS_MODEL,
    nologo: 'true',
  })
  if (POLLINATIONS_API_KEY) params.set('key', POLLINATIONS_API_KEY)

  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`
  const imgResponse = await fetchWithRetry(imageUrl)

  if (!imgResponse.ok) {
    const errorBody = await imgResponse.text()
    throw new Error(`Pollinations error ${imgResponse.status}: ${errorBody.slice(0, 200)}`)
  }

  const imgBuffer = await imgResponse.arrayBuffer()
  const contentType = imgResponse.headers.get('content-type') || 'image/jpeg'
  const bytes = new Uint8Array(imgBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  const imageData = `data:${contentType};base64,${base64}`

  return {
    image: imageData,
    imageUrl,
    provider: 'pollinations',
    size,
    model: POLLINATIONS_MODEL,
  }
}

// ── Main Handler ──

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

    // ── Try ZAI first (primary) ──
    try {
      const result = await generateWithZAI(prompt.trim(), resolvedSize)
      return Response.json(result)
    } catch (zaiErr) {
      const errMsg = zaiErr?.message || 'Unknown ZAI error'
      console.warn(`[image] ZAI failed, falling back to Pollinations: ${errMsg}`)

      const isAuthError = errMsg.includes('401') || errMsg.toLowerCase().includes('auth') || errMsg.includes('token expired')

      // ── Fallback to Pollinations ──
      try {
        const fallbackResult = await generateWithPollinations(prompt, resolvedSize)
        fallbackResult.zaiFallback = true
        fallbackResult.zaiError = isAuthError
          ? 'ZAI API returned 401 — likely geo-restricted from server region. Key works from supported regions.'
          : errMsg
        return Response.json(fallbackResult)
      } catch (pollErr) {
        const pollMsg = pollErr?.message || 'Unknown Pollinations error'
        console.error(`[image] Both providers failed. ZAI: ${errMsg} | Pollinations: ${pollMsg}`)
        return Response.json(
          {
            error: 'Image generation failed from all providers.',
            details: {
              zai: errMsg,
              zaiHint: isAuthError
                ? 'ZAI API returned 401 — likely geo-restricted from server. The API key works from supported regions.'
                : undefined,
              pollinations: pollMsg,
            }
          },
          { status: 502 }
        )
      }
    }
  } catch (err) {
    console.error('[image] Generation failed:', err)
    const message = err?.message || 'Image generation failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
