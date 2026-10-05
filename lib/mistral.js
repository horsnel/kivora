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
  const head = MODEL_LADDER.includes(model) ? [model] : []
  const ladder = [...head, ...MODEL_LADDER.filter((m) => !head.includes(m))]

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
