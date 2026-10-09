// ── Client error reporting ──────────────────────────────────────
// Fire-and-forget crash forensics: POSTs the boundary error (message +
// stack + digest + context) to /api/client-errors so the exact crashing
// file/function can be pulled server-side. Never throws, never blocks —
// a reporting failure must not add noise to an already-crashing page.

export function reportClientError(error) {
  try {
    const payload = {
      m: String(error?.message || '').slice(0, 500),
      s: String(error?.stack || '').slice(0, 6000),
      d: String(error?.digest || '').slice(0, 120),
      h: typeof location !== 'undefined' ? location.href.slice(0, 300) : '',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '',
      scr: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
    }
    if (!payload.m && !payload.s) return
    const body = JSON.stringify(payload)
    // keepalive lets the POST survive an immediate reload/unload
    fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {}
}
