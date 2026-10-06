export const runtime = 'edge'

import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

// ── Self-hosted avatar endpoint ─────────────────────────────────────
// Replaces api.dicebear.com so avatar requests stay on our own domain.
// Deterministic: same seed → same SVG, so responses are immutable and
// can be cached aggressively by the browser and Cloudflare's edge.

const SEED_RE = /^[A-Za-z0-9 _-]{1,64}$/

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  let seed = searchParams.get('seed') || 'Kivora'
  if (!SEED_RE.test(seed)) {
    // sanitize rather than reject — degrade gracefully for odd legacy seeds
    seed = seed.replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 64) || 'Kivora'
  }

  try {
    const svg = createAvatar(avataaars, { seed }).toString()
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Avatar generation failed', { status: 500 })
  }
}
