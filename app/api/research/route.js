export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

// Kivora Research Worker endpoint (Cloudflare Worker)
const RESEARCH_WORKER_URL = 'https://kivora-research.odehebuka48.workers.dev/research'

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  try {
    const { query, mode = 'quick' } = await req.json()

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    // Proxy to the Kivora Research Cloudflare Worker
    const workerRes = await fetch(RESEARCH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode }),
    })

    if (!workerRes.ok) {
      const errText = await workerRes.text()
      console.error('[research] Worker error:', workerRes.status, errText)
      return Response.json({ error: 'Research service error. Please try again.' }, { status: 502 })
    }

    const data = await workerRes.json()

    if (data.error) {
      return Response.json({ error: data.error }, { status: 500 })
    }

    // Pass through the Worker's response (already has sources, report, content, title, followups)
    return Response.json({
      sources: data.sources || [],
      report: data.report || '',
      content: data.content || '',
      title: data.title || query,
      followups: data.followups || [],
      data: null,
      mode: data.mode || mode,
    })
  } catch (error) {
    console.error('[research] API error:', error)
    return Response.json({ error: error.message || 'Research failed' }, { status: 500 })
  }
}
