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

// ── Supported Translation Engines ──
const SUPPORTED_ENGINES = ['argos', 'nllb', 'google', 'deepl', 'openai']

// ── POST /api/voice/translate ──
export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip, 12).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { text, from, to, engine = 'argos' } = body

    // ── Validate required fields ──
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return Response.json({ error: 'Text is required for translation.' }, { status: 400 })
    }

    if (!to || typeof to !== 'string') {
      return Response.json({ error: 'Target language ("to") is required.' }, { status: 400 })
    }

    if (!SUPPORTED_ENGINES.includes(engine.toLowerCase())) {
      return Response.json(
        { error: `Unsupported engine: "${engine}". Supported: ${SUPPORTED_ENGINES.join(', ')}` },
        { status: 400 }
      )
    }

    // ── Try OmniVoice backend first ──
    try {
      const voiceRes = await voiceFetch('/dub/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          source_lang: from || 'auto',
          target_lang: to,
          engine: engine.toLowerCase(),
        }),
      })

      if (!voiceRes.ok) {
        const errText = await voiceRes.text().catch(() => '')
        let errMsg = `Voice server error (${voiceRes.status})`
        try { errMsg = JSON.parse(errText).error?.message || errMsg } catch {}
        throw new Error(errMsg)
      }

      const result = await voiceRes.json()

      return Response.json({
        translated: result.translated || result.translation || result.text || '',
        from: result.source_lang || from || 'auto',
        to: result.target_lang || to,
        engine: result.engine || engine,
      })
    } catch (voiceErr) {
      // ── Fallback: Use OpenAI-compatible LLM for translation ──
      console.warn('[voice/translate] Voice server unavailable, falling back to LLM translation:', voiceErr.message)

      const groqKey = await getEnvVar('GROQ_API_KEY')
      if (!groqKey) {
        return Response.json({
          error: 'Voice server unavailable and no LLM fallback key configured.',
          detail: voiceErr.message,
        }, { status: 503 })
      }

      try {
        const sourceLabel = from && from !== 'auto' ? from : 'the source language'
        const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: `You are a professional translator. Translate the following text from ${sourceLabel} to ${to}. Return ONLY the translated text, nothing else. Do not add explanations, notes, or quotation marks.`,
              },
              { role: 'user', content: text.trim() },
            ],
            temperature: 0.3,
            max_tokens: Math.min(4096, text.length * 3),
          }),
        })

        if (!llmRes.ok) {
          throw new Error(`LLM fallback failed (${llmRes.status})`)
        }

        const llmResult = await llmRes.json()
        const translated = llmResult.choices?.[0]?.message?.content?.trim() || ''

        return Response.json({
          translated,
          from: from || 'auto',
          to,
          engine: 'openai-fallback',
          fallback: true,
        })
      } catch (llmErr) {
        console.error('[voice/translate] LLM fallback also failed:', llmErr.message)
        return Response.json({
          error: 'Both voice server and LLM fallback are unavailable.',
          detail: voiceErr.message,
        }, { status: 503 })
      }
    }
  } catch (err) {
    console.error('[voice/translate]', err)
    if (err.name === 'SyntaxError') {
      return Response.json({ error: 'Invalid JSON in request body.' }, { status: 400 })
    }
    return Response.json({ error: err.message || 'Translation failed.' }, { status: 500 })
  }
}
