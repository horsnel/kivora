// ── Server-side SSE helper for edge routes ──────────────────────
// Wraps a handler that reports progress through `send()`. The Response is
// returned to the client IMMEDIATELY (headers + open stream), then the
// handler streams events as they become available:
//
//   data: {"type":"meta",...}\n\n
//   data: {"type":"delta","v":"token"}\n\n   (repeatable, in order)
//   data: {"type":"done",...}\n\n            (final — full payload)
//   data: {"type":"error",...}\n\n           (terminal failure)
//
// Errors thrown by the handler close the stream (the client treats a
// truncated stream without `done` as an error).
//
// Why SSE over raw chunked text: events are framed on \n\n so the client
// can safely JSON.parse each message regardless of chunk boundaries, and
// the terminal event carries ALL metadata (artifacts, images, provider…)
// that the legacy JSON response carried — clients keep one code path for
// post-processing.

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
}

/**
 * Build a streaming SSE Response.
 * @param {(send: (event: object) => void, conn: { closed: boolean }) => Promise<void>} handler
 *   The 2nd argument is a live connection-state view: `conn.closed` flips to
 *   true the moment the client disconnects (or the stream errors). v5.22 web
 *   push uses it to decide whether a finished reply still needs delivering
 *   through a notification.
 * @param {(work: Promise<void>) => void} [registerBackground] — optional hook
 *   that receives the handler's work promise so the caller can extend the
 *   invocation lifetime beyond a client disconnect (ctx.waitUntil on
 *   Cloudflare). v5.20 resumable streaming depends on this: generation must
 *   finish server-side even when nobody is listening anymore.
 * @returns {Response}
 */
export function sseResponse(handler, registerBackground) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (event) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Client disconnected mid-stream — stop enqueueing
          closed = true
        }
      }
      const conn = { get closed() { return closed } }
      const work = (async () => {
        try {
          await handler(send, conn)
        } catch (err) {
          // Handler-level safety net: surface as an error event if possible
          console.error('[sse] handler crashed:', err?.message || err)
          send({ type: 'error', error: 'Stream failed unexpectedly. Please try again.' })
        }
      })()
      try { if (registerBackground) registerBackground(work) } catch {}
      try {
        await work
      } finally {
        closed = true
        try { controller.close() } catch {}
      }
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}
