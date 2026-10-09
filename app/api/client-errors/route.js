export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/ratelimit'

// ── Client error collector (crash forensics) ────────────────────
// The chat page's error boundary shows only error.message to the user —
// the STACK, which names the exact crashing file/function, never leaves
// the browser. Three rounds of static analysis couldn't reproduce the
// user's "g.map is not a function" crash, so this endpoint gives every
// boundary crash a voice: the client POSTs the trace here and it lands
// as a small JSON object in a private storage bucket.
//
//   POST /api/client-errors  { m, s, d, h }   → 204 (fire-and-forget)
//   GET  /api/client-errors                   → latest reports (QA window)
//
// Everything is sanitized (token-shaped strings stripped), size-capped,
// and rate-limited. Bucket is PRIVATE — created on first use, same
// idempotent pattern as the forum upload route.

const BUCKET = 'client-error-reports'
const MAX_STACK = 6000
const MAX_MSG = 500
const MAX_META = 300
const KEEP = 20

// Never persist anything that looks like a credential
function scrub(str) {
  return String(str || '')
    .replace(/gh[pousr]_[A-Za-z0-9]{16,}/g, '[redacted]')
    .replace(/sk-[A-Za-z0-9-]{16,}/g, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted-jwt]')
    .replace(/sbp_[A-Za-z0-9]{16,}/g, '[redacted]')
}

function clamp(str, max) {
  const s = scrub(str)
  return s.length > max ? s.slice(0, max) + '…[truncated]' : s
}

function json(data, status = 200) {
  return Response.json(data, { status })
}

async function ensureBucket(admin) {
  try {
    const { data: existing } = await admin.storage.getBucket(BUCKET)
    if (!existing) {
      await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 16384 })
    }
  } catch {
    // race / already exists — the upload below is the real test
  }
}

export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) return new Response(null, { status: 429 })

  try {
    const admin = getSupabaseAdmin()
    if (!admin) return new Response(null, { status: 204 })

    const body = await req.json().catch(() => ({}))
    const report = {
      at: new Date().toISOString(),
      message: clamp(body.m, MAX_MSG),
      stack: clamp(body.s, MAX_STACK),
      digest: clamp(body.d, 120),
      href: clamp(body.h, MAX_META),
      ua: clamp(body.ua, MAX_META),
      screen: clamp(body.scr, 40),
    }
    // Drop empty reports (nothing useful arrived)
    if (!report.message && !report.stack) return new Response(null, { status: 204 })

    await ensureBucket(admin)
    const rand = Math.random().toString(36).slice(2, 10)
    const path = `crash/${Date.now()}-${rand}.json`
    const payload = JSON.stringify(report)
    await admin.storage.from(BUCKET).upload(path, payload, {
      contentType: 'application/json',
      upsert: false,
    })
    return new Response(null, { status: 204 })
  } catch {
    // Reporting must never add noise — swallow everything
    return new Response(null, { status: 204 })
  }
}

export async function GET(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) return json({ error: 'rate limited' }, 429)

  try {
    const admin = getSupabaseAdmin()
    if (!admin) return json({ reports: [], note: 'storage not configured' })

    await ensureBucket(admin)
    const { data: files } = await admin.storage.from(BUCKET).list('crash', {
      limit: KEEP,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (!files || files.length === 0) return json({ reports: [] })

    const reports = []
    for (const f of files.slice(0, KEEP)) {
      if (reports.length >= KEEP) break
      try {
        const { data } = await admin.storage.from(BUCKET).download(`crash/${f.name}`)
        if (!data) continue
        const text = await data.text()
        const parsed = JSON.parse(text)
        reports.push({ file: f.name, ...parsed })
      } catch {}
    }
    return json({ reports, count: reports.length })
  } catch (err) {
    return json({ reports: [], error: clamp(err?.message, 200) }, 500)
  }
}
