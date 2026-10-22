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

  // v5.15.3 — 2xx-only acceptance. On 402 the body is the "Free limit
  // reached" placeholder card (1 img/45s/IP, shared CF egress) — NEVER the
  // artwork. Accepting it here silently served users a yellow placeholder
  // as their "generated" image.
  if (!imgResponse.ok) {
    const bytes = new Uint8Array(buffer)
    const errBody = new TextDecoder().decode(bytes.subarray(0, 200))
    throw new Error(`Pollinations free error ${imgResponse.status}: ${errBody.slice(0, 200)}`)
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

// ── v5.16 — Cloudflare Workers AI (PRIMARY: watermark-free, account-keyed) ──
// Pollinations' anonymous tier force-stamps a "pollinations.ai" watermark even
// with nologo=true (verified live), and its 1 img/45s/IP window is shared
// across ALL CF Pages egress IPs. Workers AI's FLUX.1-schnell is keyed with
// the SAME CF_API_TOKEN/CF_ACCOUNT_ID the deploy_site tool already uses,
// has a free daily neuron allocation, and returns clean images.
async function generateWithWorkersAI(prompt, size) {
  const cfToken = await getEnvVar('CF_API_TOKEN')
  const cfAccount = await getEnvVar('CF_ACCOUNT_ID')
  if (!cfToken || !cfAccount) throw new Error('no CF_API_TOKEN/CF_ACCOUNT_ID configured')
  // ⚠️ flux-1-schnell schema accepts ONLY prompt/steps — width/height are
  // rejected outright (production-verified 2026-10-23). Output is model-fixed
  // 1024x1024; the requested `size` is kept in the contract but not sent.
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfToken}`,
    },
    body: JSON.stringify({ prompt: enhancePrompt(prompt.trim()), steps: 4 }),
    signal: AbortSignal.timeout(25000),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) {
    const detail = String(json?.errors?.[0]?.message || `HTTP ${res.status}`).slice(0, 200)
    throw new Error(`Workers AI error: ${detail}`)
  }
  const b64 = String(json?.result?.image || '')
  if (!b64) throw new Error('Workers AI returned no image')
  return { image: `data:image/jpeg;base64,${b64}`, provider: 'cf-workersai', size, model: 'flux-1-schnell' }
}

async function generateWithSiliconFlow(prompt, size) {
  // v5.15 — independent-vendor fallback: SiliconFlow FLUX.1-schnell (the key
  // is already provisioned for the text chain). Watermark-free, but the
  // provisioned key has been observed 401-invalid — kept for when it's
  // rotated. Rescues total Pollinations outages instead of hard-failing.
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

    // ── Generate: Workers AI (keyed, watermark-free) → SiliconFlow → Pollinations ──
    // v5.16 — watermark-free providers lead. Pollinations' anonymous tier
    // stamps a watermark and shares one 45s window across all CF egress IPs;
    // it is the last-resort free fallback.
    let waDetail = 'not attempted'
    try {
      const waResult = await generateWithWorkersAI(prompt, resolvedSize)
      return Response.json(waResult)
    } catch (waErr) {
      waDetail = String(waErr?.message || waErr).slice(0, 220)
      console.warn(`[image] Workers AI failed ("${waDetail}"), trying SiliconFlow fallback`)
    }
    const sfKey = await getEnvVar('SILICONFLOW_API_KEY')
    let sfDetail = sfKey ? 'not attempted' : 'no key configured'
    if (sfKey) {
      try {
        const sfResult = await generateWithSiliconFlow(prompt, resolvedSize)
        return Response.json(sfResult)
      } catch (sfErr) {
        sfDetail = String(sfErr?.message || sfErr).slice(0, 220)
        console.warn(`[image] SiliconFlow failed ("${sfDetail}"), trying Pollinations fallback`)
      }
    }
    try {
      const result = await generateWithPollinations(prompt, resolvedSize)
      return Response.json(result)
    } catch (pollErr) {
      const pollMsg = pollErr?.message || 'Unknown Pollinations error'
      console.error(`[image] Image generation failed: ${pollMsg}`)
      return Response.json(
        { error: 'Image generation failed.', details: { workersai: waDetail, siliconflow: sfDetail, pollinations: pollMsg.slice(0, 220) } },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error('[image] Generation failed:', err)
    return Response.json({ error: err?.message || 'Image generation failed.' }, { status: 500 })
  }
}
