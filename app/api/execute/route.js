export const runtime = 'edge'

import { rateLimit, getClientIP } from '@/lib/ratelimit'
import { getEnvVar } from '@/lib/cfEnv'
import { runCodeFast } from '@/lib/runCode'
import { VALID_LANGUAGE_IDS, setJudge0Config } from '@/lib/judge0'

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

    if (!VALID_LANGUAGE_IDS.has(language_id)) {
      return Response.json(
        { error: `Unsupported language. Supported IDs: ${[...VALID_LANGUAGE_IDS].join(', ')}` },
        { status: 400 }
      )
    }

    // v5.17 — fast lane: Wandbox (keyless, 2-6s) leads for 9 of 12 languages;
    // a dedicated JUDGE0_URL (RapidAPI/self-hosted) flips the order. The old
    // default-only path answered print("5") in 25-30s — users read that as a
    // dead terminal ("connection failing").
    const judge0Url = await getEnvVar('JUDGE0_URL')
    const judge0Key = await getEnvVar('JUDGE0_API_KEY')
    // Dedicated-instance credentials still flow into lib/judge0's module config
    setJudge0Config(judge0Url, judge0Key)

    const data = await runCodeFast(source_code, language_id, stdin, { judge0Url })

    if (data.error) {
      console.error('[execute] run chain error:', data.error)
      return Response.json(
        { error: 'Code execution service error', details: data.error },
        { status: 502 }
      )
    }

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
      memory: data.memory || null,
      executor: data.executor || 'judge0'
    }

    return Response.json(result)
  } catch (err) {
    console.error('[execute]', err)
    return Response.json({ error: err.message || 'Execution failed' }, { status: 500 })
  }
}
