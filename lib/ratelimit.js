const requests = new Map()

export function rateLimit(ip, max = 10) {
  const now = Date.now()
  const window = now - 60000
  const hits = (requests.get(ip) || []).filter(t => t > window)
  if (hits.length >= max) return { ok: false }
  requests.set(ip, [...hits, now])
  return { ok: true }
}
