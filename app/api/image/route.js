export const runtime = 'edge'

// ── Image Generation: ZAI (primary) → Pollinations AI (fallback) ──
//
// ZAI API: https://api.z.ai/api/paas/v4
//   - POST /images/generations with Bearer token auth
//   - May be geo-restricted (401 from certain regions)
//
// Pollinations AI (fallback): https://pollinations.ai
//   - Free tier: GET endpoint, no API key
//   - Paid tier: POST endpoint with API key (sk_...) for higher rate limits
//   - If POLLINATIONS_API_KEY is set, use the paid endpoint
//   - Otherwise fall back to free GET endpoint with retry for 402 (queue full)

import { imageGeneration } from '@/lib/zai'
import { getEnvVar } from '@/lib/cfEnv'

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
const POLLINATIONS_MODEL = 'flux'
const MAX_RETRIES = 5
const RETRY_BASE_MS = 3000

// Helper to convert ArrayBuffer to base64 efficiently (chunked for edge runtime)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}

// ── ZAI Image Generation (Primary) ──

async function generateWithZAI(prompt, size) {
  const result = await imageGeneration({ prompt, size })
  if (result.data && result.data.length > 0) {
    const item = result.data[0]
    const base64Data = item.base64 || item.url || ''
    const format = item.format || 'png'
    const imageData = base64Data.startsWith('data:')
      ? base64Data
      : `data:image/${format};base64,${base64Data}`
    return { image: imageData, provider: 'zai', size, model: 'zai-image' }
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

async function generateWithPollinationsPaid(prompt, size) {
  const pollApiKey = await getEnvVar('POLLINATIONS_API_KEY')
  // Use the Pollinations paid API (POST) with API key — bypasses rate limits
  const res = await fetch('https://image.pollinations.ai/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pollApiKey}`,
    },
    body: JSON.stringify({
      prompt: enhancePrompt(prompt.trim()),
      width: parseInt(size.split('x')[0]),
      height: parseInt(size.split('x')[1]),
      model: POLLINATIONS_MODEL,
      nologo: true,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Pollinations paid error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const imgBuffer = await res.arrayBuffer()
  const base64 = arrayBufferToBase64(imgBuffer)
  const imageData = `data:${contentType};base64,${base64}`

  return { image: imageData, provider: 'pollinations-paid', size, model: POLLINATIONS_MODEL }
}

async function generateWithPollinationsFree(prompt, size) {
  // Free GET endpoint — no API key needed, but 402 (queue full) is common
  const [width, height] = size.split('x').map(Number)
  const encodedPrompt = encodeURIComponent(enhancePrompt(prompt.trim()))
  const params = new URLSearchParams({
    width: String(width), height: String(height),
    model: POLLINATIONS_MODEL, nologo: 'true',
  })

  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`
  const imgResponse = await fetchWithRetry(imageUrl)

  if (!imgResponse.ok) {
    const errorBody = await imgResponse.text()
    throw new Error(`Pollinations free error ${imgResponse.status}: ${errorBody.slice(0, 200)}`)
  }

  const imgBuffer = await imgResponse.arrayBuffer()
  const contentType = imgResponse.headers.get('content-type') || 'image/jpeg'
  const base64 = arrayBufferToBase64(imgBuffer)
  const imageData = `data:${contentType};base64,${base64}`

  return { image: imageData, imageUrl, provider: 'pollinations', size, model: POLLINATIONS_MODEL }
}

async function generateWithPollinations(prompt, size) {
  // Try paid API first (if key available), then fall back to free endpoint
  const pollApiKey = await getEnvVar('POLLINATIONS_API_KEY')
  if (pollApiKey) {
    try {
      return await generateWithPollinationsPaid(prompt, size)
    } catch (err) {
      console.warn(`[image] Pollinations paid failed, trying free endpoint: ${err.message}`)
      // Fall through to free endpoint
    }
  }
  return await generateWithPollinationsFree(prompt, size)
}

// ── Main Handler ──

export async function POST(req) {
  try {
    const body = await req.json()
    const { prompt, size } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json({ error: 'Prompt is required and must be a non-empty string.' }, { status: 400 })
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
          ? 'ZAI API returned 401 — likely geo-restricted from server region.'
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
              zaiHint: isAuthError ? 'ZAI API returned 401 — likely geo-restricted from server.' : undefined,
              pollinations: pollMsg,
            }
          },
          { status: 502 }
        )
      }
    }
  } catch (err) {
    console.error('[image] Generation failed:', err)
    return Response.json({ error: err?.message || 'Image generation failed.' }, { status: 500 })
  }
}
