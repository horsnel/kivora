import Groq from 'groq-sdk'

// Primary and fallback API keys
const primaryApiKey = process.env.GROQ_API_KEY || ''
const fallbackApiKey = process.env.GROQ_API_KEY_FALLBACK || ''

// Lazy-initialized Groq clients
let primaryClient = null
let fallbackClient = null

function getPrimaryClient() {
  if (!primaryClient && primaryApiKey) {
    primaryClient = new Groq({ apiKey: primaryApiKey })
  }
  return primaryClient
}

function getFallbackClient() {
  if (!fallbackClient && fallbackApiKey) {
    fallbackClient = new Groq({ apiKey: fallbackApiKey })
  }
  return fallbackClient
}

// Backward-compatible export — uses primary client
export const groq = primaryApiKey ? new Groq({ apiKey: primaryApiKey }) : null

export const MODEL = 'llama-3.3-70b-versatile'
export const MODEL_FAST = 'llama-3.1-8b-instant'
export const VISION_MODEL = 'llama-3.2-90b-vision-preview'

export const ALLOWED_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tag: 'Default · Fastest' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tag: 'Quick responses' },
  { id: 'llama3-70b-8192', name: 'Llama 3 70B', tag: 'Detailed' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'Long context' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', tag: 'Efficient' },
]

/**
 * Create a chat completion with automatic fallback.
 * If the primary key hits a rate limit (429) or server error (5xx),
 * the request is retried with the fallback key.
 *
 * Usage: same as groq.chat.completions.create(...)
 *   await groqChat({ model, messages, ...options })
 */
export async function groqChat(params) {
  const primary = getPrimaryClient()
  if (!primary) throw new Error('Groq API key not configured')

  try {
    return await primary.chat.completions.create(params)
  } catch (err) {
    // Only fall back on rate limit (429) or server errors (5xx)
    const status = err.status || err.statusCode || 0
    const isRetryable = status === 429 || (status >= 500 && status < 600) ||
      err.message?.includes('rate limit') ||
      err.message?.includes('Rate limit') ||
      err.message?.includes('too many requests') ||
      err.message?.includes('exceeded')

    const fallback = getFallbackClient()
    if (!isRetryable || !fallback) throw err

    console.log('[groq] Primary key failed, trying fallback', { status, msg: err.message?.slice(0, 80) })
    return await fallback.chat.completions.create(params)
  }
}
