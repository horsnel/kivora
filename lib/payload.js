// ── JSON body size guard for API routes ─────────────────────────────
// Base64 payloads (chat image attachments, vision, 3D) travel inside
// JSON bodies. Without a cap a single crafted request could tie up an
// edge isolate parsing megabytes of junk. Reads the raw text once,
// checks its byte length, then parses — O(1) overhead, no double read.

export async function readJsonWithLimit(req, maxBytes) {
  const text = await req.text()
  if (text.length > maxBytes) {
    throw new PayloadTooLarge(`Body exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new PayloadTooLarge('Invalid JSON body')
  }
}

export class PayloadTooLarge extends Error {
  constructor(message) {
    super(message)
    this.name = 'PayloadTooLarge'
    this.status = 413
  }
}

// Convenience wrapper for route handlers:
//   const body = await safeJson(req, 8 * 1024 * 1024)
//   if (body === null) return Response.json({ error: 'Payload too large' }, { status: 413 })
export async function safeJson(req, maxBytes) {
  try {
    return await readJsonWithLimit(req, maxBytes)
  } catch (e) {
    if (e instanceof PayloadTooLarge) return null
    return null
  }
}
