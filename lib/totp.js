// ── RFC 6238 TOTP (time-based one-time password) — edge-runtime compatible ──
// Pure Web Crypto (HMAC-SHA1) — works on Cloudflare Workers and Node 18+.
// Used by /api/admin as the second factor when ADMIN_TOTP_SECRET is set.
//
// Secret format: RFC 4648 base32 (no padding), e.g. "MFRGGZDFMZTWQ2LK".
// Authenticator apps (Google Authenticator, Aegis, 1Password, …) accept it
// via otpauth://totp/Kivora%20Admin?secret=<SECRET>&issuer=Kivora

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  if (!clean) return new Uint8Array(0)
  let bits = 0
  let value = 0
  const out = []
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

function counterToBytes(counter) {
  const buf = new Uint8Array(8)
  // Big-endian 64-bit counter (Number is fine up to 2^53)
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff
    counter = Math.floor(counter / 256)
  }
  return buf
}

async function hmacSha1(keyBytes, messageBytes) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.slice().buffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, messageBytes.slice().buffer)
  return new Uint8Array(sig)
}

function dynamicTruncate(hmacBytes, digits) {
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f
  const bin =
    ((hmacBytes[offset] & 0x7f) << 24) |
    (hmacBytes[offset + 1] << 16) |
    (hmacBytes[offset + 2] << 8) |
    hmacBytes[offset + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

/**
 * Generate the current TOTP code for a base32 secret.
 * @param {string} secretBase32
 * @param {{ step?: number, digits?: number, at?: number }} opts
 */
export async function totp(secretBase32, opts = {}) {
  const step = opts.step || 30
  const digits = opts.digits || 6
  const t = opts.at ?? Date.now()
  const counter = Math.floor(t / 1000 / step)
  const key = base32Decode(secretBase32)
  if (!key.length) return ''
  const mac = await hmacSha1(key, counterToBytes(counter))
  return dynamicTruncate(mac, digits)
}

/**
 * Verify a user-supplied code with a ±1 step clock-skew window.
 * Comparison is constant-time-ish over the digit string.
 */
export async function verifyTotp(secretBase32, code, opts = {}) {
  const digits = opts.digits || 6
  const normalized = String(code || '').replace(/\s+/g, '')
  if (!new RegExp(`^\\d{${digits}}$`).test(normalized)) return false
  if (!String(secretBase32 || '').trim()) return false
  const now = opts.at ?? Date.now()
  const step = opts.step || 30
  for (const drift of [-1, 0, 1]) {
    const expected = await totp(secretBase32, { step, digits, at: now + drift * step * 1000 })
    // Length-independent compare via XOR fold
    let diff = expected.length ^ normalized.length
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ normalized.charCodeAt(i)
    if (diff === 0) return true
  }
  return false
}
