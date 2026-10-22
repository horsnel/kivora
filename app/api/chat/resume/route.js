export const runtime = 'edge'
import { createClient } from '@supabase/supabase-js'
import { getEnvVar, runInBackground } from '@/lib/cfEnv'
import { sseResponse } from '@/lib/sse'
import { rateLimit, getClientIP } from '@/lib/ratelimit'

// ── Resumable streaming endpoint (v5.20) ──────────────────────────
// The client calls this when its network drops mid-response (or when it
// reloads the page while a generation is still running). The chat route
// keeps generating in the background and persists output to the
// chat_generations buffer; this endpoint hands back everything that was
// already generated plus a live tail of the remainder:
//
//   ?probe=1                          → {status: none|active|done|error, length}
//   ?sid=…&offset=N  (row done)      → {status:'done', content:…slice(N), …meta}
//   ?sid=…&offset=N  (row error)     → {status:'error', …recorded payload}
//   ?sid=…&offset=N  (row active)    → SSE: delta*(catch-up) → delta*(live tail)
//                                      → done{…meta} | error{stalled}
//
// Offset semantics: character count the client has ALREADY rendered from
// this generation; everything past it is sent. content is append-only, so
// offsets are stable across reconnects.

const RESUME_TIMEOUT_MS = 90_000
const POLL_EVERY_MS = 350
const STALE_ROW_MS = 5 * 60_000 // no updates for 5min → the generator is gone

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const safeObj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}

export async function GET(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const sid = (url.searchParams.get('sid') || '').trim()
  const probe = url.searchParams.get('probe') === '1'
  let offset = parseInt(url.searchParams.get('offset') || '0', 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0
  if (!sid || sid.length > 80) {
    return Response.json({ status: 'none' }, { status: 404 })
  }

  const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const supaKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
  if (!supaUrl || !supaKey) {
    return Response.json({ error: 'Service not configured' }, { status: 503 })
  }
  const admin = createClient(supaUrl, supaKey)

  // Best-effort identity — anonymous reconnects are allowed only for
  // buffer rows that were created anonymously (user_id null).
  let chatUser = null
  const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (accessToken && supaUrl && supaAnon) {
    try {
      const userClient = createClient(supaUrl, supaAnon, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      })
      chatUser = (await userClient.auth.getUser())?.data?.user || null
    } catch { /* anonymous */ }
  }

  const { data: row, error: rowErr } = await admin
    .from('chat_generations')
    .select('id, user_id, content, status, done, error, meta, updated_at')
    .eq('id', sid)
    .single()
  if (rowErr || !row) {
    return Response.json({ status: 'none' }, { status: 404 })
  }
  if (row.user_id && (!chatUser || chatUser.id !== row.user_id)) {
    return Response.json({ status: 'forbidden' }, { status: 403 })
  }

  const content = typeof row.content === 'string' ? row.content : ''

  if (probe) {
    return Response.json({
      status: row.done ? (row.error ? 'error' : 'done') : 'active',
      length: content.length,
      tool: row.status || null,
    })
  }

  if (row.done && row.error) {
    return Response.json({ status: 'error', ...safeObj(row.error) })
  }
  if (row.done) {
    // Everything (including the "already-generated" part past the offset)
    // plus the full done payload — the client finalizes exactly like a
    // normal done event.
    return Response.json({ status: 'done', content: content.slice(offset), ...safeObj(row.meta) })
  }

  // Still generating — catch-up suffix first, then tail the buffer until
  // the generator marks the row done (or we stall out).
  return sseResponse(async (send) => {
    let sent = offset
    let lastTool = null
    const emitNew = (c) => {
      if (c.length > sent) {
        send({ type: 'delta', v: c.slice(sent) })
        sent = c.length
      }
    }

    emitNew(content)
    // Shimmer hint for reconnecting clients — the image tool can run 5-15s
    // and the generic thinking indicator reads as "stuck" during that.
    if (row.status === 'generate_image') {
      send({ type: 'status', tool: 'generate_image' })
      lastTool = row.status
    }

    const started = Date.now()
    while (Date.now() - started < RESUME_TIMEOUT_MS) {
      await sleep(POLL_EVERY_MS)
      let cur = null
      try {
        const r = await admin
          .from('chat_generations')
          .select('content, status, done, error, meta, updated_at')
          .eq('id', sid)
          .single()
        cur = r.data
      } catch { /* transient — keep polling */ }
      if (!cur) break

      const c = typeof cur.content === 'string' ? cur.content : ''
      emitNew(c)
      if (cur.status && cur.status !== lastTool) {
        lastTool = cur.status
        if (lastTool === 'generate_image') send({ type: 'status', tool: lastTool })
      }
      if (cur.done) {
        if (cur.error) { send({ type: 'error', ...safeObj(cur.error) }); return }
        send({ type: 'done', ...safeObj(cur.meta) })
        return
      }
      // The generator isolate died without marking done (provider hang,
      // deploy, eviction) — stop tailing a row that is frozen.
      const updatedAt = new Date(cur.updated_at || 0).getTime()
      if (Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_ROW_MS) break
    }
    send({
      type: 'error',
      stalled: true,
      error: 'The response stopped progressing. Please resend your message to try again.',
    })
  }, (work) => { runInBackground(work) })
}
