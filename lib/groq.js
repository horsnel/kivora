import Groq from 'groq-sdk'

// Lazy-initialized Groq clients
let primaryClient = null
let fallbackClient = null
let _primaryChecked = false
let _fallbackChecked = false

function getPrimaryClient() {
  if (!_primaryChecked) {
    _primaryChecked = true
    const key = process.env.GROQ_API_KEY || ''
    if (key) primaryClient = new Groq({ apiKey: key })
  }
  return primaryClient
}

function getFallbackClient() {
  if (!_fallbackChecked) {
    _fallbackChecked = true
    const key = process.env.GROQ_API_KEY_FALLBACK || ''
    if (key) fallbackClient = new Groq({ apiKey: key })
  }
  return fallbackClient
}

// Backward-compatible export — lazily initialized via Proxy
export const groq = new Proxy({ __isProxy: true }, {
  get(target, prop) {
    const client = getPrimaryClient()
    if (!client) return null
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
  has(target, prop) {
    const client = getPrimaryClient()
    return client ? prop in client : false
  }
})

export const MODEL = 'llama-3.3-70b-versatile'
export const MODEL_FAST = 'llama-3.1-8b-instant'
export const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export const ALLOWED_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tag: 'Default · Fastest' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tag: 'Quick responses' },
  { id: 'llama3-70b-8192', name: 'Llama 3 70B', tag: 'Detailed' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'Long context' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', tag: 'Efficient' },
]

/**
 * Async getter that can use Cloudflare Workers secrets.
 * Pass the apiKey explicitly (obtained via getEnvVar from cfEnv.js).
 */
export async function getPrimaryClientAsync(apiKey) {
  if (primaryClient) return primaryClient
  if (!apiKey) return null
  primaryClient = new Groq({ apiKey })
  return primaryClient
}

export async function getFallbackClientAsync(apiKey) {
  if (fallbackClient) return fallbackClient
  if (!apiKey) return null
  fallbackClient = new Groq({ apiKey })
  return fallbackClient
}

/**
 * Create a chat completion with automatic fallback.
 */
export async function groqChat(params) {
  const primary = getPrimaryClient()
  if (!primary) throw new Error('Groq API key not configured')

  try {
    return await primary.chat.completions.create(params)
  } catch (err) {
    const status = err.status || err.statusCode || 0
    const isRetryable = status === 429 || (status >= 500 && status < 600) ||
      err.message?.includes('rate limit') ||
      err.message?.includes('Rate limit') ||
      err.message?.includes('too many requests') ||
      err.message?.includes('exceeded')

    const fallback = getFallbackClient()
    if (!isRetryable || !fallback) throw err

    console.warn('[groq] Primary key failed, trying fallback', { status, msg: err.message?.slice(0, 80) })
    return await fallback.chat.completions.create(params)
  }
}
