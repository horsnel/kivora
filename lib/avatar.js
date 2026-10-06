// ── Avatar URL helpers ──────────────────────────────────────────────
// Avatars are self-hosted at /api/avatar (DiceBear rendered server-side),
// so api.dicebear.com never appears in our pages or API responses.
// Legacy profiles may still store old external URLs in the DB — this
// helper rewrites them to the internal route at render time.

export const AVATAR_API = '/api/avatar'

export function internalAvatarUrl(seed) {
  return `${AVATAR_API}?seed=${encodeURIComponent(seed)}`
}

export function resolveAvatarUrl(url) {
  if (!url || typeof url !== 'string') return ''
  try {
    const u = new URL(url)
    if (u.hostname === 'api.dicebear.com' || u.hostname.endsWith('.dicebear.com')) {
      const seed = u.searchParams.get('seed')
      if (seed) return internalAvatarUrl(seed)
    }
  } catch {
    // relative/invalid URL — return as-is
  }
  return url
}
