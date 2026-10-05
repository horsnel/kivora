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
 * @param {(send: (event: object) => void) => Promise<void>} handler
 * @returns {Response}
 */
export function sseResponse(handler) {
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
      try {
        await handler(send)
      } catch (err) {
        // Handler-level safety net: surface as an error event if possible
        console.error('[sse] handler crashed:', err?.message || err)
        send({ type: 'error', error: 'Stream failed unexpectedly. Please try again.' })
      } finally {
        closed = true
        try { controller.close() } catch {}
      }
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}
