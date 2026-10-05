// ── Mistral AI provider for Kivora ───────────────────────────────
// Primary AI provider for Study Desk, DevTools, and ReelPen.
// Falls back gracefully from the legacy multi-provider chain (lib/groq.js).
//
// Features:
//   • Primary + fallback key support (MISTRAL_API_KEY / MISTRAL_API_KEY_FALLBACK)
//   • Model-tier ladder: large → medium → small. Accounts on the free tier
//     are rejected for mistral-large-latest (code 1910 "tier_not_allowed"),
//     so the ladder walks down automatically.
//   • Denied-model cache — once a model is rejected for tier reasons, retries
//     skip it for the lifetime of this edge isolate.
//   • 429 retry with exponential backoff (2 attempts per model).
//
// Env vars (read via getEnvVar in route.js, passed through setMistralApiKeys):
//   MISTRAL_API_KEY            — primary key
//   MISTRAL_API_KEY_FALLBACK   — shared fallback key (rate-limit prone)

const MISTRAL_API_BASE = 'https://api.mistral.ai/v1'

// Speed-first ladder. On the free (Experiment) tier the flagship tiers are
// capacity-saturated (429) most hours, while the light models answer in well
// under a second — so the light models go FIRST and a cold isolate stops
// burning seconds on 429 retries it can't win. A caller-requested model is
// still tried before the rest of the ladder (see mistralChat).
const MODEL_LADDER = [
  'open-mistral-nemo',      // 12B — best free-tier chat quality, usually available
  'ministral-8b-latest',    // fastest useful tier, verified live
  'ministral-3b-latest',    // last-resort light tier
  'mistral-small-latest',
  'mistral-medium-latest',
  'mistral-large-latest',   // 403 on free tier (code 1910) — auto-cached & skipped
]

// Hard ceiling on ladder-walking (429/403 hops). If no model accepts within
// this budget the caller falls back to the legacy provider chain instead of
// stacking seconds of dead retries — keeps end-to-end latency low.
const LADDER_TIME_BUDGET_MS = 3000

// Once a model 429s, skip it for this long (subsequent requests start on a
// model with headroom instantly instead of paying the rejection round-trip)
const SATURATION_COOLDOWN_MS = 45_000

export const MISTRAL_DEFAULT_MODEL = MODEL_LADDER[0]

// Vision-capable ladder — used when the message array carries image parts.
// The text ladder above must NOT see image content: text-only models reject
// it with a 422, which the ladder walk treats as a non-walkable 4xx (break),
// so a single image used to kill the whole Mistral attempt. Every model here
// accepts image_url content parts. Order = availability-first; a model that
// turns out to be tier-blocked gets cached in _deniedModels like text ones.
const VISION_MODEL_LADDER = [
  'mistral-small-latest',   // Small 3.x — vision-capable, best availability
  'mistral-medium-latest',  // vision-capable, more 429-prone
  'pixtral-12b-2409',       // dedicated vision model — last: if its id were
                            // ever invalid, its 400 breaks the ladder walk
]

/** True when any message carries multimodal image parts (OpenAI-style). */
function messagesHaveImage(messages) {
  if (!Array.isArray(messages)) return false
  return messages.some((m) =>
    Array.isArray(m?.content) &&
    m.content.some((part) => part?.type === 'image_url')
  )
}

/** Ladder for a request: vision ladder when images are present, else text. */
function ladderFor(model, messages) {
  const base = messagesHaveImage(messages) ? VISION_MODEL_LADDER : MODEL_LADDER
  const head = base.includes(model) ? [model] : []
  return [...head, ...base.filter((m) => !head.includes(m))]
}

// ── Provider key state (set by route.js after CF secret lookup) ──
let _primaryKey = null
let _fallbackKey = null

// Models rejected by the account tier (cached per edge isolate lifetime)
const _deniedModels = new Set()

// Per-model rate-limit cooldowns: model → epoch ms when cooldown expires
const _cooldownUntil = new Map()

export class MistralError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'MistralError'
    this.code = code
    this.status = status
  }
}

/** Called by routes after reading CF Workers secrets via getEnvVar(). */
export function setMistralApiKeys(primary, fallback) {
  if (primary !== undefined) _primaryKey = primary || null
  if (fallback !== undefined) _fallbackKey = fallback || null
}

function availableKey() {
  return _primaryKey || _fallbackKey || null
}

// ── Single HTTP call to Mistral ──────────────────────────────────
async function callMistral({ model, messages, temperature, maxTokens, tools, toolChoice, apiKey }) {
  const res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
      ...(tools && tools.length > 0 ? { tools, tool_choice: toolChoice ?? 'auto' } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    let errMsg = `Mistral error ${res.status}`
    let code = ''
    try {
      const data = await res.json()
      errMsg = data?.message || data?.error?.message || errMsg
      code = data?.code ?? data?.error?.code ?? ''
    } catch {
      // Response was not JSON — keep the generic message
    }

    const err = new MistralError(errMsg, String(code), res.status)
    const codeStr = String(code)
    const tierBlocked =
      res.status === 403 ||
      codeStr === '1910' ||
      errMsg.toLowerCase().includes('tier_not_allowed') ||
      errMsg.toLowerCase().includes('not allowed for your tier') ||
      errMsg.toLowerCase().includes('model capability')
    if (tierBlocked) err.tierBlocked = true
    if (res.status === 429 || errMsg.toLowerCase().includes('rate limit')) err.rateLimited = true
    throw err
  }

  return res.json()
}

// ── Public API — walks the model ladder, fast-fail ───────────────
// No per-model retry loops: a 429 costs one round-trip (~200-400ms), so
// walking to the next model beats waiting. Saturated models get a 45s
// cooldown so later requests skip them instantly. Whole walk is capped by
// LADDER_TIME_BUDGET_MS so the route's fallback chain stays viable.
export async function mistralChat({ model, messages, temperature, maxTokens, tools, toolChoice }) {
  const keys = [_primaryKey, _fallbackKey].filter(Boolean)
  if (keys.length === 0) {
    throw new MistralError(
      'Mistral not configured (missing MISTRAL_API_KEY)',
      'MISTRAL_NOT_CONFIGURED',
      503
    )
  }

  // Requested model first (when valid), then the rest of the ladder —
  // guarantees graceful degradation even for explicit model requests.
  const ladder = ladderFor(model, messages)

  const deadline = Date.now() + LADDER_TIME_BUDGET_MS
  let lastErr = null
  let keyIdx = 0

  for (const candidate of ladder) {
    // Skip models this account tier can't use (cached across requests)
    if (_deniedModels.has(candidate)) continue

    // Skip models currently in rate-limit cooldown
    if (Date.now() < (_cooldownUntil.get(candidate) || 0)) continue

    try {
      // Rotate keys when both are configured — halves the chance both are
      // rate-limited at the same instant.
      return await callMistral({
        model: candidate,
        messages,
        temperature,
        maxTokens,
        tools,
        toolChoice,
        apiKey: keys[keyIdx++ % keys.length],
      })
    } catch (err) {
      lastErr = err

      // Tier rejection — cache it and move down the ladder immediately
      if (err.tierBlocked) {
        _deniedModels.add(candidate)
        console.warn(`[mistral] model ${candidate} not allowed for this account tier — degrading`)
        continue
      }

      // Capacity saturated — cooldown cache + next model, no retry loop
      if (err.rateLimited) {
        _cooldownUntil.set(candidate, Date.now() + SATURATION_COOLDOWN_MS)
        console.warn(`[mistral] ${candidate} saturated (429) — skipping for ${SATURATION_COOLDOWN_MS / 1000}s`)
        continue
      }

      // Server errors / network blips — try the next model
      if (err.status >= 500 || err.status === undefined) continue

      // Other 4xx (bad request etc.) — same params would fail everywhere
      break
    }

    if (Date.now() > deadline) {
      console.warn('[mistral] ladder time budget exhausted — handing off to fallback')
      break
    }
  }

  throw (
    lastErr ||
    new MistralError('Mistral request failed — no model available', 'MISTRAL_FAILED', 502)
  )
}

/** True when at least one Mistral key is configured. */
export function isMistralConfigured() {
  return !!(availableKey())
}

// ── Streaming ────────────────────────────────────────────────────
// Streams tokens from a single Mistral call. Pre-stream failures (429/403/
// 5xx) throw BEFORE any delta is emitted, so the ladder walk can safely retry
// the next model. Mid-stream network failures propagate to the caller — at
// that point deltas may already have reached the client and cannot be
// replayed by another model.

async function callMistralStream({ model, messages, temperature, maxTokens, tools, toolChoice, apiKey, onDelta }) {
  const res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
      stream: true,
      ...(tools && tools.length > 0 ? { tools, tool_choice: toolChoice ?? 'auto' } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    // Same error mapping as callMistral — thrown before any delta is emitted
    let errMsg = `Mistral error ${res.status}`
    let code = ''
    try {
      const data = await res.json()
      errMsg = data?.message || data?.error?.message || errMsg
      code = data?.code ?? data?.error?.code ?? ''
    } catch {
      // Response was not JSON — keep the generic message
    }

    const err = new MistralError(errMsg, String(code), res.status)
    const codeStr = String(code)
    const tierBlocked =
      res.status === 403 ||
      codeStr === '1910' ||
      errMsg.toLowerCase().includes('tier_not_allowed') ||
      errMsg.toLowerCase().includes('not allowed for your tier') ||
      errMsg.toLowerCase().includes('model capability')
    if (tierBlocked) err.tierBlocked = true
    if (res.status === 429 || errMsg.toLowerCase().includes('rate limit')) err.rateLimited = true
    throw err
  }

  if (!res.body) {
    throw new MistralError('Mistral stream returned no body', 'MISTRAL_STREAM_FAILED', 502)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let content = ''
  const toolCalls = [] // assembled by index: { id, type:'function', function:{name, arguments} }

  const handleEvent = (payload) => {
    const delta = payload?.choices?.[0]?.delta
    if (!delta) return
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      content += delta.content
      try { onDelta?.(delta.content) } catch {}
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0
        if (!toolCalls[idx]) {
          toolCalls[idx] = { id: tc.id || `call_${idx}`, type: 'function', function: { name: '', arguments: '' } }
        }
        if (tc.id) toolCalls[idx].id = tc.id
        if (tc.function?.name) toolCalls[idx].function.name += tc.function.name
        if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      try { handleEvent(JSON.parse(data)) } catch {}
    }
  }

  const message = { role: 'assistant', content }
  if (toolCalls.length > 0) message.tool_calls = toolCalls
  // OpenAI-compatible shape so callers can treat streamed and non-streamed
  // responses identically (choices[0].message).
  return { choices: [{ message }], _streamed: true }
}

// Ladder walk for streaming — mirrors mistralChat's fast-fail semantics.
// Because pre-stream failures emit nothing, walking models is invisible to
// the client; the first successful stream is simply piped through onDelta.
export async function mistralChatStream({ model, messages, temperature, maxTokens, tools, toolChoice, onDelta }) {
  const keys = [_primaryKey, _fallbackKey].filter(Boolean)
  if (keys.length === 0) {
    throw new MistralError(
      'Mistral not configured (missing MISTRAL_API_KEY)',
      'MISTRAL_NOT_CONFIGURED',
      503
    )
  }

  const ladder = ladderFor(model, messages)

  const deadline = Date.now() + LADDER_TIME_BUDGET_MS
  let lastErr = null
  let keyIdx = 0

  for (const candidate of ladder) {
    if (_deniedModels.has(candidate)) continue
    if (Date.now() < (_cooldownUntil.get(candidate) || 0)) continue

    try {
      return await callMistralStream({
        model: candidate,
        messages,
        temperature,
        maxTokens,
        tools,
        toolChoice,
        onDelta,
        apiKey: keys[keyIdx++ % keys.length],
      })
    } catch (err) {
      lastErr = err
      if (err.tierBlocked) {
        _deniedModels.add(candidate)
        console.warn(`[mistral] model ${candidate} not allowed for this account tier — degrading (stream)`)
        continue
      }
      if (err.rateLimited) {
        _cooldownUntil.set(candidate, Date.now() + SATURATION_COOLDOWN_MS)
        console.warn(`[mistral] ${candidate} saturated (429) — skipping for ${SATURATION_COOLDOWN_MS / 1000}s (stream)`)
        continue
      }
      if (err.status >= 500 || err.status === undefined) continue
      break
    }
  }

  throw (
    lastErr ||
    new MistralError('Mistral stream failed — no model available', 'MISTRAL_FAILED', 502)
  )
}
