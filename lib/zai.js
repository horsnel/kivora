/**
 * ZAI API Client — Edge Runtime Compatible
 *
 * Direct fetch-based client for the ZAI API (https://api.z.ai/api/paas/v4).
 * Replaces the z-ai-web-dev-sdk which requires Node.js (fs, os, path) and
 * doesn't work on Cloudflare Pages Edge runtime.
 *
 * Required env vars (set in CloudFlare):
 *   ZAI_BASE_URL  — e.g. "https://api.z.ai/api/paas/v4"
 *   ZAI_API_KEY   — your ZAI API key
 *   ZAI_TOKEN     — (optional) JWT token for user context
 *   ZAI_USER_ID   — (optional) user ID for request tracking
 *   ZAI_CHAT_ID   — (optional) chat ID for conversation context
 */

const BASE_URL = process.env.ZAI_BASE_URL || ''
const API_KEY  = process.env.ZAI_API_KEY  || ''
const TOKEN    = process.env.ZAI_TOKEN    || ''
const USER_ID  = process.env.ZAI_USER_ID  || ''
const CHAT_ID  = process.env.ZAI_CHAT_ID  || ''

function headers() {
  const h = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Z-AI-From': 'Z',
  }
  if (CHAT_ID)  h['X-Chat-Id']  = CHAT_ID
  if (USER_ID)  h['X-User-Id']  = USER_ID
  if (TOKEN)    h['X-Token']    = TOKEN
  return h
}

/**
 * LLM Chat Completions
 * POST {baseUrl}/chat/completions
 */
export async function chatCompletions(body) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...body, thinking: body.thinking || { type: 'disabled' } }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI chat error ${res.status}: ${text}`)
  }
  // Handle streaming
  const ct = res.headers.get('content-type') || ''
  if (body.stream && (ct.includes('text/event-stream') || ct.includes('text/plain'))) {
    return res.body // ReadableStream
  }
  return await res.json()
}

/**
 * VLM (Vision Language Model)
 * POST {baseUrl}/chat/completions/vision
 */
export async function visionCompletions(body) {
  const res = await fetch(`${BASE_URL}/chat/completions/vision`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...body, thinking: body.thinking || { type: 'disabled' } }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI vision error ${res.status}: ${text}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (body.stream && (ct.includes('text/event-stream') || ct.includes('text/plain'))) {
    return res.body
  }
  return await res.json()
}

/**
 * Image Generation
 * POST {baseUrl}/images/generations
 * Returns { data: [{ base64, format }] }
 */
export async function imageGeneration({ prompt, size = '1024x1024', ...opts }) {
  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prompt, size, ...opts }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI image-gen error ${res.status}: ${text}`)
  }
  const result = await res.json()

  // Convert any URLs to base64 (matching SDK behavior)
  if (result.data) {
    const processed = await Promise.all(result.data.map(async (item) => {
      if (item.url) {
        const imgRes = await fetch(item.url)
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer()
          const bytes = new Uint8Array(buf)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          return { base64: btoa(binary), format: 'png' }
        }
      }
      return item
    }))
    result.data = processed
  }
  return result
}

/**
 * ASR (Speech to Text)
 * POST {baseUrl}/audio/asr
 */
export async function audioASR({ audio, ...opts }) {
  const res = await fetch(`${BASE_URL}/audio/asr`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ audio, ...opts }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI ASR error ${res.status}: ${text}`)
  }
  return await res.json()
}

/**
 * TTS (Text to Speech)
 * POST {baseUrl}/audio/tts
 * Returns the raw Response object so caller can handle audio stream
 */
export async function audioTTS({ input, voice = 'alloy', ...opts }) {
  const res = await fetch(`${BASE_URL}/audio/tts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ input, voice, ...opts }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI TTS error ${res.status}: ${text}`)
  }
  return res // Return raw Response for audio handling
}

/**
 * Function Invocation (Web Search, Web Reader, Video Understanding, etc.)
 * POST {baseUrl}/functions/invoke
 */
export async function invokeFunction(functionName, args) {
  const res = await fetch(`${BASE_URL}/functions/invoke`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ function_name: functionName, arguments: args }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI function error ${res.status}: ${text}`)
  }
  const result = await res.json()
  return result.result
}

/**
 * Web Search — convenience wrapper
 */
export async function webSearch({ query, num = 10, ...opts }) {
  return invokeFunction('web_search', { query, num, ...opts })
}

/**
 * Web Reader — convenience wrapper
 */
export async function webReader({ url, ...opts }) {
  return invokeFunction('web_reader', { url, ...opts })
}

/**
 * Video Understanding — convenience wrapper
 */
export async function videoUnderstand({ video, prompt, ...opts }) {
  return invokeFunction('video_understand', { video, prompt, ...opts })
}

/**
 * Image Search — convenience wrapper
 */
export async function imageSearch({ query, ...opts }) {
  return invokeFunction('image_search', { query, ...opts })
}

/**
 * Image Edit — convenience wrapper
 */
export async function imageEdit(body) {
  const res = await fetch(`${BASE_URL}/images/generations/edit`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI image-edit error ${res.status}: ${text}`)
  }
  return await res.json()
}

/**
 * Video Generation — convenience wrapper
 */
export async function videoGeneration(body) {
  const res = await fetch(`${BASE_URL}/video/generation`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI video-gen error ${res.status}: ${text}`)
  }
  return await res.json()
}

/**
 * Async Result Query — for long-running tasks
 */
export async function asyncResult(taskId) {
  const url = `${BASE_URL}/async-result?id=${encodeURIComponent(taskId)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: headers(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI async-result error ${res.status}: ${text}`)
  }
  return await res.json()
}
