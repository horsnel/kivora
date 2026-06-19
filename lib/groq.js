import Groq from 'groq-sdk'

// ── Groq routing ──
// ALL Kivora endpoints route through the Vercel proxy by default.
// Cloudflare Workers IPs are blocked by api.groq.com (403 Forbidden),
// so direct calls from kivora.pages.dev fail for every endpoint — not just
// /api/chat. The Vercel serverless proxy runs on AWS Lambda IPs (not blocked)
// and transparently falls back to GROQ_API_KEY_FALLBACK on 429/403/413.
//
// Override the proxy URL with GROQ_PROXY_URL env var if needed.
const GROQ_BASE_URL = process.env.GROQ_PROXY_URL || 'https://kivora-groq-proxy.vercel.app/api/groq'

// ── Lazy-initialized Groq clients ──
let primaryClient = null
let fallbackClient = null
let _primaryChecked = false
let _fallbackChecked = false

// ── Gemini fallback state ──
let _geminiApiKey = null

// ── OpenRouter fallback state ──
let _openrouterApiKey = null

function getPrimaryClient() {
  if (!_primaryChecked) {
    _primaryChecked = true
    const key = process.env.GROQ_API_KEY || ''
    if (key) primaryClient = new Groq({ apiKey: key, baseURL: GROQ_BASE_URL })
  }
  return primaryClient
}

function getFallbackClient() {
  if (!_fallbackChecked) {
    _fallbackChecked = true
    const key = process.env.GROQ_API_KEY_FALLBACK || ''
    if (key) fallbackClient = new Groq({ apiKey: key, baseURL: GROQ_BASE_URL })
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
  { id: 'llama-3.3-70b-versatile', name: 'Nova 2.3', tag: 'Premium · Detailed' },
  { id: 'llama-3.1-8b-instant', name: 'Nova 1.7', tag: 'Free · Fast' },
  { id: 'llama3-70b-8192', name: 'Nova 2.3 Pro', tag: 'Extended context' },
  { id: 'mixtral-8x7b-32768', name: 'Nova 2.3 Mix', tag: 'Long context' },
  { id: 'gemma2-9b-it', name: 'Nova 1.7 Lite', tag: 'Efficient' },
]

/**
 * Async getter that can use Cloudflare Workers secrets.
 * Pass the apiKey explicitly (obtained via getEnvVar from cfEnv.js).
 */
export async function getPrimaryClientAsync(apiKey) {
  if (primaryClient) return primaryClient
  if (!apiKey) return null
  primaryClient = new Groq({ apiKey, baseURL: GROQ_BASE_URL })
  _primaryChecked = true
  return primaryClient
}

export async function getFallbackClientAsync(apiKey) {
  if (fallbackClient) return fallbackClient
  if (!apiKey) return null
  fallbackClient = new Groq({ apiKey, baseURL: GROQ_BASE_URL })
  _fallbackChecked = true
  return fallbackClient
}

/**
 * Set the Gemini API key for second-fallback use.
 * Call this in your API route after getting the key via getEnvVar().
 */
export function setGeminiApiKey(key) {
  _geminiApiKey = key || null
}

/**
 * Set the OpenRouter API key for third-fallback use.
 * Call this in your API route after getting the key via getEnvVar().
 */
export function setOpenrouterApiKey(key) {
  _openrouterApiKey = key || null
}

// ── Gemini Model Mapping ──
// Maps Groq model IDs to equivalent Gemini models via OpenAI-compatible endpoint
const GEMINI_MODEL_MAP = {
  'llama-3.3-70b-versatile': 'gemini-2.0-flash',
  'llama-3.1-8b-instant': 'gemini-2.0-flash-lite',
  'llama3-70b-8192': 'gemini-2.0-flash',
  'mixtral-8x7b-32768': 'gemini-2.0-flash',
  'gemma2-9b-it': 'gemini-2.0-flash-lite',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'gemini-2.0-flash',
}

function mapModelToGemini(groqModel) {
  return GEMINI_MODEL_MAP[groqModel] || 'gemini-2.0-flash'
}

// ── OpenRouter Model Mapping ──
// Maps Groq model IDs to equivalent OpenRouter models
const OPENROUTER_MODEL_MAP = {
  'llama-3.3-70b-versatile': 'meta-llama/llama-3.3-70b-instruct',
  'llama-3.1-8b-instant': 'meta-llama/llama-3.1-8b-instruct',
  'llama3-70b-8192': 'meta-llama/llama-3-70b-instruct',
  'mixtral-8x7b-32768': 'mistralai/mixtral-8x7b-instruct',
  'gemma2-9b-it': 'google/gemma-2-9b-it',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'google/gemini-2.5-flash',
}

function mapModelToOpenRouter(groqModel) {
  return OPENROUTER_MODEL_MAP[groqModel] || 'google/gemini-2.5-flash'
}

/**
 * Call OpenRouter chat completions endpoint.
 * Uses fetch() directly — no extra SDK needed.
 */
async function openrouterChat(params) {
  if (!_openrouterApiKey) return null

  const orModel = mapModelToOpenRouter(params.model)
  const url = 'https://openrouter.ai/api/v1/chat/completions'

  // Build the request body — same format as Groq/OpenAI
  const body = { ...params, model: orModel }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_openrouterApiKey}`,
      'HTTP-Referer': 'https://kivora.pages.dev',
      'X-Title': 'Kivora',
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter ${response.status}: ${errorText.slice(0, 300)}`)
  }

  const data = await response.json()
  // Tag the response so the caller knows which provider served it
  data._provider = 'openrouter'
  return data
}

/**
 * Call Gemini's OpenAI-compatible chat completions endpoint.
 * Uses fetch() directly — no extra SDK needed.
 */
async function geminiChat(params) {
  if (!_geminiApiKey) return null

  const geminiModel = mapModelToGemini(params.model)
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

  // Build the request body — same format as Groq/OpenAI
  const body = { ...params, model: geminiModel }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_geminiApiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 300)}`)
  }

  const data = await response.json()
  // Tag the response so the caller knows which provider served it
  data._provider = 'gemini'
  return data
}

/**
 * Check if a Groq error is a rate-limit / quota exhaustion error.
 */
function isGroqRateLimitError(err) {
  const status = err.status || err.statusCode || 0
  const msg = err.message || ''
  return status === 429 ||
    msg.includes('rate limit') ||
    msg.includes('Rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests') ||
    msg.includes('exceeded') ||
    msg.includes('Quota') ||
    msg.includes('quota') ||
    msg.includes('daily limit') ||
    msg.includes('capacity')
}

/**
 * Custom error for Groq quota exhaustion (all providers failed).
 * Use err.code to distinguish: 'GROQ_QUOTA_EXCEEDED' vs 'GROQ_SERVER_ERROR'.
 */
export class GroqError extends Error {
  constructor(message, code, originalError) {
    super(message)
    this.name = 'GroqError'
    this.code = code
    this.originalError = originalError
  }
}

/**
 * Create a chat completion with automatic 4-tier fallback:
 *   1. Groq (primary key) — via Vercel proxy
 *   2. Groq (fallback key) — via Vercel proxy
 *   3. Gemini (second fallback via OpenAI-compatible endpoint)
 *   4. OpenRouter (third fallback — multiple models available)
 *
 * Throws GroqError with code 'GROQ_QUOTA_EXCEEDED' when all providers fail,
 * or 'GROQ_SERVER_ERROR' for non-retryable failures.
 */
export async function groqChat(params) {
  const primary = getPrimaryClient()
  if (!primary) throw new GroqError('Groq API key not configured', 'GROQ_NOT_CONFIGURED')

  try {
    return await primary.chat.completions.create(params)
  } catch (err) {
    const status = err.status || err.statusCode || 0
    const isRetryable = isGroqRateLimitError(err) || (status >= 500 && status < 600)

    if (!isRetryable) {
      // Non-retryable error — no point trying fallbacks
      throw new GroqError(err.message || 'Groq request failed.', 'GROQ_SERVER_ERROR', err)
    }

    // ── Tier 2: Try Groq fallback key ──
    const fallback = getFallbackClient()
    if (fallback) {
      console.warn('[groq] Primary key failed, trying Groq fallback', { status, msg: err.message?.slice(0, 80) })
      try {
        return await fallback.chat.completions.create(params)
      } catch (fallbackErr) {
        const fbStatus = fallbackErr.status || fallbackErr.statusCode || 0
        const fbRetryable = isGroqRateLimitError(fallbackErr) || (fbStatus >= 500 && fbStatus < 600)
        if (!fbRetryable) {
          throw new GroqError(fallbackErr.message || 'Groq request failed.', 'GROQ_SERVER_ERROR', fallbackErr)
        }
        // Fallback also failed with retryable error — continue to Gemini
      }
    }

    // ── Tier 3: Try Gemini as second fallback ──
    if (_geminiApiKey) {
      console.warn('[groq] Both Groq keys failed, trying Gemini fallback')
      try {
        return await geminiChat(params)
      } catch (geminiErr) {
        console.warn('[groq] Gemini fallback also failed', { msg: geminiErr.message?.slice(0, 120) })
      }
    }

    // ── Tier 4: Try OpenRouter as third fallback ──
    if (_openrouterApiKey) {
      console.warn('[groq] All previous providers failed, trying OpenRouter fallback')
      try {
        return await openrouterChat(params)
      } catch (orErr) {
        console.warn('[groq] OpenRouter fallback also failed', { msg: orErr.message?.slice(0, 120) })
      }
    }

    // All providers exhausted
    throw new GroqError('Too many requests, try again later.', 'GROQ_QUOTA_EXCEEDED', err)
  }
}
