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

// ── POST /api/voice/isolate ──
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 4).ok) {
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

    // Validate file size (max 50 MB for vocal isolation)
    const MAX_SIZE = 50 * 1024 * 1024
    if (audioFile.size > MAX_SIZE) {
      return Response.json({ error: `Audio file too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB.` }, { status: 400 })
    }

    // ── Proxy to OmniVoice backend ──
    try {
      const proxyForm = new FormData()
      proxyForm.append('file', audioFile, audioFile.name || 'audio.wav')

      const voiceRes = await voiceFetch('/tools/isolate-vocals', {
        method: 'POST',
        body: proxyForm,
      })

      if (!voiceRes.ok) {
        const errText = await voiceRes.text().catch(() => '')
        let errMsg = `Voice server error (${voiceRes.status})`
        try { errMsg = JSON.parse(errText).error?.message || errMsg } catch {}
        throw new Error(errMsg)
      }

      // Stream the isolated vocals audio back
      const resContentType = voiceRes.headers.get('content-type') || 'audio/wav'
      const audioBody = voiceRes.body

      return new Response(audioBody, {
        status: 200,
        headers: {
          'Content-Type': resContentType,
          'Cache-Control': 'no-store',
          'X-Process': 'vocal-isolation',
        },
      })
    } catch (voiceErr) {
      console.warn('[voice/isolate] Voice server unavailable:', voiceErr.message)
      return Response.json({
        error: 'Voice server is currently unavailable for vocal isolation.',
        detail: voiceErr.message,
      }, { status: 503 })
    }
  } catch (err) {
    console.error('[voice/isolate]', err)
    return Response.json({ error: err.message || 'Vocal isolation failed.' }, { status: 500 })
  }
}
