export const runtime = 'edge'

import { rateLimit, getClientIP } from '@/lib/ratelimit'

// Kivora Research Worker endpoint (permalink snapshots live in worker KV)
const RESEARCH_WORKER_URL = 'https://kivora-research.odehebuka48.workers.dev'

// ── Public report permalink proxy (v5.7) ──
// GET /api/research/report/:id → worker GET /report/:id
// Permalinks are capability URLs: the 12-hex id IS the authorization, so no
// auth gate here — but the endpoint is rate-limited and the worker enforces
// the id format (^[a-f0-9]{6,24}$) server-side. The proxy keeps the worker
// URL out of the browser and lets the permalink page render same-origin.
export async function GET(req, { params }) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  const { id } = await params
  if (!id || !/^[a-f0-9]{6,24}$/i.test(id)) {
    return Response.json({ error: 'Invalid report id' }, { status: 400 })
  }

  try {
    const workerRes = await fetch(`${RESEARCH_WORKER_URL}/report/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!workerRes.ok) {
      const status = workerRes.status === 404 ? 404 : 502
      return Response.json(
        { error: status === 404 ? 'Report not found or expired' : 'Report service error' },
        { status }
      )
    }

    const data = await workerRes.json()
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    })
  } catch (err) {
    console.error('[research/report] proxy error:', err?.message || err)
    return Response.json({ error: 'Report lookup failed' }, { status: 502 })
  }
}
