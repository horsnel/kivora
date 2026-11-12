// lib/vision-ovh.js
// OVHcloud AI Endpoints — anonymous free tier (no API key, no signup).
// v5.30.22: pre-analysis step for /api/research image attachments — the
// description is prepended to the worker query, so the research pipeline
// gets a text seed even when the worker's own vision pass is weak.
//
//   Endpoint: https://oai.endpoints.kepler.ai.cloud.ovh.net/v1 (OpenAI shape)
//   Model:    Qwen2.5-VL-72B-Instruct
//   Limits:   ~2 RPM per IP per model on the anonymous tier — treat every
//             call as one-shot, never retry, and FAIL OPEN (null) so the
//             route continues with the user's text alone.
//   Verified live 2026-11-12: 200 OK without auth, image seen correctly.
//
// NOTE (user decision): no Groq fallback here — Cloudflare egress IPs are
// blocked by Groq; the fallback path for vision stays the route's existing
// provider chain, not a direct Groq call.

// Overridable for tests (mock gateway); prod uses the public anonymous tier.
const OVH_BASE = process.env.OVH_VISION_BASE || 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1'
const VISION_MODEL = 'Qwen2.5-VL-72B-Instruct'

// Research-oriented extraction prompt — the goal is a text seed the research
// pipeline can turn into search queries, not a caption.
const DEFAULT_PROMPT =
  'Extract every fact useful for online research from this image: people ' +
  '(names, roles, uniforms, notable features), visible text (verbatim OCR), ' +
  'brands, logos, landmarks, locations, dates, numbers, documents, and any ' +
  'context that identifies when/where this was taken. Be specific and factual.'

/**
 * Describe an image using OVHcloud's anonymous vision tier.
 * @param {string} imageDataUrl - full data URL: "data:image/jpeg;base64,..."
 * @param {string} prompt - what to ask about the image
 * @param {{maxTokens?: number}} opts - optional overrides (the research
 *   route asks for the 5-section brief and needs more room: 900)
 * @returns {Promise<string|null>} description text, or null on ANY failure
 */
export async function describeImageOvh(imageDataUrl, prompt = DEFAULT_PROMPT, opts = {}) {
  // Full data URL with a real base64 payload — a truncated "data:image/"
  // prefix alone must not reach the network.
  if (!imageDataUrl || !/^data:image\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=]+/i.test(imageDataUrl)) return null

  try {
    const res = await fetch(`${OVH_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header — anonymous tier (verified live)
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: opts.maxTokens || 600,
        temperature: 0.2,
      }),
      // Anonymous tier can be slow on first call — 30s ceiling, one shot
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      console.warn('[vision-ovh] non-200:', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return null
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch (err) {
    console.warn('[vision-ovh] failed:', String(err?.message || err).slice(0, 200))
    return null
  }
}

/**
 * Compact the description into a clean research seed (≤500 chars, single
 * line) so it composes cleanly with the user's query.
 */
export function extractVisionFacts(description) {
  if (!description) return ''
  return description.replace(/\s+/g, ' ').trim().slice(0, 500)
}

/**
 * Route-level helper: build the enriched research query for image-bearing
 * requests. Describes at most ONE image — the anonymous tier is ~2 RPM per
 * IP, so a multi-image loop would exhaust the budget for every following
 * user on the same egress IP. The rest keep the worker's own vision pass.
 * @param {Array<{name?:string, type?:string, content?:string}>} files
 * @param {string} userText - the user's original research query
 * @returns {Promise<string>} query (enriched when OVH answered, else unchanged)
 */
export async function enrichResearchQueryWithVision(files, userText) {
  const image = (Array.isArray(files) ? files : []).find(
    (f) => typeof f?.content === 'string' && f.content.startsWith('data:image/')
  )
  if (!image) return userText

  const description = await describeImageOvh(image.content)
  if (!description) return userText // fail open — text-only pipeline

  const facts = extractVisionFacts(description)
  if (!facts) return userText
  return `${userText}\n\n[Image analysis] ${facts}`
}
