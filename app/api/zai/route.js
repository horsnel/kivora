export const runtime = 'edge' 

/**
 * ZAI Skills API — Unified endpoint for all ZAI SDK skills
 *
 * POST /api/zai
 * Body: { skill: string, ...params }
 *
 * Supported skills:
 *   - llm            → LLM chat completions
 *   - vlm            → Vision language model
 *   - image-gen      → Image generation
 *   - image-edit     → Image editing
 *   - image-search   → Image search
 *   - asr            → Speech to text
 *   - tts            → Text to speech
 *   - web-search     → Web search
 *   - web-reader     → Web page reader
 *   - video-gen      → Video generation
 *   - video-understand → Video understanding
 *   - async-result   → Query async task result
 */

import {
  chatCompletions,
  visionCompletions,
  imageGeneration,
  imageEdit,
  imageSearch,
  audioASR,
  audioTTS,
  webSearch,
  webReader,
  videoGeneration,
  videoUnderstand,
  asyncResult,
} from '@/lib/zai'

export async function POST(req) {
  try {
    const body = await req.json()
    const { skill, ...params } = body

    if (!skill) {
      return Response.json({ error: 'skill is required' }, { status: 400 })
    }

    let result

    switch (skill) {
      // ─── LLM ───
      case 'llm':
        result = await chatCompletions(params)
        break

      // ─── VLM ───
      case 'vlm':
        result = await visionCompletions(params)
        break

      // ─── Image ───
      case 'image-gen':
        if (!params.prompt) {
          return Response.json({ error: 'prompt is required for image-gen' }, { status: 400 })
        }
        result = await imageGeneration(params)
        break

      case 'image-edit':
        result = await imageEdit(params)
        break

      case 'image-search':
        if (!params.query) {
          return Response.json({ error: 'query is required for image-search' }, { status: 400 })
        }
        result = await imageSearch(params)
        break

      // ─── Audio ───
      case 'asr':
        if (!params.audio) {
          return Response.json({ error: 'audio is required for asr' }, { status: 400 })
        }
        result = await audioASR(params)
        break

      case 'tts':
        if (!params.input) {
          return Response.json({ error: 'input is required for tts' }, { status: 400 })
        }
        // TTS returns raw audio Response
        const ttsResponse = await audioTTS(params)
        const audioBuffer = await ttsResponse.arrayBuffer()
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': ttsResponse.headers.get('content-type') || 'audio/mpeg',
            'Content-Length': String(audioBuffer.byteLength),
          },
        })

      // ─── Web ───
      case 'web-search':
        if (!params.query) {
          return Response.json({ error: 'query is required for web-search' }, { status: 400 })
        }
        result = await webSearch(params)
        break

      case 'web-reader':
        if (!params.url) {
          return Response.json({ error: 'url is required for web-reader' }, { status: 400 })
        }
        result = await webReader(params)
        break

      // ─── Video ───
      case 'video-gen':
        result = await videoGeneration(params)
        break

      case 'video-understand':
        if (!params.video) {
          return Response.json({ error: 'video is required for video-understand' }, { status: 400 })
        }
        result = await videoUnderstand(params)
        break

      // ─── Async ───
      case 'async-result':
        if (!params.taskId) {
          return Response.json({ error: 'taskId is required for async-result' }, { status: 400 })
        }
        result = await asyncResult(params.taskId)
        break

      default:
        return Response.json(
          { error: `Unknown skill: "${skill}". Supported: llm, vlm, image-gen, image-edit, image-search, asr, tts, web-search, web-reader, video-gen, video-understand, async-result` },
          { status: 400 }
        )
    }

    // If the result is a ReadableStream (streaming response), pipe it through
    if (result instanceof ReadableStream) {
      return new Response(result, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    return Response.json(result)
  } catch (err) {
    const msg = err?.message || 'ZAI API error'
    const isAuthError = msg.includes('401') || msg.toLowerCase().includes('auth') || msg.includes('token expired')
    console.error('[zai-api]', msg)

    return Response.json({
      error: msg,
      hint: isAuthError
        ? 'ZAI API returned 401 — this may be a geo-restriction. The API key works from supported regions but not from this server location. Try calling from your own device/network.'
        : undefined,
      debug: {
        baseUrl: process.env.ZAI_BASE_URL || '(not set)',
        hasApiKey: !!(process.env.ZAI_API_KEY),
        hasUserId: !!(process.env.ZAI_USER_ID),
      }
    }, { status: isAuthError ? 401 : 500 })
  }
}
