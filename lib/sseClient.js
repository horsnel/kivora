// ── Client-side SSE reader ──────────────────────────────────────
// Consumes a fetch Response whose body is the SSE format produced by
// lib/sse.js. Frames on \n\n, tolerates chunk boundaries splitting events,
// and parses each `data:` line as JSON. Calls onEvent for every event and
// resolves when the stream ends (after the terminal `done`/`error` event).

export async function streamSSE(res, onEvent) {
  if (!res.body) {
    // No stream body (older browsers / proxies that buffered everything) —
    // fall back to reading the whole text as one buffer.
    const text = await res.text()
    for (const frame of text.split('\n\n')) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      try { onEvent(JSON.parse(line.slice(5).trim())) } catch {}
    }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  const emitFrame = (frame) => {
    for (const line of frame.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      try { onEvent(JSON.parse(trimmed.slice(5).trim())) } catch {}
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      emitFrame(frame)
    }
  }
  // Flush any trailing frame not terminated by \n\n
  if (buf.trim()) emitFrame(buf)
}

// ── Delta flusher (v5.23) ────────────────────────────────────────
// Coalesces per-token UI updates into ~33Hz flushes. Providers stream at
// hundreds of tokens/sec; calling setState on every delta re-renders (and
// re-parses markdown for) the growing bubble far past frame budget — the
// "streaming freeze": the faster the model, the worse the jank. The
// accumulator lives in the caller's closure; push() merely schedules a
// coalesced onFlush() call, flushNow() lands anything still pending.
//
//   const flusher = createDeltaFlusher(() => setResult(acc))
//   ... on delta: acc += evt.v; flusher.push()
//   ... after the stream ends: flusher.flushNow()
//
// 30ms (~33Hz) reads as continuous motion while staying ~10x cheaper than
// per-token renders; it also caps the worst-case added display latency.
export function createDeltaFlusher(onFlush, intervalMs = 30) {
  let pending = false
  let timer = null
  const flushNow = () => {
    if (timer) { clearTimeout(timer); timer = null }
    if (!pending) return
    pending = false
    try { onFlush() } catch {}
  }
  const push = () => {
    if (pending) return
    pending = true
    timer = setTimeout(flushNow, intervalMs)
  }
  return { push, flushNow }
}
