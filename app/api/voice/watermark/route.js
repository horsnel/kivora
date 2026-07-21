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

// ── POST /api/voice/watermark — Detect AudioSeal watermarks ──
export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip, 8).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    // ── Parse multipart/form-data ──
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return Response.json({ error: 'Request must be multipart/form-data with an audio file.' }, { status: 400 })
    }

    const formData = await req.formData()
    const audioFile = formData.get('file')

    // ── Validate required audio file ──
    if (!audioFile || typeof audioFile === 'string') {
      return Response.json({ error: 'Audio file is required. Use the "file" field.' }, { status: 400 })
    }

    // Validate file size (max 25 MB)
    const MAX_SIZE = 25 * 1024 * 1024
    if (audioFile.size > MAX_SIZE) {
      return Response.json({ error: `Audio file too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB.` }, { status: 400 })
    }

    // ── Proxy to OmniVoice backend ──
    try {
      const proxyForm = new FormData()
      proxyForm.append('file', audioFile, audioFile.name || 'audio.wav')

      const voiceRes = await voiceFetch('/watermark/detect', {
        method: 'POST',
        body: proxyForm,
      })

      if (!voiceRes.ok) {
        const errText = await voiceRes.text().catch(() => '')
        let errMsg = `Voice server error (${voiceRes.status})`
        try { errMsg = JSON.parse(errText).error?.message || errMsg } catch {}
        throw new Error(errMsg)
      }

      const result = await voiceRes.json()

      return Response.json({
        detected: result.detected ?? result.watermark_detected ?? false,
        score: result.score ?? result.confidence ?? null,
        message: result.message || (result.detected ? 'Watermark detected in audio.' : 'No watermark detected.'),
      })
    } catch (voiceErr) {
      console.warn('[voice/watermark] Voice server unavailable:', voiceErr.message)
      return Response.json({
        error: 'Voice server is currently unavailable for watermark detection.',
        detail: voiceErr.message,
      }, { status: 503 })
    }
  } catch (err) {
    console.error('[voice/watermark]', err)
    return Response.json({ error: err.message || 'Watermark detection failed.' }, { status: 500 })
  }
}

// ── GET /api/voice/watermark — Get current watermark settings ──
export async function GET(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip, 20).ok) {
    return Response.json({ error: "You're sending requests too quickly." }, { status: 429 })
  }

  try {
    const voiceRes = await voiceFetch('/watermark/status')

    if (!voiceRes.ok) {
      const errText = await voiceRes.text().catch(() => '')
      let errMsg = `Voice server error (${voiceRes.status})`
      try { errMsg = JSON.parse(errText).error?.message || errMsg } catch {}
      throw new Error(errMsg)
    }

    const result = await voiceRes.json()

    return Response.json({
      enabled: result.enabled ?? true,
      method: result.method || 'audioseal',
      strength: result.strength ?? null,
      message: result.message || 'Watermark status retrieved.',
    })
  } catch (voiceErr) {
    console.warn('[voice/watermark] Voice server unavailable:', voiceErr.message)
    return Response.json({
      error: 'Voice server is currently unavailable.',
      detail: voiceErr.message,
    }, { status: 503 })
  }
}
