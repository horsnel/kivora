export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'
import { getEnvVar } from '@/lib/cfEnv'

// Kivora Research Worker endpoint (Cloudflare Worker)
const RESEARCH_WORKER_URL = 'https://kivora-research.odehebuka48.workers.dev/research'

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { query, mode = 'quick' } = body

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    if (query.length > 2000) {
      return Response.json({ error: 'Query too long (max 2000 characters)' }, { status: 400 })
    }

    // Get OpenRouter key from Cloudflare Pages secrets (kept server-side)
    const openrouterKey = await getEnvVar('OPENROUTER_API_KEY')

    // Forward the request to the Worker server-side (avoids CORS issues + keeps API key secure)
    const workerTimeout = mode === 'deep' ? 90000 : 60000
    const workerRes = await fetch(RESEARCH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.trim(),
        mode,
        openrouter_key: openrouterKey || '',
      }),
      signal: AbortSignal.timeout(workerTimeout),
    })

    if (!workerRes.ok) {
      const errText = await workerRes.text().catch(() => '')
      console.error(`[research] Worker error ${workerRes.status}:`, errText.slice(0, 300))
      return Response.json(
        { error: `Research service error (${workerRes.status}). Please try again.` },
        { status: workerRes.status }
      )
    }

    const data = await workerRes.json()

    if (data.error) {
      return Response.json({ error: data.error }, { status: 500 })
    }

    return Response.json(data)
  } catch (error) {
    console.error('[research] API error:', error)

    if (error.name === 'TimeoutError' || error.message?.includes('abort')) {
      return Response.json(
        { error: 'Research timed out. Please try again or use Quick mode for faster results.' },
        { status: 504 }
      )
    }

    return Response.json({ error: error.message || 'Research failed' }, { status: 500 })
  }
}
