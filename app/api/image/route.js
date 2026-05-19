export const runtime = 'edge'

// ── Pollinations AI — Free, Open-Source Image Generation ──
// Docs: https://pollinations.ai
// Simple GET endpoint: https://image.pollinations.ai/prompt/{encoded_prompt}
// Supports: flux, gptimage, seedream, grok-imagine, and more
// No API key required for basic usage. CORS-enabled. Runs on Cloudflare.
//
// Rate limit: 1 concurrent request per IP. 402 = queue full, retry with backoff.

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

// Professional quality model — Flux produces stunning, detailed images
const DEFAULT_MODEL = 'flux'

// Retry config for 402 (queue full) errors
const MAX_RETRIES = 3
const RETRY_BASE_MS = 2000  // 2s base, doubles each retry

// Optional Pollinations API key for higher rate limits (set as Cloudflare secret)
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || ''

/**
 * Fetch with retry for Pollinations 402 (queue full) errors.
 * Pollinations enforces 1 concurrent request per IP — a 402 means the queue
 * is full and we need to wait and retry.
 */
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'image/*' },
    })

    if (res.ok) return res

    // 402 = queue full — retry with exponential backoff
    if (res.status === 402 && attempt < retries) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt)
      console.warn(`[image] Pollinations 402 (queue full), retry ${attempt + 1}/${retries} in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      continue
    }

    // Non-retryable error or out of retries
    return res
  }
}

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
    const [width, height] = resolvedSize.split('x').map(Number)

    // Enhance the prompt for professional quality output
    const enhancedPrompt = enhancePrompt(prompt.trim())

    // Build the Pollinations URL
    // The GET endpoint returns the image directly — no JSON wrapping needed
    const encodedPrompt = encodeURIComponent(enhancedPrompt)
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      model: DEFAULT_MODEL,
      nologo: 'true',
      // NOTE: omit enhance param — our own enhancePrompt() already enriches the text,
      // and enhance=true adds server-side processing that increases 402 risk
    })

    // Add API key if available (for higher rate limits)
    if (POLLINATIONS_API_KEY) {
      params.set('key', POLLINATIONS_API_KEY)
    }

    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`

    // Fetch the generated image (with retry for 402 queue-full errors)
    const imgResponse = await fetchWithRetry(imageUrl)

    if (!imgResponse.ok) {
      const errorBody = await imgResponse.text()
      console.error(`[image] Pollinations returned ${imgResponse.status}:`, errorBody.slice(0, 300))
      return Response.json(
        { error: `Image generation failed (${imgResponse.status}). Please try again.` },
        { status: imgResponse.status >= 500 ? 502 : imgResponse.status }
      )
    }

    // Convert the image to base64 for embedding in the chat
    const imgBuffer = await imgResponse.arrayBuffer()
    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg'

    // Use btoa for edge runtime compatibility
    const bytes = new Uint8Array(imgBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    const imageData = `data:${contentType};base64,${base64}`

    return Response.json({
      image: imageData,
      imageUrl,  // Also return the URL so user can view/download the full-res version
      size: resolvedSize,
      model: DEFAULT_MODEL,
    })
  } catch (err) {
    console.error('[image] Generation failed:', err)
    const message = err?.message || 'Image generation failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * Enhance the user's prompt for professional quality output.
 * Adds quality boosters and style guidance without changing the core intent.
 */
function enhancePrompt(rawPrompt) {
  // If the prompt already has quality descriptors, don't over-enhance
  const hasQualityWords = /professional|high.quality|detailed|4k|8k|ultra|cinematic|studio/i.test(rawPrompt)

  if (hasQualityWords) {
    return rawPrompt
  }

  // Add professional quality enhancements
  return `${rawPrompt}, professional quality, highly detailed, sharp focus, studio lighting`
}
