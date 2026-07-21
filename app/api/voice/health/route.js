export const runtime = 'edge' 

import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit, getClientIP } from '@/lib/ratelimit'

// ── Voice Server Fetch Helper ──
async function voiceFetch(path, options = {}) {
  const baseUrl = await getEnvVar('VOICE_SERVER_URL') || 'http://localhost:3900'
  const apiKey = await getEnvVar('VOICE_API_KEY')
  const headers = { ...options.headers }
  if (apiKey) headers['X-API-Key'] = apiKey
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers })
  return res
}

// ── GET /api/voice/health ──
export async function GET(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip, 30).ok) {
    return Response.json({ error: "You're sending requests too quickly." }, { status: 429 })
  }

  const baseUrl = await getEnvVar('VOICE_SERVER_URL') || 'http://localhost:3900'

  try {
    // Try a quick health check with a short timeout
    const healthRes = await voiceFetch('/health', {
      signal: AbortSignal.timeout(5000),
    })

    if (!healthRes.ok) {
      return Response.json({
        available: false,
        url: baseUrl,
        error: `Voice server returned status ${healthRes.status}`,
        engines: { tts: 0, asr: 0, translation: 0 },
        gpu: { available: false, vram: null },
      })
    }

    const health = await healthRes.json()

    // Try to get engine counts in parallel (non-blocking — failures default to 0)
    const fetchCount = async (path) => {
      try {
        const res = await voiceFetch(path, { signal: AbortSignal.timeout(4000) })
        if (!res.ok) return 0
        const data = await res.json()
        return Array.isArray(data) ? data.length : 0
      } catch {
        return 0
      }
    }

    const [ttsCount, asrCount, translationCount] = await Promise.all([
      fetchCount('/engines/tts'),
      fetchCount('/engines/asr'),
      fetchCount('/engines/translation'),
    ])

    return Response.json({
      available: true,
      url: baseUrl,
      engines: {
        tts: ttsCount,
        asr: asrCount,
        translation: translationCount,
      },
      gpu: {
        available: health.gpu?.available ?? health.gpu ?? false,
        vram: health.gpu?.vram ?? health.vram ?? null,
      },
      version: health.version || null,
      uptime: health.uptime || null,
    })
  } catch (err) {
    // Voice server unreachable — return a graceful "not available" response
    console.warn('[voice/health] Voice server unreachable:', err.message)
    return Response.json({
      available: false,
      url: baseUrl,
      error: 'Voice server is not reachable.',
      detail: err.message || 'Connection refused',
      engines: { tts: 0, asr: 0, translation: 0 },
      gpu: { available: false, vram: null },
    })
  }
}
