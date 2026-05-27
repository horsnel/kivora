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

// ── Supported TTS Engines ──
const SUPPORTED_ENGINES = [
  'coqui', 'bark', 'xtts', 'xttsv2', 'valetechat',
  'f5', 'fish', 'melo', 'piper', 'edge', 'openai',
  'elevenlabs', 'styletts2', 'vits', 'chattts',
]

// ── POST /api/voice/tts ──
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 8).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const body = await req.json()
    const {
      text,
      voice = 'default',
      language = 'en',
      engine = 'coqui',
      speed = 1.0,
      format = 'mp3',
      instruct,
    } = body

    // ── Validate required fields ──
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return Response.json({ error: 'Text is required for TTS generation.' }, { status: 400 })
    }

    if (text.length > 5000) {
      return Response.json({ error: 'Text exceeds maximum length of 5000 characters.' }, { status: 400 })
    }

    if (!SUPPORTED_ENGINES.includes(engine.toLowerCase())) {
      return Response.json(
        { error: `Unsupported engine: "${engine}". Supported: ${SUPPORTED_ENGINES.join(', ')}` },
        { status: 400 }
      )
    }

    const validFormats = ['mp3', 'wav', 'ogg', 'flac', 'pcm']
    if (!validFormats.includes(format.toLowerCase())) {
      return Response.json(
        { error: `Unsupported format: "${format}". Supported: ${validFormats.join(', ')}` },
        { status: 400 }
      )
    }

    const clampedSpeed = Math.max(0.25, Math.min(4.0, Number(speed) || 1.0))

    // ── Call OmniVoice backend ──
    try {
      const payload = {
        model: engine.toLowerCase(),
        input: text,
        voice,
        response_format: format.toLowerCase(),
        speed: clampedSpeed,
      }

      // Add language hint for multilingual engines
      if (language && language !== 'en') {
        payload.language = language
      }

      // Add instruct text for instruct-capable engines (e.g., ChatTTS, XTTSv2)
      if (instruct && typeof instruct === 'string' && instruct.trim()) {
        payload.instruct_text = instruct.trim()
      }

      const voiceRes = await voiceFetch('/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!voiceRes.ok) {
        const errText = await voiceRes.text().catch(() => '')
        let errMsg = `Voice server error (${voiceRes.status})`
        try { errMsg = JSON.parse(errText).error?.message || errMsg } catch {}
        throw new Error(errMsg)
      }

      // Stream the audio response back
      const contentType = voiceRes.headers.get('content-type') || `audio/${format}`
      const audioBody = voiceRes.body

      return new Response(audioBody, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
          'X-Voice-Engine': engine,
          'X-Voice-Format': format,
        },
      })
    } catch (voiceErr) {
      // ── Graceful Fallback: Return browser TTS instructions ──
      console.warn('[voice/tts] Voice server unavailable, returning browser TTS fallback:', voiceErr.message)

      return Response.json({
        fallback: true,
        message: 'Voice server is currently unavailable. Use browser TTS as fallback.',
        instructions: {
          type: 'browser-tts',
          text,
          voice,
          language,
          speed: clampedSpeed,
          engine: 'browser',
        },
        error: voiceErr.message,
      }, { status: 503 })
    }
  } catch (err) {
    console.error('[voice/tts]', err)
    if (err.name === 'SyntaxError') {
      return Response.json({ error: 'Invalid JSON in request body.' }, { status: 400 })
    }
    return Response.json({ error: err.message || 'TTS generation failed.' }, { status: 500 })
  }
}
