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

// ── Supported ASR Models ──
const SUPPORTED_MODELS = [
  'whisperx', 'whisper-large', 'whisper-medium', 'whisper-small', 'whisper-tiny',
  'moonshine', 'deepgram', 'assemblyai', 'azure',
]

// ── POST /api/voice/stt ──
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
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
    const language = formData.get('language') || undefined
    const model = formData.get('model') || 'whisperx'
    const responseFormat = formData.get('response_format') || 'json'

    // ── Validate required audio file ──
    if (!audioFile || typeof audioFile === 'string') {
      return Response.json({ error: 'Audio file is required. Use the "file" field.' }, { status: 400 })
    }

    // Validate file size (max 25 MB)
    const MAX_SIZE = 25 * 1024 * 1024
    if (audioFile.size > MAX_SIZE) {
      return Response.json({ error: `Audio file too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB.` }, { status: 400 })
    }

    // Validate model
    if (!SUPPORTED_MODELS.includes(model.toLowerCase())) {
      return Response.json(
        { error: `Unsupported model: "${model}". Supported: ${SUPPORTED_MODELS.join(', ')}` },
        { status: 400 }
      )
    }

    // ── Proxy to OmniVoice backend ──
    try {
      const proxyForm = new FormData()
      proxyForm.append('file', audioFile, audioFile.name || 'audio.wav')

      if (language) proxyForm.append('language', language)
      proxyForm.append('model', model.toLowerCase())
      proxyForm.append('response_format', responseFormat)

      const voiceRes = await voiceFetch('/v1/audio/transcriptions', {
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

      // Normalize the response shape
      return Response.json({
        text: result.text || '',
        language: result.language || language || 'unknown',
        duration: result.duration || null,
        segments: result.segments || null,
      })
    } catch (voiceErr) {
      console.warn('[voice/stt] Voice server unavailable:', voiceErr.message)
      return Response.json({
        error: 'Voice server is currently unavailable for speech-to-text.',
        detail: voiceErr.message,
      }, { status: 503 })
    }
  } catch (err) {
    console.error('[voice/stt]', err)
    return Response.json({ error: err.message || 'Speech-to-text transcription failed.' }, { status: 500 })
  }
}
