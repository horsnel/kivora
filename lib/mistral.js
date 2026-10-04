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

// Ordered from highest to lowest capability. Free tier keys cannot use
// mistral-large-latest; the ladder auto-degrades until one is allowed.
const MODEL_LADDER = [
  'mistral-large-latest',
  'mistral-medium-latest',
  'mistral-small-latest',
]

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

function isUsingFallbackKey() {
  return !_primaryKey && !!_fallbackKey
}

// ── Single HTTP call to Mistral ──────────────────────────────────
async function callMistral({ model, messages, temperature, maxTokens, apiKey }) {
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

// ── Public API — walks the model ladder with retries ─────────────
export async function mistralChat({ model, messages, temperature, maxTokens }) {
  const apiKey = availableKey()
  if (!apiKey) {
    throw new MistralError(
      'Mistral not configured (missing MISTRAL_API_KEY)',
      'MISTRAL_NOT_CONFIGURED',
      503
    )
  }

  const startModel = MODEL_LADDER.includes(model) ? model : MISTRAL_DEFAULT_MODEL
  const ladder = MODEL_LADDER.slice(MODEL_LADDER.indexOf(startModel))

  let lastErr = null

  for (const candidate of ladder) {
    // Skip models this account tier can't use (cached across requests)
    if (_deniedModels.has(candidate)) continue

    // Skip models currently in rate-limit cooldown
    const cooldown = _cooldownUntil.get(candidate) || 0
    if (Date.now() < cooldown) continue

    // Up to 3 attempts per model — retries only on 429s
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await callMistral({ model: candidate, messages, temperature, maxTokens, apiKey })
      } catch (err) {
        lastErr = err

        // Tier rejection — cache it and move down the ladder immediately
        if (err.tierBlocked) {
          _deniedModels.add(candidate)
          console.warn(
            `[mistral] model ${candidate} not allowed for this account tier${isUsingFallbackKey() ? ' (fallback key)' : ''} — degrading`
          )
          break
        }

        // Rate limited — back off and retry the same model
        if (err.rateLimited && attempt < 2) {
          const backoffMs = 1500 * (attempt + 1)
          _cooldownUntil.set(candidate, Date.now() + backoffMs)
          console.warn(`[mistral] 429 on ${candidate} (attempt ${attempt + 1}/3) — retrying in ${backoffMs}ms`)
          await new Promise((r) => setTimeout(r, backoffMs))
          continue
        }

        // Non-retryable failure — surface immediately
        throw err
      }
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
