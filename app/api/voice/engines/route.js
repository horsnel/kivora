export const runtime = 'edge'

import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit } from '@/lib/ratelimit'

// ── Voice Server Fetch Helper ──
async function voiceFetch(path, options = {}) {
  const baseUrl = await getEnvVar('VOICE_SERVER_URL') || 'http://localhost:3900'
  const apiKey = await getEnvVar('VOICE_API_KEY')
  const headers = { ...options.headers }
  if (apiKey) headers['X-API-Key'] = apiKey
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers })
  return res
}

// ── In-memory cache for engine listings (5-minute TTL) ──
let enginesCache = null
let enginesCacheExpiry = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ── GET /api/voice/engines ──
export async function GET(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 20).ok) {
    return Response.json({ error: "You're sending requests too quickly." }, { status: 429 })
  }

  try {
    // Return cached result if still fresh
    const now = Date.now()
    if (enginesCache && now < enginesCacheExpiry) {
      return Response.json(enginesCache)
    }

    // ── Fetch all engine types from OmniVoice ──
    const fetchWithTimeout = async (path) => {
      try {
        const res = await voiceFetch(path, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) return []
        return await res.json()
      } catch {
        return []
      }
    }

    const [tts, asr, translation] = await Promise.all([
      fetchWithTimeout('/engines/tts'),
      fetchWithTimeout('/engines/asr'),
      fetchWithTimeout('/engines/translation'),
    ])

    const result = {
      tts: Array.isArray(tts) ? tts : [],
      asr: Array.isArray(asr) ? asr : [],
      translation: Array.isArray(translation) ? translation : [],
      fetched_at: new Date().toISOString(),
    }

    // Update cache
    enginesCache = result
    enginesCacheExpiry = now + CACHE_TTL_MS

    return Response.json(result)
  } catch (err) {
    console.error('[voice/engines]', err)
    return Response.json({ error: err.message || 'Failed to list voice engines.' }, { status: 500 })
  }
}
