// ── Web Push sender — pure WebCrypto (RFC 8291 aes128gcm + RFC 8292 VAPID) ──
// Server-side only. Deliberately dependency-free: node:crypto is NOT available
// under @cloudflare/next-on-pages, but WebCrypto (crypto.subtle) runs on both
// CF Workers and Node 18+. Needs three env vars (see cfEnv.getEnvVar):
//   VAPID_PUBLIC_KEY  — base64url of the uncompressed P-256 point (65 bytes)
//   VAPID_PRIVATE_KEY — base64url of the P-256 private scalar (32 bytes)
//   VAPID_CONTACT     — "mailto:..." pushed service contact (sub claim)
// When any of them is missing the sender no-ops ({ skipped: 'not_configured' })
// so the chat pipeline is never blocked by push misconfiguration.

const TEXT = new TextEncoder()

function b64urlToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64url(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const c of b) s += String.fromCharCode(c)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function u8BE(n) {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}

async function importEcPublicKey(raw65) {
  return crypto.subtle.importKey('raw', raw65, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
}

async function importVapidKeys(publicKeyB64, privateKeyB64) {
  const pub = b64urlToBytes(publicKeyB64)
  const d = b64urlToBytes(privateKeyB64)
  if (pub.length !== 65 || pub[0] !== 0x04 || d.length !== 32) throw new Error('bad VAPID key material')
  const jwk = {
    kty: 'EC', crv: 'P-256', d: bytesToB64url(d),
    x: bytesToB64url(pub.subarray(1, 33)),
    y: bytesToB64url(pub.subarray(33, 65)),
  }
  const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  return { priv, pubRaw: pub }
}

// RFC 8292 — ES256 JWT for the Authorization: vapid header
export async function vapidAuthorization(vapidPubRaw, privKey, audience, contact) {
  const header = bytesToB64url(TEXT.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytesToB64url(TEXT.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: contact,
  })))
  const data = TEXT.encode(`${header}.${payload}`)
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, data))
  return `vapid t=${header}.${payload}.${bytesToB64url(sig)}, k=${bytesToB64url(vapidPubRaw)}`
}

// RFC 8291 — aes128gcm payload encryption
// @param uaPubRaw65  subscription.keys.p256dh (raw uncompressed, 65 bytes)
// @param authSecret16 subscription.keys.auth (16 bytes, base64url in the sub)
export async function encryptPayload(payloadStr, uaPubRaw65, authSecret) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const uaPub = await importEcPublicKey(uaPubRaw65)
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPub }, ephemeral.privateKey, 256
  ))

  const hkdf = async (saltBytes, ikmBytes, infoBytes, length) => {
    const key = await crypto.subtle.importKey('raw', ikmBytes, 'HKDF', false, ['deriveBits'])
    return new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: infoBytes }, key, length * 8
    ))
  }

  // IKM = HKDF(salt, ecdh_secret, "WebPush: info" || 0x00 || u16be(65) || ua_pub)
  const info = new Uint8Array(13 + 1 + 2 + 65)
  info.set(TEXT.encode('WebPush: info'), 0) // 13 chars — indices 0..12
  info[13] = 0x00 // the NUL separator required by RFC 8291
  info[14] = 0x00; info[15] = 65 // u16be key length
  info.set(uaPubRaw65, 16)
  const ikm = await hkdf(salt, ecdhSecret, info, 32)
  // PRK = HKDF(auth_secret, IKM, empty)
  const prk = await hkdf(authSecret, ikm, new Uint8Array(0), 32)
  // CEK / NONCE
  const cek = await hkdf(salt, prk, TEXT.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, prk, TEXT.encode('Content-Encoding: nonce\0'), 12)

  // Single record: payload + 0x02 delimiter (padding length implicit)
  const payloadBytes = typeof payloadStr === 'string' ? TEXT.encode(payloadStr) : payloadStr
  const plaintext = new Uint8Array(payloadBytes.length + 1)
  plaintext.set(payloadBytes, 0)
  plaintext[payloadBytes.length] = 0x02

  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, cekKey, plaintext
  ))

  // aes128gcm header: salt(16) || rs(4) || idlen(1) || server public key(65)
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))
  const header = new Uint8Array(16 + 4 + 1 + asPubRaw.length)
  header.set(salt, 0)
  header.set(u8BE(4096), 16)
  header[20] = asPubRaw.length
  header.set(asPubRaw, 21)
  const body = new Uint8Array(header.length + ciphertext.length)
  body.set(header, 0); body.set(ciphertext, header.length)
  return body
}

function parseSubKeys(subscription) {
  const keys = subscription?.keys || {}
  const p256dh = b64urlToBytes(String(keys.p256dh || ''))
  const auth = b64urlToBytes(String(keys.auth || ''))
  if (!keys.p256dh || !keys.auth || p256dh.length !== 65 || p256dh[0] !== 0x04 || auth.length < 16) {
    throw new Error('malformed subscription keys')
  }
  return { p256dh, auth }
}

/**
 * Send a push notification to every device registered for a user.
 * Best-effort by contract — NEVER throws; delivery failures are logged and
 * dead subscriptions (404/410 from the push service) are pruned.
 * @param {object} admin   Supabase service-role client
 * @param {string} userId  recipient
 * @param {object} note    { title, body, tag?, url? }
 * @param {function} getEnvVar  cfEnv.getEnvVar (injected to keep this module import-clean)
 */
export async function sendPushToUser(admin, userId, note, getEnvVar) {
  try {
    const [publicKeyB64, privateKeyB64, contact] = await Promise.all([
      getEnvVar('VAPID_PUBLIC_KEY'), getEnvVar('VAPID_PRIVATE_KEY'), getEnvVar('VAPID_CONTACT'),
    ])
    if (!publicKeyB64 || !privateKeyB64) return { skipped: 'not_configured' }
    if (!admin || !userId) return { skipped: 'no_target' }

    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
    if (error) return { skipped: 'db_error' }
    if (!subs?.length) return { skipped: 'no_subscriptions' }

    const { priv, pubRaw } = await importVapidKeys(publicKeyB64, privateKeyB64)
    const payload = TEXT.encode(JSON.stringify({
      title: String(note.title || 'Kivora').slice(0, 120),
      body: String(note.body || '').slice(0, 300),
      tag: note.tag || 'kivora-chat',
      url: note.url || '/chat',
    }))

    let sent = 0
    for (const sub of subs) {
      try {
        let endpoint
        try { endpoint = new URL(sub.endpoint) } catch { throw new Error('bad endpoint') }
        const { p256dh, auth } = parseSubKeys({ keys: { p256dh: sub.p256dh, auth: sub.auth } })
        const body = await encryptPayload(payload, p256dh, auth)
        const authHeader = await vapidAuthorization(
          pubRaw, priv, `${endpoint.protocol}//${endpoint.host}`, contact || 'mailto:support@kivora.app'
        )
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            TTL: '86400',
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            Urgency: 'high',
          },
          body,
          signal: AbortSignal.timeout(8000),
        })
        if (res.status === 404 || res.status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        } else if (res.ok || res.status === 201) {
          sent += 1
        }
      } catch (e) {
        console.warn('[push] sub send failed:', String(e?.message || e).slice(0, 120))
      }
    }
    return { sent, total: subs.length }
  } catch (err) {
    console.warn('[push] sendPushToUser failed:', String(err?.message || err).slice(0, 160))
    return { error: String(err?.message || err).slice(0, 160) }
  }
}
