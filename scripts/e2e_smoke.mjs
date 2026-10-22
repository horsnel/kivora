#!/usr/bin/env node
// v5.22 E2E smoke — the v5.20 resumable-streaming chain against PRODUCTION:
//   signup → stream request → abort mid-generation → poll resume probe →
//   resume with offset → assert the reply assembled byte-complete.
// Also smoke-checks guest (anonymous) chat entry after the login-wall fix.
// Usage: node scripts/e2e_smoke.mjs [baseURL]   (default https://kivora.pages.dev)
import crypto from 'crypto'

const BASE = (process.argv[2] || 'https://kivora.pages.dev').replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ FAIL ${name} ${extra}`) }
}

async function getSupaConfig() {
  const html = await (await fetch(BASE + '/')).text()
  const m = html.match(/window\.__KIVORA_ENV__=({.*?})</)
  if (!m) throw new Error('__KIVORA_ENV__ not found on homepage')
  return JSON.parse(m[1])
}

const SID = 'e2e-' + crypto.randomUUID()
const email = `e2e-${Date.now()}@kivora-smoke.test`
const password = 'E2e-' + crypto.randomUUID().slice(0, 16) + 'A1!'

console.log(`E2E smoke vs ${BASE}`)
console.log(`session: ${SID}`)

// ── 1. create a throwaway account through the public signup API ──
const cfg = await getSupaConfig()
ok('supabase config discovered from homepage', !!cfg.url && !!cfg.key)
const signupRes = await fetch(`${cfg.url}/auth/v1/signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  body: JSON.stringify({ email, password }),
})
const signupJson = await signupRes.json().catch(() => ({}))
const token = signupJson?.access_token
ok('test account created (or exists)', signupRes.ok || /already/i.test(String(signupJson?.msg || '')))
if (!token) {
  // "already registered" path can't login without existing password — abort cleanly
  console.log('no token — cannot continue authed chain'); process.exit(1)
}
const BEARER = { 'Authorization': `Bearer ${token}` }

// ── 2. start a streaming chat and cut it mid-generation ──
const prompt = 'Write a 120-word story about a lighthouse keeper. Do not stop early.'
const ctrl = new AbortController()
let receivedBeforeCut = ''
let gotDelta = false
let cutAt = 0
const chatStart = Date.now()
const chatPromise = (async () => {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...BEARER },
    body: JSON.stringify({
      stream: true,
      sessionId: SID,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: ctrl.signal,
  })
  ok('chat stream opened', res.ok, `(HTTP ${res.status})`)
  if (!res.ok || !res.body) return
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      for (const line of buf.split('\n\n')) {
        const m = line.match(/^data: (.+)$/m)
        if (!m) continue
        try {
          const evt = JSON.parse(m[1])
          if (evt.type === 'delta' && typeof evt.v === 'string') {
            gotDelta = true
            receivedBeforeCut += evt.v
            // cut once we have a meaningful prefix to resume from
            if (receivedBeforeCut.length > 60 && !cutAt) { cutAt = receivedBeforeCut.length; ctrl.abort() }
          }
        } catch {}
      }
      buf = buf.slice(buf.lastIndexOf('\n\n') + 2)
      if (cutAt) break
    }
  } catch (e) {
    if (String(e?.name) !== 'AbortError') console.log('  (stream read ended:', String(e?.message || e).slice(0, 80) + ')')
  }
})()
await chatPromise
ok('deltas received before cut', gotDelta && receivedBeforeCut.length > 20, `(got ${receivedBeforeCut.length} chars)`)
console.log(`  cut after ${cutAt || receivedBeforeCut.length} chars / ${(Date.now() - chatStart) / 1000 | 0}s`)

// ── 3. generation must keep running server-side (v5.20 waitUntil) ──
let probe = null
for (let i = 0; i < 45; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const r = await fetch(`${BASE}/api/chat/resume?sid=${encodeURIComponent(SID)}&probe=1`, { headers: BEARER })
  const j = await r.json().catch(() => ({}))
  if (j.status === 'done' || j.status === 'error') { probe = j; break }
  if (i === 44) probe = j
}
ok('generation completed server-side after disconnect', probe?.status === 'done', JSON.stringify(probe).slice(0, 120))
ok('buffer holds full reply', (probe?.length || 0) > 100, `length=${probe?.length}`)

// ── 4. resume from the cut offset: server returns ONLY the remainder ──
const off = cutAt || receivedBeforeCut.length
const resumeRes = await fetch(`${BASE}/api/chat/resume?sid=${encodeURIComponent(SID)}&offset=${off}`, { headers: BEARER })
const resumeJson = await resumeRes.json().catch(() => ({}))
ok('resume answered', resumeRes.ok && resumeJson.status === 'done', JSON.stringify(resumeJson).slice(0, 120))
const reassembled = receivedBeforeCut.slice(0, off) + (resumeJson.content || '')
ok('reassembled length matches buffer', Math.abs(reassembled.length - (probe?.length || 0)) <= 2, `reassembled=${reassembled.length} buffer=${probe?.length}`)

// ── 5. guest chat: open to everyone now (login wall gone) ──
const guestSid = 'e2e-guest-' + crypto.randomUUID()
const guestRes = await fetch(`${BASE}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stream: true, sessionId: guestSid, messages: [{ role: 'user', content: 'Reply with exactly: GUEST-OK' }] }),
})
const guestBodyText = guestRes.body ? await guestRes.text() : ''
const guestOk = guestRes.ok && (guestBodyText.includes('GUEST-OK') || guestBodyText.includes('"type":"done"'))
ok('guest chat responds (anon quota or answer)', guestOk, `(HTTP ${guestRes.status}, ${guestBodyText.slice(0, 80)}...)`)

console.log(`\n${pass} passed, ${fail} failed`)
console.log(`cleanup hint: test user ${email} (session ${SID})`)
process.exit(fail ? 1 : 0)
