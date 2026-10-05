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
