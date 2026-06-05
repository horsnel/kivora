/**
 * ZAI API Client — Edge Runtime Compatible
 *
 * Direct fetch-based client for the ZAI API (https://api.z.ai/api/paas/v4).
 * Uses getEnvVar() for Cloudflare Workers env access (secrets not in process.env).
 *
 * Required env vars (set in CloudFlare):
 *   ZAI_BASE_URL  — "https://api.z.ai/api/paas/v4"
 *   ZAI_API_KEY   — your ZAI API key (sent as Authorization: Bearer {key})
 *   ZAI_USER_ID   — (optional) user ID for request tracking
 */

import { getEnvVar } from '@/lib/cfEnv'

const DEFAULT_MODEL = 'glm-5.1'

async function getHeaders() {
  const apiKey = await getEnvVar('ZAI_API_KEY')
  const userId = await getEnvVar('ZAI_USER_ID')
  const h = {
    'Content-Type': 'application/json',
    'Accept-Language': 'en-US,en',
    'Authorization': `Bearer ${apiKey}`,
  }
  if (userId) h['X-User-Id'] = userId
  return h
}

async function getBaseUrl() {
  return await getEnvVar('ZAI_BASE_URL')
}

// ─── LLM Chat Completions ───
export async function chatCompletions(body) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: DEFAULT_MODEL, ...body }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI chat error ${res.status}: ${text}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (body.stream && (ct.includes('text/event-stream') || ct.includes('text/plain'))) {
    return res.body
  }
  return await res.json()
}

// ─── VLM (Vision Language Model) ───
export async function visionCompletions(body) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const res = await fetch(`${baseUrl}/chat/completions/vision`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: DEFAULT_MODEL, ...body }),
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

// ─── Image Generation ───
export async function imageGeneration({ prompt, size = '1024x1024', ...opts }) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const res = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers,
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
          const chunkSize = 8192
          let binary = ''
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize)
            binary += String.fromCharCode.apply(null, chunk)
          }
          return { base64: btoa(binary), format: 'png' }
        }
      }
      return item
    }))
    result.data = processed
  }
  return result
}

// ─── ASR (Speech to Text) ───
export async function audioASR({ audio, ...opts }) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const res = await fetch(`${baseUrl}/audio/asr`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ audio, ...opts }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI ASR error ${res.status}: ${text}`)
  }
  return await res.json()
}

// ─── TTS (Text to Speech) ───
export async function audioTTS({ input, voice = 'alloy', ...opts }) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const res = await fetch(`${baseUrl}/audio/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input, voice, ...opts }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI TTS error ${res.status}: ${text}`)
  }
  return res
}

// ─── Function Invocation ───
export async function invokeFunction(functionName, args) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const res = await fetch(`${baseUrl}/functions/invoke`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ function_name: functionName, arguments: args }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI function error ${res.status}: ${text}`)
  }
  const result = await res.json()
  return result.result
}

// ─── Convenience Wrappers ───

export async function webSearch({ query, num = 10, ...opts }) {
  return invokeFunction('web_search', { query, num, ...opts })
}

export async function webReader({ url, ...opts }) {
  return invokeFunction('web_reader', { url, ...opts })
}

export async function videoUnderstand({ video, prompt, ...opts }) {
  return invokeFunction('video_understand', { video, prompt, ...opts })
}

export async function imageSearch({ query, ...opts }) {
  return invokeFunction('image_search', { query, ...opts })
}

// ─── Image Edit ───
export async function imageEdit(body) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const res = await fetch(`${baseUrl}/images/generations/edit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI image-edit error ${res.status}: ${text}`)
  }
  return await res.json()
}

// ─── Video Generation ───
export async function videoGeneration(body) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const res = await fetch(`${baseUrl}/video/generation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI video-gen error ${res.status}: ${text}`)
  }
  return await res.json()
}

// ─── Async Result Query ───
export async function asyncResult(taskId) {
  const [baseUrl, headers] = await Promise.all([getBaseUrl(), getHeaders()])
  const url = `${baseUrl}/async-result?id=${encodeURIComponent(taskId)}`
  const res = await fetch(url, {
    method: 'GET',
    headers,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ZAI async-result error ${res.status}: ${text}`)
  }
  return await res.json()
}
