import Groq from 'groq-sdk'

// ── Multi-provider routing ──
// Direct providers (Cerebras, SambaNova, SiliconFlow) are called from CF Pages
// with no proxy needed — they don't IP-block Cloudflare Workers like Groq does.
// Groq is still routed through the Vercel proxy (AWS Lambda IPs, not blocked).
// Gemini and OpenRouter remain as last-resort fallbacks.
//
// Override the Groq proxy URL with GROQ_PROXY_URL env var if needed.
const GROQ_PROXY_BASE = process.env.GROQ_PROXY_URL || 'https://kivora-groq-proxy.vercel.app/api/groq'

// ── Provider API key state ──
// Set by route.js after reading CF Workers secrets via getEnvVar().
let _cerebrasKey = null
let _sambanovaKey = null
let _siliconflowKey = null
let _geminiKey = null
let _openrouterKey = null

// ── Groq client state (proxy-routed) ──
let _groqPrimary = null
let _groqFallback = null
let _groqPrimaryChecked = false
let _groqFallbackChecked = false

function getPrimaryClient() {
  if (!_groqPrimaryChecked) {
    _groqPrimaryChecked = true
    const key = process.env.GROQ_API_KEY || ''
    if (key) _groqPrimary = new Groq({ apiKey: key, baseURL: GROQ_PROXY_BASE })
  }
  return _groqPrimary
}

function getFallbackClient() {
  if (!_groqFallbackChecked) {
    _groqFallbackChecked = true
    const key = process.env.GROQ_API_KEY_FALLBACK || ''
    if (key) _groqFallback = new Groq({ apiKey: key, baseURL: GROQ_PROXY_BASE })
  }
  return _groqFallback
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
  if (_groqPrimary) return _groqPrimary
  if (!apiKey) return null
  _groqPrimary = new Groq({ apiKey, baseURL: GROQ_PROXY_BASE })
  _groqPrimaryChecked = true
  return _groqPrimary
}

export async function getFallbackClientAsync(apiKey) {
  if (_groqFallback) return _groqFallback
  if (!apiKey) return null
  _groqFallback = new Groq({ apiKey, baseURL: GROQ_PROXY_BASE })
  _groqFallbackChecked = true
  return _groqFallback
}

// ── Provider key setters (called by route.js after CF Workers secret lookup) ──
export function setCerebrasApiKey(key) { _cerebrasKey = key || null }
export function setSambanovaApiKey(key) { _sambanovaKey = key || null }
export function setSiliconflowApiKey(key) { _siliconflowKey = key || null }
export function setGeminiApiKey(key) { _geminiKey = key || null }
export function setOpenrouterApiKey(key) { _openrouterKey = key || null }

// ── Provider-specific model name mapping ──
// Kivora requests 'llama-3.3-70b-versatile' (Groq's name). Each direct provider
// has its own naming convention, so map the canonical name → provider name.
const PROVIDER_MODEL_MAP = {
  cerebras: {
    'llama-3.3-70b-versatile': 'llama3.3-70b',
    'llama-3.1-8b-instant': 'llama3.1-8b',
  },
  sambanova: {
    'llama-3.3-70b-versatile': 'Meta-Llama-3.3-70B-Instruct',
    'llama-3.1-8b-instant': 'Meta-Llama-3.1-8B-Instruct',
  },
  siliconflow: {
    // Llama-3.3-70B is disabled on SiliconFlow's free tier; Qwen 2.5 72B is the
    // closest available substitute (also ~72B params, OpenAI-compatible, tool-use).
    'llama-3.3-70b-versatile': 'Qwen/Qwen2.5-72B-Instruct',
    'llama-3.1-8b-instant': 'Qwen/Qwen2.5-7B-Instruct',
  },
  gemini: {
    'llama-3.3-70b-versatile': 'gemini-2.0-flash',
    'llama-3.1-8b-instant': 'gemini-2.0-flash-lite',
    'llama3-70b-8192': 'gemini-2.0-flash',
    'mixtral-8x7b-32768': 'gemini-2.0-flash',
    'gemma2-9b-it': 'gemini-2.0-flash-lite',
    'meta-llama/llama-4-scout-17b-16e-instruct': 'gemini-2.0-flash',
  },
  openrouter: {
    'llama-3.3-70b-versatile': 'meta-llama/llama-3.3-70b-instruct',
    'llama-3.1-8b-instant': 'meta-llama/llama-3.1-8b-instruct',
    'llama3-70b-8192': 'meta-llama/llama-3-70b-instruct',
    'mixtral-8x7b-32768': 'mistralai/mixtral-8x7b-instruct',
    'gemma2-9b-it': 'google/gemma-2-9b-it',
    'meta-llama/llama-4-scout-17b-16e-instruct': 'google/gemini-2.5-flash',
  },
}

function mapModel(provider, requestedModel) {
  return PROVIDER_MODEL_MAP[provider]?.[requestedModel] || requestedModel
}

// ── Generic OpenAI-compatible chat completion via direct fetch ──
// Used by Cerebras, SambaNova, SiliconFlow, Gemini, and OpenRouter.
// All of these providers expose /chat/completions with the same request/response
// shape, so a single helper handles all of them.
async function directChat({ provider, baseURL, apiKey, params }) {
  if (!apiKey) return null

  const model = mapModel(provider, params.model || MODEL)
  const url = `${baseURL}/chat/completions`

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://kivora.pages.dev'
    headers['X-Title'] = 'Kivora'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...params, model }),
  })

  if (!response.ok) {
    const text = await response.text()
    const err = new Error(`${provider} ${response.status}: ${text.slice(0, 300)}`)
    err.status = response.status
    err.provider = provider
    // Parse JSON body so the recovery function can find `failed_generation`.
    try { err.error = JSON.parse(text) } catch { /* non-JSON error body */ }
    throw err
  }

  const data = await response.json()
  data._provider = provider
  return data
}

/**
 * Recover from malformed tool-call syntax.
 *
 * Llama-3.3-70b-versatile has a known bug: when tool args are complex
 * (e.g. deploy_site with nested JSON), the model sometimes emits text-based
 * tool-call syntax in the response content instead of using the proper
 * tool_calls channel. Groq rejects this with HTTP 400 and a body like:
 *
 *   {
 *     "error": {
 *       "message": "Failed to call a function. ...",
 *       "type": "invalid_request_error",
 *       "code": "tool_use_failed",
 *       "failed_generation": "<function=name=\"deploy_site\"{\"files\":\"...\"}</function>"
 *     }
 *   }
 *
 * This function parses `failed_generation`, extracts the intended tool name
 * and arguments, fixes common type mismatches (string-encoded JSON → parsed),
 * and synthesizes a proper Groq response object with a valid `tool_calls`
 * array. The caller can then execute the tool as if the model had called it
 * correctly.
 *
 * Returns the synthesized response, or `null` if recovery was not possible.
 */
function recoverMalformedToolCall(err, params) {
  // Only attempt recovery on 400 errors
  const status = err?.status || err?.statusCode || 0
  if (status !== 400) return null

  // The failed_generation field can be in several places depending on how
  // the SDK surfaced the error. Try each in order.
  let errorBody = err?.error || err?.body
  if (typeof errorBody === 'string') {
    try { errorBody = JSON.parse(errorBody) } catch { errorBody = null }
  }

  // SDK sometimes wraps the body in { error: { ... } }, sometimes not
  const innerError = errorBody?.error || errorBody
  let failedGen = innerError?.failed_generation

  // Last-ditch: search the error message for the malformed syntax
  if (!failedGen && typeof err?.message === 'string') {
    const m = err.message.match(/<function=[\s\S]*?<\/function>|<function=[^>]*>|<tool_call>[\s\S]*?<\/tool_call>/)
    if (m) failedGen = m[0]
  }

  if (!failedGen || typeof failedGen !== 'string') return null
  if (!failedGen.includes('<function=') && !failedGen.includes('<tool_call>')) return null

  // Extract tool name and args. We support multiple variants the model emits:
  //   <function=name="tool_name"{args}></function>
  //   <function=name='tool_name'{args}></function>
  //   <function=tool_name{args}></function>
  //   <function=tool_name {args}></function>
  //   <function=tool_name {args}>              (no closing tag)
  //   <tool_call>{"name":"tool_name","arguments":{...}}</tool_call>
  let toolName = null
  let argsStr = null

  // Variant A: <function=NAME{...}>...</function> (or without closing tag)
  // Use regex to extract the tool name, then balanced-brace scan to extract
  // the args JSON. A non-greedy regex for args breaks when the JSON contains
  // nested objects/arrays (each } would terminate the match prematurely).
  const fnMatch = failedGen.match(/<function=(?:name\s*=\s*)?["']?([A-Za-z_][\w]*)["']?\s*/)
  if (fnMatch) {
    toolName = fnMatch[1]
    const argsStart = failedGen.indexOf('{', fnMatch[0].length)
    if (argsStart !== -1) {
      let depth = 0
      let inString = false
      let escape = false
      let argsEnd = -1
      for (let i = argsStart; i < failedGen.length; i++) {
        const c = failedGen[i]
        if (escape) { escape = false; continue }
        if (c === '\\') { escape = true; continue }
        if (c === '"') { inString = !inString; continue }
        if (inString) continue
        if (c === '{') depth++
        else if (c === '}') {
          depth--
          if (depth === 0) { argsEnd = i + 1; break }
        }
      }
      if (argsEnd !== -1) argsStr = failedGen.slice(argsStart, argsEnd)
    }
  }

  // Variant B: <tool_call>{...}</tool_call>
  if (!toolName) {
    const tcMatch = failedGen.match(/<tool_call>([\s\S]*?)<\/tool_call>/)
    if (tcMatch) {
      try {
        const parsed = JSON.parse(tcMatch[1].trim())
        toolName = parsed.name
        argsStr = typeof parsed.arguments === 'string'
          ? parsed.arguments
          : JSON.stringify(parsed.arguments || {})
      } catch {}
    }
  }

  if (!toolName || !argsStr) return null

  // Parse the args JSON. The model often emits malformed JSON, so try
  // several recovery strategies before giving up.
  let args = null
  const tryParse = (s) => {
    try { return JSON.parse(s) } catch { return null }
  }

  // Strategy 1: parse as-is
  args = tryParse(argsStr)

  // Strategy 2: extract the outermost {...} block (in case there's trailing junk)
  if (args === null) {
    const m = argsStr.match(/\{[\s\S]*\}/)
    if (m) args = tryParse(m[0])
  }

  // Strategy 3: fix common escape issues — unescape \" inside string values
  if (args === null) {
    try {
      const fixed = argsStr
        .replace(/\\"/g, '"')   // unescape escaped quotes
        .replace(/\\\\"/g, '\\"') // fix double-escaped quotes
      args = tryParse(fixed)
    } catch {}
  }

  if (args === null || typeof args !== 'object') return null

  // Fix common type mismatches: if a string-typed arg value contains a
  // JSON array/object, parse it. The model often passes arrays/objects as
  // stringified JSON when emitting the malformed syntax.
  for (const [key, val] of Object.entries(args)) {
    if (typeof val !== 'string') continue
    const trimmed = val.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      const parsed = tryParse(trimmed)
      if (parsed !== null) args[key] = parsed
    }
  }

  // Validate the tool name is in the request's tool list — otherwise the
  // downstream tool execution will fail with "tool not found".
  if (Array.isArray(params?.tools) && params.tools.length > 0) {
    const knownNames = new Set(params.tools.map(t => t?.function?.name).filter(Boolean))
    if (!knownNames.has(toolName)) {
      console.warn(`[groq] recovered tool name "${toolName}" not in tools list — skipping recovery`)
      return null
    }
  }

  // Synthesize a proper Groq-compatible response object
  console.warn(`[groq] recovered malformed tool call: ${toolName}`)
  return {
    id: 'recovered-' + Date.now(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: params?.model || 'llama-3.3-70b-versatile',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_recovered_' + Math.random().toString(36).slice(2, 12),
          type: 'function',
          function: {
            name: toolName,
            arguments: JSON.stringify(args)
          }
        }]
      },
      logprobs: null,
      finish_reason: 'tool_calls'
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    _recovered: true
  }
}

/**
 * Check if an error is a rate-limit / quota exhaustion error.
 */
function isRateLimitError(err) {
  const status = err?.status || err?.statusCode || 0
  const msg = err?.message || ''
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
 * Custom error for provider quota exhaustion (all providers failed).
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
 * Multi-provider chat completion with 7-tier fallback.
 *
 *   1. Cerebras (direct — fastest, Llama 3.3 70B)
 *   2. SambaNova (direct — Llama 3.3 70B, generous free tier)
 *   3. SiliconFlow (direct — Qwen 2.5 72B for model diversity)
 *   4. Groq proxy primary (via Vercel — bypasses Groq CF IP-block)
 *   5. Groq proxy fallback key (second key, same Vercel proxy)
 *   6. Gemini (OpenAI-compatible endpoint)
 *   7. OpenRouter (multiple models)
 *
 * Direct providers (1–3) are called from CF Pages without a proxy — they
 * don't IP-block Cloudflare Workers. Groq is routed through the Vercel proxy
 * because api.groq.com returns 403 to CF Workers IPs.
 *
 * Recovery from malformed tool calls is attempted on every provider's error,
 * since Llama-3.3-70B can emit the bug regardless of which provider serves it.
 *
 * Throws GroqError with code 'GROQ_QUOTA_EXCEEDED' when all providers fail
 * with rate limits, or 'GROQ_SERVER_ERROR' for non-retryable failures.
 */
export async function groqChat(params) {
  const requestModel = params?.model || MODEL

  // Provider chain — order matters. First available + successful wins.
  //
  // NOTE: Cerebras is intentionally LAST among direct providers, not first.
  // Cloudflare's WAF (protecting api.cerebras.ai) blocks Cloudflare Workers
  // IPs (kivora.pages.dev runs on CF Workers), returning a 403 challenge
  // page. So Cerebras effectively never works from this deployment.
  // We keep it in the chain in case the WAF behavior changes, but it's last.
  const providers = [
    {
      name: 'sambanova',
      available: () => !!_sambanovaKey,
      call: () => directChat({
        provider: 'sambanova',
        baseURL: 'https://api.sambanova.ai/v1',
        apiKey: _sambanovaKey,
        params,
      }),
    },
    {
      name: 'siliconflow',
      available: () => !!_siliconflowKey,
      call: () => directChat({
        provider: 'siliconflow',
        baseURL: 'https://api.siliconflow.com/v1',
        apiKey: _siliconflowKey,
        params,
      }),
    },
    {
      name: 'cerebras',
      available: () => !!_cerebrasKey,
      call: () => directChat({
        provider: 'cerebras',
        baseURL: 'https://api.cerebras.ai/v1',
        apiKey: _cerebrasKey,
        params,
      }),
    },
    {
      name: 'groq-primary',
      available: () => !!getPrimaryClient() || !!_groqPrimary,
      call: async () => {
        const client = getPrimaryClient() || _groqPrimary
        if (!client) throw new Error('groq-primary not initialized')
        return await client.chat.completions.create(params)
      },
    },
    {
      name: 'groq-fallback',
      available: () => !!getFallbackClient() || !!_groqFallback,
      call: async () => {
        const client = getFallbackClient() || _groqFallback
        if (!client) throw new Error('groq-fallback not initialized')
        return await client.chat.completions.create(params)
      },
    },
    {
      name: 'gemini',
      available: () => !!_geminiKey,
      call: () => directChat({
        provider: 'gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: _geminiKey,
        params,
      }),
    },
    {
      name: 'openrouter',
      available: () => !!_openrouterKey,
      call: () => directChat({
        provider: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: _openrouterKey,
        params,
      }),
    },
  ]

  let lastErr = null
  let lastRateLimitErr = null
  let anyProviderAvailable = false
  // Track every provider's outcome for debugging
  const providerOutcomes = []

  for (const p of providers) {
    if (!p.available()) {
      providerOutcomes.push({ name: p.name, status: 'skipped (no key)' })
      continue
    }
    anyProviderAvailable = true

    try {
      const result = await p.call()
      if (result?._provider && result._provider !== 'groq-sdk') {
        console.warn(`[groq] served by ${result._provider}`)
      }
      providerOutcomes.push({ name: p.name, status: 'ok', provider: result?._provider })
      return result
    } catch (err) {
      // Try recovery from malformed tool calls first — applies to any provider
      // serving Llama-3.3-70B (Cerebras, SambaNova, Groq).
      const recovered = recoverMalformedToolCall(err, params)
      if (recovered) {
        providerOutcomes.push({ name: p.name, status: 'recovered' })
        return recovered
      }

      const status = err.status || err.statusCode || 0
      const isRateLimited = isRateLimitError(err)
      console.warn(`[groq] provider ${p.name} failed: ${status} ${(err.message || '').slice(0, 100)}`)
      providerOutcomes.push({
        name: p.name,
        status: 'failed',
        http_status: status,
        rate_limited: isRateLimited,
        error: (err.message || '').slice(0, 200),
      })

      if (isRateLimited) {
        lastRateLimitErr = err
      }
      lastErr = err

      // Continue to next provider regardless of retryability — different
      // providers may have different failure modes, and we want max availability.
    }
  }

  if (!anyProviderAvailable) {
    const e = new GroqError('No LLM providers configured', 'GROQ_NOT_CONFIGURED')
    e.providerOutcomes = providerOutcomes
    throw e
  }

  // If any provider hit a rate limit, surface that as the user-facing error
  // (more actionable than a generic 500).
  if (lastRateLimitErr) {
    const e = new GroqError('Too many requests, try again later.', 'GROQ_QUOTA_EXCEEDED', lastRateLimitErr)
    e.providerOutcomes = providerOutcomes
    throw e
  }
  const e = new GroqError(lastErr?.message || 'All providers failed.', 'GROQ_SERVER_ERROR', lastErr)
  e.providerOutcomes = providerOutcomes
  throw e
}
