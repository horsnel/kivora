export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

const VALID_LANGUAGE_IDS = [71, 63, 74, 62, 54, 50, 60, 73, 72, 68, 46, 82]

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  try {
    const { source_code, language_id, stdin = '' } = await req.json()

    if (!source_code || typeof source_code !== 'string') {
      return Response.json({ error: 'source_code is required' }, { status: 400 })
    }

    if (!language_id || typeof language_id !== 'number') {
      return Response.json({ error: 'language_id is required (must be a number)' }, { status: 400 })
    }

    if (!VALID_LANGUAGE_IDS.includes(language_id)) {
      return Response.json(
        { error: `Invalid language_id. Valid IDs: ${VALID_LANGUAGE_IDS.join(', ')}` },
        { status: 400 }
      )
    }

    const response = await fetch(
      'https://ce.judge0.com/submissions?base64_encoded=false&wait=true',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source_code,
          language_id,
          stdin
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[execute] Judge0 error:', response.status, errorText)
      return Response.json(
        { error: 'Code execution service error', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json({
      stdout: data.stdout || null,
      stderr: data.stderr || null,
      exit_code: data.exit_code ?? null,
      status: data.status?.description || data.status?.id?.toString() || 'unknown',
      time: data.time || null,
      memory: data.memory || null
    })
  } catch (err) {
    console.error('[execute]', err)
    return Response.json({ error: err.message || 'Execution failed' }, { status: 500 })
  }
}
