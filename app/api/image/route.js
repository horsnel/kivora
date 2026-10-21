export const runtime = 'edge' 
import { rateLimit, getClientIP } from '@/lib/ratelimit'
import { safeJson } from '@/lib/payload'

// ── Image Generation: Pollinations AI ──
//
// Pollinations AI: https://pollinations.ai
//   - Free tier: GET endpoint, no API key
//   - Paid tier: POST endpoint with API key (sk_...) for higher rate limits
//   - If POLLINATIONS_API_KEY is set, use the paid endpoint
//   - Otherwise fall back to free GET endpoint with retry for 402 (queue full)

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
const MAX_RETRIES = 2
const RETRY_BASE_MS = 1500

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

// v5.15.2 — Pollinations anonymous protocol (observed live): 2xx + JPEG body
// = real artwork; 402 + JPEG body = "Free limit reached" placeholder card
// (1 free image per 45s per IP) — the body is NEVER the artwork. Accept only
// 2xx with image magic bytes; anything else falls through (SiliconFlow
// fallback rescues rate-limit windows).
function isImageBody(bytes) {
  if (!bytes || bytes.length < 2000) return false
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return true // JPEG
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return true // PNG
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true // WEBP
  return false
}

// ── Pollinations Image Generation ──

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
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (res.ok && isImageBody(bytes)) {
      return { res, buffer }
    }
    // 402 = anonymous rate limit — retrying into the same 45s window is
    // pointless; surface immediately so the SiliconFlow fallback takes over.
    if (res.status === 402) {
      return { res, buffer }
    }
    if (attempt < retries) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt)
      console.warn(`[image] Pollinations HTTP ${res.status} (non-image body), retry ${attempt + 1}/${retries} in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    return { res, buffer }
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
  const { res: imgResponse, buffer } = await fetchWithRetry(imageUrl)

  const bytes = new Uint8Array(buffer)
  if (!imgResponse.ok && !isImageBody(bytes)) {
    const errorBody = new TextDecoder().decode(bytes.subarray(0, 200))
    throw new Error(`Pollinations free error ${imgResponse.status}: ${errorBody.slice(0, 200)}`)
  }

  const contentType = imgResponse.headers.get('content-type') || 'image/jpeg'
  const base64 = arrayBufferToBase64(buffer)
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

async function generateWithSiliconFlow(prompt, size) {
  // v5.15 — independent-vendor fallback: SiliconFlow FLUX.1-schnell (the key
  // is already provisioned for the text chain). Rescues total Pollinations
  // outages instead of hard-failing the feature.
  const sfKey = await getEnvVar('SILICONFLOW_API_KEY')
  if (!sfKey) throw new Error('no SILICONFLOW_API_KEY configured')
  const [width, height] = size.split('x').map(Number)
  const res = await fetch('https://api.siliconflow.cn/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sfKey}`,
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell',
      prompt: enhancePrompt(prompt.trim()),
      image_size: `${width}x${height}`,
      batch_size: 1,
      response_format: 'b64_json',
    }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`SiliconFlow error ${res.status}: ${errText.slice(0, 200)}`)
  }
  const json = await res.json()
  const b64 = String(json?.images?.[0]?.url || '').replace(/^data:[^,]*,/, '')
  if (!b64) throw new Error('SiliconFlow returned no image')
  return { image: `data:image/jpeg;base64,${b64}`, provider: 'siliconflow', size, model: 'FLUX.1-schnell' }
}

// ── Main Handler ──

export async function POST(req) {
  // Rate limit — paid/proxied resource
  const rl = rateLimit(getClientIP(req))
  if (!rl.ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const body = await safeJson(req, 1 * 1024 * 1024)
    if (body === null) {
      return Response.json({ error: 'Payload too large or invalid JSON.' }, { status: 413 })
    }
    const { prompt, size } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json({ error: 'Prompt is required and must be a non-empty string.' }, { status: 400 })
    }

    const resolvedSize = VALID_SIZES.includes(size) ? size : DEFAULT_SIZE

    // ── Generate: SiliconFlow (keyed, primary) → Pollinations (free fallback) ──
    // v5.15.3 — Pollinations' anonymous tier is 1 img/45s/IP and all CF Pages
    // traffic shares a few egress IPs, so its window is usually exhausted in
    // production. The keyed SiliconFlow FLUX.1-schnell endpoint is the
    // deterministic primary; Pollinations remains the free fallback.
    const sfKey = await getEnvVar('SILICONFLOW_API_KEY')
    if (sfKey) {
      try {
        const sfResult = await generateWithSiliconFlow(prompt, resolvedSize)
        return Response.json(sfResult)
      } catch (sfErr) {
        console.warn(`[image] SiliconFlow failed ("${String(sfErr?.message || sfErr).slice(0, 120)}"), trying Pollinations fallback`)
      }
    }
    try {
      const result = await generateWithPollinations(prompt, resolvedSize)
      return Response.json(result)
    } catch (pollErr) {
      const pollMsg = pollErr?.message || 'Unknown Pollinations error'
      console.error(`[image] Image generation failed: ${pollMsg}`)
      return Response.json(
        { error: 'Image generation failed.', details: { siliconflow: sfKey ? 'attempted — see logs' : 'no key configured', pollinations: pollMsg } },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error('[image] Generation failed:', err)
    return Response.json({ error: err?.message || 'Image generation failed.' }, { status: 500 })
  }
}
