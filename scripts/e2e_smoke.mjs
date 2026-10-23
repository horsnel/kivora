#!/usr/bin/env node
// v5.22 E2E smoke — the resumable-streaming chain against PRODUCTION, on the
// GUEST path (no account needed — which is itself the v5.22 headline fix):
//   stream request (anon) → abort mid-generation → poll resume probe →
//   resume with offset → assert the reply assembled byte-complete.
// The authed chain is attempted opportunistically: Supabase signup is often
// rate-limited (429, confirmation emails) so a skip is reported, not a fail.
// Usage: node scripts/e2e_smoke.mjs [baseURL]   (default https://kivora.pages.dev)
import crypto from 'crypto'

const BASE = (process.argv[2] || 'https://kivora.pages.dev').replace(/\/$/, '')
let pass = 0, fail = 0, skipped = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ FAIL ${name} ${extra}`) }
}
const skip = (name, why) => { skipped++; console.log(`  ⊘ SKIP ${name} — ${why}`) }

const SID = 'e2e-' + crypto.randomUUID()

console.log(`E2E smoke vs ${BASE}`)
console.log(`guest session: ${SID}`)

// ── 0. homepage bootstraps the supabase config (sanity) ──
const html = await (await fetch(BASE + '/')).text()
const cfgMatch = html.match(/window\.__KIVORA_ENV__=(\{.*?\})</)
ok('homepage serves env bootstrap', !!cfgMatch)
const cfg = cfgMatch ? JSON.parse(cfgMatch[1]) : { url: '', key: '' }

// ── 1. GUEST chain: stream + cut mid-generation ──
const ctrl = new AbortController()
let receivedBeforeCut = ''
let cutAt = 0
const chatStart = Date.now()
const res = await fetch(`${BASE}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stream: true,
    sessionId: SID,
    messages: [{ role: 'user', content: 'Write a 120-word story about a lighthouse keeper. Number nothing. Just prose.' }],
  }),
  signal: ctrl.signal,
})
ok('guest chat stream opened (login wall gone)', res.ok, `(HTTP ${res.status})`)

if (res.ok && res.body) {
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx); buf = buf.slice(idx + 2)
        const m = frame.match(/^data: (.+)$/m)
        if (!m) continue
        try {
          const evt = JSON.parse(m[1])
          if (evt.type === 'delta' && typeof evt.v === 'string') {
            receivedBeforeCut += evt.v
            if (receivedBeforeCut.length > 60 && !cutAt) { cutAt = receivedBeforeCut.length; ctrl.abort() }
          }
          if (evt.type === 'error') { console.log('  (in-band error:', String(evt.error || '').slice(0, 90) + ')') }
        } catch {}
      }
      if (cutAt) break
    }
  } catch (e) {
    if (String(e?.name) !== 'AbortError') console.log('  (stream ended:', String(e?.message || e).slice(0, 80) + ')')
  }
}
ok('deltas received before cut', receivedBeforeCut.length > 20, `(got ${receivedBeforeCut.length} chars)`)
if (cutAt) console.log(`  cut after ${cutAt} chars / ${((Date.now() - chatStart) / 1000) | 0}s`)

// ── 2. generation completes server-side after disconnect (waitUntil) ──
let probe = null
for (let i = 0; i < 45; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const r = await fetch(`${BASE}/api/chat/resume?sid=${encodeURIComponent(SID)}&probe=1`)
  const j = await r.json().catch(() => ({}))
  if (j.status === 'done' || j.status === 'error') { probe = j; break }
  probe = j
}
ok('generation completed server-side after disconnect', probe?.status === 'done', JSON.stringify(probe).slice(0, 140))
ok('buffer holds a substantial reply', (probe?.length || 0) > 100, `length=${probe?.length}`)

// ── 3. resume from the cut offset — server returns ONLY the remainder ──
if (probe?.status === 'done' && cutAt > 0) {
  const rj = await (await fetch(`${BASE}/api/chat/resume?sid=${encodeURIComponent(SID)}&offset=${cutAt}`)).json().catch(() => ({}))
  ok('resume answered done', rj.status === 'done', JSON.stringify(rj).slice(0, 140))
  const reassembled = receivedBeforeCut.slice(0, cutAt) + (rj.content || '')
  ok('reassembled length matches buffer', Math.abs(reassembled.length - (probe.length || 0)) <= 2,
    `reassembled=${reassembled.length} buffer=${probe.length}`)
} else {
  skip('resume offset check', cutAt === 0 ? 'no deltas before cut' : 'probe not done')
}

// ── 4. authed chain — opportunistic (rate limits make it flaky) ──
if (cfg.url && cfg.key) {
  const email = `e2e.smoke.${Date.now()}@outlook.com`
  const password = 'E2e-' + crypto.randomUUID().slice(0, 16) + 'aA1!'
  const r = await fetch(`${cfg.url}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json().catch(() => ({}))
  if (r.ok && j.access_token) {
    ok('test account created', true)
    // authed chat round-trip
    const authSid = 'e2e-auth-' + crypto.randomUUID()
    const ar = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${j.access_token}` },
      body: JSON.stringify({ stream: false, sessionId: authSid, messages: [{ role: 'user', content: 'Reply with exactly: AUTH-OK' }] }),
    })
    const at = ar.body ? await ar.text() : ''
    ok('authed chat responds', ar.ok && (at.includes('AUTH-OK') || at.includes('"type":"done"')), `(HTTP ${ar.status})`)
  } else {
    skip('authed chain', r.status === 429 ? 'signup email rate-limited (429)' : `signup returned ${r.status} ${j.msg || ''}`.slice(0, 80))
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`)
process.exit(fail ? 1 : 0)
