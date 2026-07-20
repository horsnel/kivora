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

// ── POST /api/voice/diarize ──
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
    const numSpeakers = formData.get('num_speakers') || undefined
    const minSpeakers = formData.get('min_speakers') || undefined
    const maxSpeakers = formData.get('max_speakers') || undefined

    // ── Validate required audio file ──
    if (!audioFile || typeof audioFile === 'string') {
      return Response.json({ error: 'Audio file is required. Use the "file" field.' }, { status: 400 })
    }

    // Validate file size (max 50 MB for diarization)
    const MAX_SIZE = 50 * 1024 * 1024
    if (audioFile.size > MAX_SIZE) {
      return Response.json({ error: `Audio file too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB.` }, { status: 400 })
    }

    // Validate speaker constraints
    if (numSpeakers !== undefined) {
      const n = Number(numSpeakers)
      if (isNaN(n) || n < 1 || n > 20) {
        return Response.json({ error: 'num_speakers must be between 1 and 20.' }, { status: 400 })
      }
    }

    // ── Proxy to OmniVoice backend ──
    try {
      const proxyForm = new FormData()
      proxyForm.append('file', audioFile, audioFile.name || 'audio.wav')

      if (numSpeakers) proxyForm.append('num_speakers', String(numSpeakers))
      if (minSpeakers) proxyForm.append('min_speakers', String(minSpeakers))
      if (maxSpeakers) proxyForm.append('max_speakers', String(maxSpeakers))

      const voiceRes = await voiceFetch('/tools/diarize', {
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
        speakers: result.speakers || result.segments || [],
        num_speakers: result.num_speakers || null,
        duration: result.duration || null,
      })
    } catch (voiceErr) {
      console.warn('[voice/diarize] Voice server unavailable:', voiceErr.message)
      return Response.json({
        error: 'Voice server is currently unavailable for speaker diarization.',
        detail: voiceErr.message,
      }, { status: 503 })
    }
  } catch (err) {
    console.error('[voice/diarize]', err)
    return Response.json({ error: err.message || 'Speaker diarization failed.' }, { status: 500 })
  }
}
