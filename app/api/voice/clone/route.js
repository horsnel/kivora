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

// ── POST /api/voice/clone ──
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 4).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    // ── Parse multipart/form-data ──
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return Response.json({ error: 'Request must be multipart/form-data with a reference audio file.' }, { status: 400 })
    }

    const formData = await req.formData()
    const audioFile = formData.get('file')
    const name = formData.get('name')
    const language = formData.get('language') || 'en'
    const referenceText = formData.get('reference_text') || ''

    // ── Validate required fields ──
    if (!audioFile || typeof audioFile === 'string') {
      return Response.json({ error: 'Reference audio file is required. Use the "file" field.' }, { status: 400 })
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Response.json({ error: 'Voice profile name is required. Use the "name" field.' }, { status: 400 })
    }

    // Validate file size (max 10 MB for reference audio)
    const MAX_SIZE = 10 * 1024 * 1024
    if (audioFile.size > MAX_SIZE) {
      return Response.json({ error: `Reference audio too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB.` }, { status: 400 })
    }

    // Validate name length
    if (name.trim().length > 64) {
      return Response.json({ error: 'Voice profile name must be 64 characters or less.' }, { status: 400 })
    }

    // ── Proxy to OmniVoice backend ──
    try {
      const proxyForm = new FormData()
      proxyForm.append('file', audioFile, audioFile.name || 'reference.wav')
      proxyForm.append('name', name.trim())
      proxyForm.append('language', language)
      if (referenceText) proxyForm.append('reference_text', referenceText)

      const voiceRes = await voiceFetch('/profiles', {
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
        id: result.id || result.profile_id || '',
        name: result.name || name.trim(),
        type: result.type || 'cloned',
        language: result.language || language,
      })
    } catch (voiceErr) {
      console.warn('[voice/clone] Voice server unavailable:', voiceErr.message)
      return Response.json({
        error: 'Voice server is currently unavailable for voice cloning.',
        detail: voiceErr.message,
      }, { status: 503 })
    }
  } catch (err) {
    console.error('[voice/clone]', err)
    return Response.json({ error: err.message || 'Voice cloning failed.' }, { status: 500 })
  }
}
