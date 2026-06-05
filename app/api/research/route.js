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

    // Get OpenRouter key from Cloudflare Pages secrets
    const openrouterKey = await getEnvVar('OPENROUTER_API_KEY')

    // Return the Worker URL and key so the frontend can call the Worker directly
    // This avoids the CF Pages edge function 30s timeout
    return Response.json({
      worker_url: RESEARCH_WORKER_URL,
      openrouter_key: openrouterKey || '',
      query,
      mode,
    })
  } catch (error) {
    console.error('[research] API error:', error)
    return Response.json({ error: error.message || 'Research failed' }, { status: 500 })
  }
}
