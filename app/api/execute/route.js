export const runtime = 'edge' 

import { rateLimit, getClientIP } from '@/lib/ratelimit'

const VALID_LANGUAGE_IDS = [71, 63, 74, 62, 54, 50, 60, 73, 72, 68, 46, 82]

export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
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
        { error: `Unsupported language. Supported IDs: ${VALID_LANGUAGE_IDS.join(', ')}` },
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

    // Build the full result — include ALL output fields
    const result = {
      stdout: data.stdout || null,
      stderr: data.stderr || null,
      compile_output: data.compile_output || null,
      status: {
        id: data.status?.id || null,
        description: data.status?.description || 'Unknown'
      },
      exit_code: data.exit_code ?? null,
      time: data.time || null,
      memory: data.memory || null
    }

    return Response.json(result)
  } catch (err) {
    console.error('[execute]', err)
    return Response.json({ error: err.message || 'Execution failed' }, { status: 500 })
  }
}
