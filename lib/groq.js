import Groq from 'groq-sdk'
import { mistralChat, isMistralConfigured } from '@/lib/mistral'

// ── Multi-provider routing ──
// Direct providers (Cerebras, SambaNova, SiliconFlow) are called from CF Pages
// with no proxy needed — they don't IP-block Cloudflare Workers like Groq does.
// Groq is still routed through the Vercel proxy (AWS Lambda IPs, not blocked).
// Gemini and OpenRouter remain as last-resort fallbacks.
//
// Override the Groq proxy URL with GROQ_PROXY_URL env var if needed.
// v5.29 note: empirically verified with the real groq-sdk — the SDK appends
// /openai/v1/chat/completions itself, so the base MUST stay prefix-only.
// Adding /openai/v1 here doubles the path (Groq 404). The intermittent
// groq-primary 400s seen in prod have a different cause, now visible via
// the sanitized `debug` payloads on 503s (route.js).
const GROQ_PROXY_BASE = process.env.GROQ_PROXY_URL || 'https://kivora-groq-proxy.vercel.app/api/groq'

// ── Provider API key state ──
// Set by route.js after reading CF Workers secrets via getEnvVar().
let _cerebrasKey = null
let _sambanovaKey = null
let _siliconflowKey = null
let _geminiKey = null
let _openrouterKey = null

// Module-level cache: per-provider rate-limit cooldown timestamps.
// Populated by groqChat() when a provider returns 429 / rate-limit error.
// Persists across requests within the same edge worker lifetime.
// { [providerName: string]: number /* epoch ms when cooldown expires */ }
let _providerRateLimitedUntil = null
// v5.13: self-tuning chain order — last provider that served successfully
// is tried first on the next request; failures earn a 90s soft demotion.
let _chainLastWinner = null
let _chainFailUntil = null

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

// ── Current-generation Groq models (verified against Groq's deprecation page) ──
// 2026-10: Groq shut down the ENTIRE legacy roster we were pinned to —
// llama-3.3-70b-versatile + llama-3.1-8b-instant (08/16/26) and the Llama 4
// vision family scout/maverick (07/17/26, 03/09/26). Every Groq provider hop
// was 404ing on every request (dead latency in the text chain, TOTAL failure
// in the vision chain). Current serving models:
//   text       → openai/gpt-oss-120b · openai/gpt-oss-20b
//   vision     → qwen/qwen3.8-27b (multimodal, tool use, JSON mode)
export const MODEL = 'openai/gpt-oss-120b'
export const MODEL_FAST = 'openai/gpt-oss-20b'
export const VISION_MODEL = 'qwen/qwen3.8-27b'

// Legacy Groq model IDs → current equivalents, applied ONLY on Groq provider
// hops. Historical chat sessions and old clients still send dead IDs; mapping
// them keeps those requests working instead of burning a 404 round-trip
// through the proxy before falling to the next provider.
const GROQ_MODEL_MAP = {
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama3-70b-8192': 'openai/gpt-oss-120b',
  'mixtral-8x7b-32768': 'openai/gpt-oss-120b',
  'gemma2-9b-it': 'openai/gpt-oss-20b',
  'deepseek-r1-distill-llama-70b': 'openai/gpt-oss-120b',
  'qwen-qwq-32b': 'openai/gpt-oss-120b',
  'llama-3.2-3b-preview': 'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'qwen/qwen3.8-27b',
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'qwen/qwen3.8-27b',
}
function mapGroqModel(m) { return GROQ_MODEL_MAP[m] || m }

export const ALLOWED_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'Nova 3', tag: 'Premium · Detailed', pro: false },
  { id: 'openai/gpt-oss-20b', name: 'Nova 1.9', tag: 'Free · Fast', pro: false },
  { id: 'qwen/qwen3.8-27b', name: 'Nova Vision', tag: 'Multimodal · 131K', pro: false },
  // Reasoning models — Pro and above only (gated server-side in /api/chat)
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', tag: 'Reasoning · Pro', pro: true },
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
    'openai/gpt-oss-120b': 'gpt-oss-120b',
    'openai/gpt-oss-20b': 'gpt-oss-20b',
    // Legacy Kivora IDs still arriving from old clients/sessions
    'llama-3.3-70b-versatile': 'llama3.3-70b',
    'llama-3.1-8b-instant': 'llama3.1-8b',
  },
  sambanova: {
    'openai/gpt-oss-120b': 'Meta-Llama-3.3-70B-Instruct',
    'openai/gpt-oss-20b': 'Meta-Llama-3.1-8B-Instruct',
    'qwen/qwen3.8-27b': 'Meta-Llama-3.3-70B-Instruct',
    'deepseek-r1-distill-llama-70b': 'Meta-Llama-3.3-70B-Instruct',
    'llama-3.2-3b-preview': 'Meta-Llama-3.2-3B-Instruct',
  },
  siliconflow: {
    // gpt-oss family is not on SiliconFlow's free tier; Qwen 2.5 72B is the
    // closest hosted substitute (OpenAI-compatible, tool-use).
    'openai/gpt-oss-120b': 'Qwen/Qwen2.5-72B-Instruct',
    'openai/gpt-oss-20b': 'Qwen/Qwen2.5-7B-Instruct',
    'qwen/qwen3.8-27b': 'Qwen/Qwen2.5-72B-Instruct',
    'deepseek-r1-distill-llama-70b': 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
  },
  gemini: {
    // v5.29: 2.0 family retired (api 404s in prod) — moved to 2.5.
    'openai/gpt-oss-120b': 'gemini-2.5-flash',
    'openai/gpt-oss-20b': 'gemini-2.5-flash-lite',
    'qwen/qwen3.8-27b': 'gemini-2.5-flash', // vision-capable
    'deepseek-r1-distill-llama-70b': 'gemini-2.5-flash',
    // Legacy IDs — old sessions
    'llama-3.3-70b-versatile': 'gemini-2.5-flash',
    'llama-3.1-8b-instant': 'gemini-2.5-flash-lite',
    'meta-llama/llama-4-scout-17b-16e-instruct': 'gemini-2.5-flash',
  },
  openrouter: {
    // OpenRouter hosts the gpt-oss family directly
    'openai/gpt-oss-120b': 'openai/gpt-oss-120b',
    'openai/gpt-oss-20b': 'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b': 'google/gemini-2.5-flash', // vision-capable
    'deepseek-r1-distill-llama-70b': 'deepseek/deepseek-r1-distill-llama-70b',
    // Legacy IDs — old sessions
    'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
    'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
    'meta-llama/llama-4-scout-17b-16e-instruct': 'google/gemini-2.5-flash',
  },
}

function mapModel(provider, requestedModel) {
  return PROVIDER_MODEL_MAP[provider]?.[requestedModel] || requestedModel
}

// ── Long-budget SambaNova call for structured generation ──────────
// The shared chain caps SambaNova at 12s — right for chat replies, but
// structured JSON guides (explore/opportunities) emit ~2-3K output tokens
// and would be killed mid-flight. This exported variant gives the caller a
// dedicated timeout budget and returns null on ANY failure so the route can
// fall through to its next provider without try/catch noise.
export async function sambanovaChatLong(params, timeoutMs = 45_000) {
  if (!_sambanovaKey) return null
  try {
    return await directChat({
      provider: 'sambanova',
      baseURL: 'https://api.sambanova.ai/v1',
      apiKey: _sambanovaKey,
      params,
      timeoutMs,
    })
  } catch (_) {
    return null
  }
}

// ── Generic OpenAI-compatible chat completion via direct fetch ──
// Used by Cerebras, SambaNova, SiliconFlow, Gemini, and OpenRouter.
// All of these providers expose /chat/completions with the same request/response
// shape, so a single helper handles all of them.
async function directChat({ provider, baseURL, apiKey, params, _attempt = 1, timeoutMs, onDelta }) {
  if (!apiKey) return null

  const model = mapModel(provider, params.model || MODEL)
  const url = `${baseURL}/chat/completions`

  // reasoning_effort is a Groq-specific extension (qwen thinking control).
  // Other OpenAI-compatible endpoints may hard-reject unknown fields — strip it.
  const { reasoning_effort, ...restParams } = params || {}

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://kivora.pages.dev'
    headers['X-Title'] = 'Kivora'
  }

  // Each direct provider gets its own timeout. CF Workers kill requests at
  // ~30s, so we leave a small margin. Timeouts below are chosen based on
  // typical response time for each provider's free tier.
  // Callers that need a longer budget (structured JSON generation) can pass
  // an explicit timeoutMs override.
  const timeouts = {
    siliconflow: 15_000,  // reduced from 25s — free tier is usually <10s
    sambanova: 12_000,    // reduced from 20s — usually responds in 5-8s
    cerebras: 10_000,
    gemini: 12_000,       // Gemini 2.0 Flash is fast
    openrouter: 12_000,
  }
  // v5.13: streaming calls need the full generation window, not just TTFB
  const timeout = timeoutMs || (onDelta ? 60_000 : (timeouts[provider] || 20_000))

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...restParams, model, ...(onDelta ? { stream: true } : {}) }),
      signal: AbortSignal.timeout(timeout),
    })
  } catch (fetchErr) {
    // Network error, DNS failure, or timeout — re-throw with provider context
    const err = new Error(`${provider} fetch error: ${fetchErr.name}: ${(fetchErr.message || '').slice(0, 200)}`)
    err.provider = provider
    err.status = 0
    err.isTimeout = fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError'
    throw err
  }

  if (!response.ok) {
    const text = await response.text()

    // ── OpenRouter: dynamic max_tokens reduction ──
    // OpenRouter returns 402 when the requested max_tokens would exceed the
    // credit budget. The error message tells us the affordable amount, e.g.
    //   "This request requires more credits, or fewer max_tokens. You requested
    //    up to 4096 tokens, but can only afford 2097."
    // We parse "can only afford N" and retry with max_tokens = N (rounded down
    // to leave headroom for the response itself).
    if (
      provider === 'openrouter' &&
      response.status === 402 &&
      _attempt === 1 &&
      params.max_tokens &&
      /can only afford (\d+)/i.test(text)
    ) {
      const match = text.match(/can only afford (\d+)/i)
      const affordable = parseInt(match[1], 10)
      // Leave a small headroom — don't use the full affordable amount
      // (input tokens already count against the budget).
      const newMax = Math.max(256, Math.floor(affordable * 0.8))
      if (newMax < params.max_tokens) {
        return directChat({
          provider,
          baseURL,
          apiKey,
          params: { ...params, max_tokens: newMax },
          _attempt: 2,
        })
      }
    }

    // ── SiliconFlow: retry on 503 transient overload ──
    // SiliconFlow's free tier sometimes returns 503 with
    //   {"code":50603,"message":"System is really busy. Please try again later."}
    // This is transient (not rate-limit). Retry once after a short backoff.
    if (
      provider === 'siliconflow' &&
      response.status === 503 &&
      _attempt === 1
    ) {
      await new Promise(r => setTimeout(r, 1500))
      return directChat({
        provider,
        baseURL,
        apiKey,
        params,
        _attempt: 2,
      })
    }

    const err = new Error(`${provider} ${response.status}: ${text.slice(0, 300)}`)
    err.status = response.status
    err.provider = provider
    // Parse JSON body so the recovery function can find `failed_generation`.
    try { err.error = JSON.parse(text) } catch { /* non-JSON error body */ }
    throw err
  }

  const data = onDelta
    ? await consumeSseStream(response.body, onDelta, provider)
    : await response.json()
  data._provider = provider
  return data
}

// ── v5.13: SSE stream consumer for direct (fetch-based) providers ───
// Parses the OpenAI-compatible `data: {...}` SSE protocol, forwards content
// deltas to onDelta as they arrive, and returns a normalized non-stream
// response object so every caller keeps the same shape. If the stream dies
// AFTER partial content was emitted, the partial content is returned as a
// completed response (trim-to-sentence happens downstream) instead of
// throwing — a retry on the next provider would duplicate the partial text
// the client already rendered.
async function consumeSseStream(body, onDelta, provider) {
  let content = ''
  let finish = null
  const toolAcc = new Map()
  const accToolCall = (tc) => {
    const i = tc.index ?? 0
    if (!toolAcc.has(i)) toolAcc.set(i, { id: tc.id || `call_${i}_${Date.now()}`, type: 'function', function: { name: '', arguments: '' } })
    const acc = toolAcc.get(i)
    if (tc.id) acc.id = tc.id
    if (tc.function?.name && !acc.function.name) acc.function.name = tc.function.name
    if (tc.function?.arguments) acc.function.arguments += tc.function.arguments
  }
  const normalized = () => {
    const toolCalls = toolAcc.size > 0
      ? [...toolAcc.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
      : undefined
    return {
      choices: [{
        index: 0,
        message: { role: 'assistant', content: content || null, ...(toolCalls ? { tool_calls: toolCalls } : {}) },
        finish_reason: finish || 'stop',
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }
  }

  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let evt
        try { evt = JSON.parse(payload) } catch { continue }
        const d = evt?.choices?.[0]
        if (!d) continue
        if (d.delta?.content) {
          content += d.delta.content
          try { onDelta(d.delta.content) } catch {}
        }
        if (Array.isArray(d.delta?.tool_calls)) d.delta.tool_calls.forEach(accToolCall)
        if (d.finish_reason) finish = d.finish_reason
      }
    }
  } catch (streamErr) {
    // Mid-stream death — keep partials if we have them, else rethrow
    if (!content && toolAcc.size === 0) {
      const err = new Error(`${provider} stream failed mid-flight: ${String(streamErr?.message || streamErr).slice(0, 120)}`)
      err.status = 0
      err.provider = provider
      throw err
    }
    console.warn(`[groq] ${provider} stream died after ${content.length} chars — returning partial`)
  }
  // v5.24.2 — tail flush. The line loop above only consumes COMPLETE lines
  // (split on '\n'); whatever the provider wrote last without a trailing
  // newline — the final content delta, the finish_reason frame, the closing
  // code fence — used to sit in buf and get silently dropped on return.
  // A dropped closing fence is worse than a dropped word: downstream the
  // unbalanced-fence amputator then cut the whole last block of the reply,
  // which users saw as "cut off responses". Flush the residual line AND the
  // decoder's pending multi-byte sequence on BOTH exit paths (clean done and
  // mid-stream death).
  buf += dec.decode()
  const tailLine = buf.trim()
  if (tailLine.startsWith('data:')) {
    const payload = tailLine.slice(5).trim()
    if (payload && payload !== '[DONE]') {
      try {
        const evt = JSON.parse(payload)
        const d = evt?.choices?.[0]
        if (d?.delta?.content) {
          content += d.delta.content
          try { onDelta(d.delta.content) } catch {}
        }
        if (Array.isArray(d?.delta?.tool_calls)) d.delta.tool_calls.forEach(accToolCall)
        if (d?.finish_reason) finish = d.finish_reason
      } catch { /* partial trailing frame — nothing salvageable */ }
    }
  }
  return normalized()
}

// ── v5.13: streamed chat via the Groq SDK client ───────────────────
// Same contract as consumeSseStream but driven by the SDK's async iterator
// (the Groq client goes through the Vercel proxy, so we don't touch its
// transport). Accumulates content AND tool_calls deltas into the standard
// non-stream response shape.
async function streamSdkChat(client, sdkParams, onDelta) {
  const stream = await client.chat.completions.create({ ...sdkParams, stream: true })
  let content = ''
  let finish = null
  const toolAcc = new Map()
  const accToolCall = (tc) => {
    const i = tc.index ?? 0
    if (!toolAcc.has(i)) toolAcc.set(i, { id: tc.id || `call_${i}_${Date.now()}`, type: 'function', function: { name: '', arguments: '' } })
    const acc = toolAcc.get(i)
    if (tc.id) acc.id = tc.id
    if (tc.function?.name && !acc.function.name) acc.function.name = tc.function.name
    if (tc.function?.arguments) acc.function.arguments += tc.function.arguments
  }
  try {
    for await (const chunk of stream) {
      const d = chunk?.choices?.[0]
      if (!d) continue
      if (d.delta?.content) {
        content += d.delta.content
        try { onDelta?.(d.delta.content) } catch {}
      }
      if (Array.isArray(d.delta?.tool_calls)) d.delta.tool_calls.forEach(accToolCall)
      if (d.finish_reason) finish = d.finish_reason
    }
  } catch (streamErr) {
    if (!content && toolAcc.size === 0) throw streamErr
    console.warn(`[groq] sdk stream died after ${content.length} chars — returning partial`)
  }
  const toolCalls = toolAcc.size > 0
    ? [...toolAcc.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
    : undefined
  return {
    choices: [{
      index: 0,
      message: { role: 'assistant', content: content || null, ...(toolCalls ? { tool_calls: toolCalls } : {}) },
      finish_reason: finish || 'stop',
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    _provider: 'groq-sdk',
  }
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
    model: params?.model || MODEL,
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
 * Strip Qwen-style <think>…</think> reasoning blocks (and an unterminated
 * trailing <think>) from model output. qwen3.8-27b has a thinking mode that
 * can leak reasoning tags into content when the default isn't disabled —
 * users should never see raw <think> text in a chat bubble or a research
 * report. Safe on text without any tags (returns it unchanged).
 */
export function stripThinking(text) {
  const s = String(text || '')
  if (!s.includes('<think')) return s
  return s
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim()
}

/**
 * Multi-provider chat completion with fallback chain.
 *
 *   Text:       SiliconFlow → SambaNova → Groq primary → Groq fallback →
 *               Groq fast (gpt-oss-20b) → Gemini → OpenRouter → Cerebras
 *   Images:     Groq primary (qwen3.8-27b) → Groq fallback → Gemini →
 *               OpenRouter → Mistral (pixtral/small last resort)
 *
 * Direct providers are called from CF Pages without a proxy — they don't
 * IP-block Cloudflare Workers. Groq is routed through the Vercel proxy
 * because api.groq.com returns 403 to CF Workers IPs.
 *
 * Recovery from malformed tool calls is attempted on every provider's error,
 * since Llama-3.3-70B can emit the bug regardless of which provider serves it.
 *
 * Throws GroqError with code 'GROQ_QUOTA_EXCEEDED' when all providers fail
 * with rate limits, or 'GROQ_SERVER_ERROR' for non-retryable failures.
 */
export async function groqChat(params, opts = {}) {
  const onDelta = typeof opts?.onDelta === 'function' ? opts.onDelta : null
  const requestModel = params?.model || MODEL

  // ── Image-aware provider ordering ──
  // SiliconFlow, SambaNova and Cerebras are TEXT-ONLY — they 4xx on image
  // parts, burning seconds of dead retries per vision request. Worse, the
  // groq-fast fallback (llama-3.1-8b) is also text-only but doesn't FAIL on
  // images — it hallucinates a description. For requests carrying image_url
  // parts, run ONLY vision-capable providers, vision model first.
  const hasImageParts = (params?.messages || []).some((m) =>
    Array.isArray(m?.content) && m.content.some((p) => p?.type === 'image_url')
  )

  // Provider chain — order matters. First available + successful wins.
  //
  // NOTE: Cerebras is intentionally LAST among direct providers, not first.
  // Cloudflare's WAF (protecting api.cerebras.ai) blocks Cloudflare Workers
  // IPs (kivora.pages.dev runs on CF Workers), returning a 403 challenge
  // page. So Cerebras effectively never works from this deployment.
  // We keep it in the chain in case the WAF behavior changes, but it's last.
  //
  // Order rationale (as of 2026-10-21):
  //   1. SiliconFlow  — most reliable in production testing, generous free tier
  //   2. SambaNova    — works but 10 RPM limit (free tier)
  //   3. Groq primary — Vercel proxy, gpt-oss-120b (legacy IDs auto-mapped)
  //   4. Groq fallback — second key, same Vercel proxy
  //   5. Groq fast    — gpt-oss-20b, separate quota bucket
  //   6. Gemini       — daily quota
  //   7. OpenRouter   — credit-based (low balance; fails at high max_tokens)
  //   8. Cerebras     — last (WAF blocks CF Workers IPs)
  const providers = hasImageParts ? [
    // Vision order: qwen3.8-27b on Groq (primary key) → Groq fallback key →
    // Gemini → OpenRouter → Mistral (pixtral/small, last resort). qwen3.8 is
    // Groq's current multimodal model (Llama 4 scout was shut down 07/17/26);
    // it handles image_url parts + tool use. Gemini/OpenRouter only serve if
    // their keys exist (they're optional in this deployment); Mistral is the
    // never-give-up last hop so an image request can't die with a 503.
    {
      name: 'groq-primary',
      available: () => !!getPrimaryClient() || !!_groqPrimary,
      call: async () => {
        const client = getPrimaryClient() || _groqPrimary
        if (!client) throw new Error('groq-primary not initialized')
        if (onDelta) return await streamSdkChat(client, { ...params, model: mapGroqModel(requestModel) }, onDelta)
        return await client.chat.completions.create({
          ...params,
          model: mapGroqModel(requestModel),
        })
      },
    },
    {
      name: 'groq-fallback',
      available: () => !!getFallbackClient() || !!_groqFallback,
      call: async () => {
        const client = getFallbackClient() || _groqFallback
        if (!client) throw new Error('groq-fallback not initialized')
        if (onDelta) return await streamSdkChat(client, { ...params, model: mapGroqModel(requestModel) }, onDelta)
        return await client.chat.completions.create({
          ...params,
          model: mapGroqModel(requestModel),
        })
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
        onDelta,
        timeoutMs: onDelta ? undefined : 25_000, // vision + tools routinely exceeds the 12s text budget
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
        onDelta,
        timeoutMs: onDelta ? undefined : 25_000,
      }),
    },
    {
      // Last resort — Mistral's small/medium tiers accept image_url parts.
      // Weaker at person identification than qwen3.8, but far better than a 503.
      name: 'mistral-vision',
      available: () => isMistralConfigured(),
      call: async () => {
        const m = await mistralChat({
          messages: params.messages,
          temperature: params.temperature,
          maxTokens: params.max_tokens,
          tools: params.tools,
          toolChoice: params.tool_choice,
        })
        if (!m?.choices?.[0]?.message) throw new Error('mistral-vision empty response')
        return m
      },
    },
  ] : [
    {
      name: 'siliconflow',
      available: () => !!_siliconflowKey,
      call: () => directChat({
        provider: 'siliconflow',
        baseURL: 'https://api.siliconflow.com/v1',
        apiKey: _siliconflowKey,
        params,
        onDelta,
      }),
    },
    {
      name: 'sambanova',
      available: () => !!_sambanovaKey,
      call: () => directChat({
        provider: 'sambanova',
        baseURL: 'https://api.sambanova.ai/v1',
        apiKey: _sambanovaKey,
        params,
        onDelta,
      }),
    },
    {
      name: 'groq-primary',
      available: () => !!getPrimaryClient() || !!_groqPrimary,
      call: async () => {
        const client = getPrimaryClient() || _groqPrimary
        if (!client) throw new Error('groq-primary not initialized')
        if (onDelta) return await streamSdkChat(client, { ...params, model: mapGroqModel(requestModel) }, onDelta)
        return await client.chat.completions.create({
          ...params,
          model: mapGroqModel(requestModel),
        })
      },
    },
    {
      name: 'groq-fallback',
      available: () => !!getFallbackClient() || !!_groqFallback,
      call: async () => {
        const client = getFallbackClient() || _groqFallback
        if (!client) throw new Error('groq-fallback not initialized')
        if (onDelta) return await streamSdkChat(client, { ...params, model: mapGroqModel(requestModel) }, onDelta)
        return await client.chat.completions.create({
          ...params,
          model: mapGroqModel(requestModel),
        })
      },
    },
    {
      // ── Groq fast model fallback (separate TPD bucket) ──
      // Groq's free tier gives each model its own TPD quota:
      //   - llama-3.3-70b-versatile: 100K TPD, 12K TPM (128K context)
      //   - llama-3.1-8b-instant:    500K TPD,  6K TPM (128K context)
      // The 8B model has 5x the daily TPD budget, so it works long after the
      // 70B's daily quota is exhausted.
      //
      // IMPORTANT: 8B has a strict 6K TPM limit. With the trimmed system prompt
      // (~700 chars) + filtered tools (1-8 tools, ~200-1500 tokens) + user
      // message + 12-message history, total input is usually under 3K tokens —
      // fits within 6K TPM. As a safety check, skip only when input is clearly
      // too large (>5 tools AND long message).
      name: 'groq-fast',
      available: () => {
        if (!getPrimaryClient() && !_groqPrimary) return false
        // Skip only when tools array is very large (would exceed 6K TPM)
        if (params.tools && params.tools.length > 8) return false
        return true
      },
      call: async () => {
        const client = getPrimaryClient() || _groqPrimary
        if (!client) throw new Error('groq-fast not initialized')
        const fastParams = { ...params, model: mapGroqModel('llama-3.1-8b-instant') } // → openai/gpt-oss-20b
        if (onDelta) return await streamSdkChat(client, fastParams, onDelta)
        return await client.chat.completions.create(fastParams)
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
        onDelta,
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
        onDelta,
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
        onDelta,
      }),
    },
  ]

  // ── v5.13: self-tuning provider order ──
  // The static order (SiliconFlow first) was tuned for reliability, not
  // speed — every request pays the same hops even when a faster provider
  // (Groq: ~2x the tok/s) has been serving fine for hours. Track the last
  // provider that succeeded and try it FIRST on the next request; failed
  // providers get a soft demotion to the back of the queue for 90s (they're
  // still tried as a last resort — availability is never removed).
  if (!_chainLastWinner) _chainLastWinner = { name: null }
  if (!_chainFailUntil) _chainFailUntil = {}
  const nowTs = Date.now()
  for (const k of Object.keys(_chainFailUntil)) {
    if (_chainFailUntil[k] < nowTs) delete _chainFailUntil[k]
  }
  let ordered = providers
  if (_chainLastWinner.name) {
    const wi = providers.findIndex(p => p.name === _chainLastWinner.name)
    if (wi > 0) {
      ordered = [...providers]
      ordered.unshift(...ordered.splice(wi, 1))
    }
  }
  const healthy = ordered.filter(p => !_chainFailUntil[p.name])
  const demoted = ordered.filter(p => _chainFailUntil[p.name])
  const chain = healthy.concat(demoted)

  let lastErr = null
  let lastRateLimitErr = null
  let anyProviderAvailable = false
  // Track every provider's outcome for debugging
  const providerOutcomes = []

  // In-process rate-limit cache: when a provider returns 429 / rate-limit,
  // remember the timestamp so subsequent calls within the cooldown window
  // skip it immediately. This prevents burning requests on a provider we
  // just saw rate-limited (e.g. SambaNova's 10 RPM free tier).
  // Cache lives on the module (not the function call) so it persists across
  // requests within the same edge worker lifetime.
  if (!_providerRateLimitedUntil) _providerRateLimitedUntil = {}
  const now = Date.now()
  // Clean expired entries
  for (const k of Object.keys(_providerRateLimitedUntil)) {
    if (_providerRateLimitedUntil[k] < now) delete _providerRateLimitedUntil[k]
  }

  for (const p of chain) {
    if (!p.available()) {
      providerOutcomes.push({ name: p.name, status: 'skipped (no key)' })
      continue
    }
    // Skip providers we recently saw rate-limited (within the cooldown window)
    const cooldownUntil = _providerRateLimitedUntil[p.name]
    if (cooldownUntil && cooldownUntil > now) {
      providerOutcomes.push({
        name: p.name,
        status: 'skipped (rate-limited cooldown)',
        cooldown_ms_remaining: cooldownUntil - now,
      })
      continue
    }
    anyProviderAvailable = true

    try {
      const result = await p.call()
      if (result?._provider && result._provider !== 'groq-sdk') {
        console.warn(`[groq] served by ${result._provider}`)
      }
      providerOutcomes.push({ name: p.name, status: 'ok', provider: result?._provider })
      // Clear any stale cooldown on success + record the chain winner
      delete _providerRateLimitedUntil[p.name]
      delete _chainFailUntil[p.name]
      _chainLastWinner.name = p.name
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
        // Per-provider cooldown windows tuned to each provider's free-tier
        // rate-limit cadence:
        //   - sambanova: 10 RPM free tier → 1 req per 6s, so 8s cooldown lets
        //     the next legitimate request through almost immediately
        //   - gemini:    daily quota → cooldown won't help much, but set 60s
        //     so we don't burn requests on a quota that won't reset today
        //   - groq:      TPD-based, 60s cooldown (TPD doesn't reset in seconds)
        //   - default:   30s
        const cooldownMs = {
          sambanova: 8_000,
          gemini: 60_000,
          'groq-primary': 60_000,
          'groq-fallback': 60_000,
          'groq-fast': 60_000,
        }
        _providerRateLimitedUntil[p.name] = Date.now() + (cooldownMs[p.name] || 30_000)
      }
      // v5.13: soft demotion for ANY failure (not just rate limits) — a dead
      // provider shouldn't sit at the front of the queue burning ~1-2s per
      // request until its next success. 90s window, then it earns its way
      // back by winning a request.
      _chainFailUntil[p.name] = Date.now() + 90_000
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
