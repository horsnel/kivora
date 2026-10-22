// ── Resumable-stream generation buffer (v5.20) ────────────────────
// Persists the growing assistant reply to the `chat_generations` table AS
// IT STREAMS, so a client that drops mid-response can reconnect via
// GET /api/chat/resume and receive the remaining AND already-generated
// content. The chat route also keeps generating in the background after a
// disconnect (ctx.waitUntil), so the reply completes server-side even when
// nobody is listening and lands in chat_sessions through the normal final
// save.
//
// Design constraints:
//  • Buffering must NEVER break the main generation path — every failure
//    is swallowed and retried on the next flush.
//  • Writes are throttled (600ms trailing) — one small row upsert, never
//    a full conversation rewrite.
//  • content is append-only (deltas arrive in order), so character
//    offsets stay stable and resume can slice safely.
//  • user_id is written ONLY on the first flush — later upserts omit it,
//    so PostgREST's ON CONFLICT DO UPDATE never lets a second account
//    claim someone else's buffer row.

const FLUSH_EVERY = 600

export function createGenRecorder(admin, sid, userId) {
  if (!admin || !sid) return null

  const state = { content: '', seq: 0, status: null, done: false, error: null, meta: null }
  let wroteOnce = false
  let timer = null
  let inFlight = null
  let finished = false

  async function writeNow() {
    const row = {
      id: sid,
      content: state.content,
      seq: ++state.seq,
      status: state.status,
      done: state.done,
      error: state.error,
      meta: state.meta,
      updated_at: new Date().toISOString(),
    }
    if (!wroteOnce) {
      row.user_id = userId || null
      wroteOnce = true
    }
    inFlight = admin
      .from('chat_generations')
      .upsert(row, { onConflict: 'id' })
      .then(() => {}, () => {})
      .finally(() => { inFlight = null })
    await inFlight
  }

  function schedule() {
    if (finished || timer) return
    timer = setTimeout(async () => {
      timer = null
      if (finished) return
      try {
        if (inFlight) await inFlight
        if (timer || finished) return // a newer flush is scheduled / done won
        await writeNow()
      } catch { /* buffer writes never break generation */ }
    }, FLUSH_EVERY)
  }

  return {
    /** Feed every SSE event; deltas append, status events tag the row. */
    observe(evt) {
      if (!evt || typeof evt !== 'object') return
      if (evt.type === 'delta' && typeof evt.v === 'string' && evt.v) {
        state.content += evt.v
        schedule()
      } else if (evt.type === 'status' && evt.tool && evt.tool !== state.status) {
        state.status = evt.tool
        schedule()
      }
    },

    /** Terminal success — persists meta (the full done payload) atomically. */
    async finish(meta) {
      finished = true
      if (timer) { clearTimeout(timer); timer = null }
      state.done = true
      state.meta = (meta && typeof meta === 'object' && !Array.isArray(meta)) ? meta : {}
      try {
        if (inFlight) await inFlight
        await writeNow()
        // Opportunistic housekeeping: buffer rows older than 24h are dead
        // weight (their sessions were saved long ago). One indexed delete
        // per completed message keeps the table tiny. Fire and forget.
        admin
          .from('chat_generations')
          .delete()
          .lt('updated_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .then(() => {}, () => {})
      } catch { /* never break the done event */ }
    },

    /** Terminal failure (gate rejection / provider crash) — recorded so a
     *  reconnecting client renders the same notice card instead of hanging. */
    async fail(errorPayload) {
      finished = true
      if (timer) { clearTimeout(timer); timer = null }
      state.done = true
      state.error = (errorPayload && typeof errorPayload === 'object' && !Array.isArray(errorPayload))
        ? errorPayload
        : { error: 'Generation failed.' }
      try {
        if (inFlight) await inFlight
        await writeNow()
      } catch { /* never break the error path */ }
    },

    /** Current buffer snapshot (used by tests). */
    snapshot() {
      return { ...state, contentLength: state.content.length }
    },
  }
}
