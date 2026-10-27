#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v528_prod_e2e.mjs — REAL production E2E for v5.28:
//   1. create a test user (Supabase admin API) + sign in
//   2. fetch the REAL GitHub tarball of a tiny repo (Hello-World)
//      → gunzip → parseTar (the exact lib used by sandbox_git)
//   3. replay the handler's write path through the DEPLOYED /api/vfs
//      route (isBase64 writes, clone-shaped paths, storage spill)
//   4. list (clone tree visible) → download binary → delete → cleanup
//   5. anon 401 wall on /api/vfs (the TerminalWorkspace sign-in boundary)
//   6. /chat + / load without crashing on the new deployment
// ════════════════════════════════════════════════════════════════════
const SUPA = 'https://asfzdbpfakwpiawhhrby.supabase.co'
const SR = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZnpkYnBmYWt3cGlhd2hocmJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI1OTIwMSwiZXhwIjoyMDk2ODM1MjAxfQ.SHtah2BfvJp2rtFLJ2xm7QCQrStMwthfNhPkMFNGkCM'
const BASE = process.argv[2] || 'https://e54bd366.kivora.pages.dev'

let pass = 0, fail = 0
const failures = []
const ok = (c, name) => { if (c) pass++; else { fail++; failures.push(name); console.error('  ✗', name) } }
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null), ct: r.headers.get('content-type') || '' })

// libs under test (same modules the deployed worker uses)
const { parseRepoInput, tarballUrls, parseTar, gunzip, stripCommonRoot, CLONE_UA } = await import('../lib/gitTarball.js')

// ── 1. test user ────────────────────────────────────────────────────
console.log('1. test user + sign-in')
const email = `git-e2e-${Date.now()}@kivora-test.local`
const password = 'Git-E2E-Test-2026!'
let uid = null
{
  const r = await j(await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  }))
  ok(r.status === 200 && r.body?.id, `test user created (${r.body?.id || r.body?.msg || r.status})`)
  uid = r.body?.id
}
let token = null
{
  const r = await j(await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }))
  ok(r.status === 200 && r.body?.access_token, 'signed in, access token issued')
  token = r.body?.access_token
}
const H = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }

// ── 2. real GitHub tarball → parsed entries ─────────────────────────
console.log('2. real GitHub tarball → parseTar')
let entries = null
{
  const info = parseRepoInput('https://github.com/octocat/Hello-World')
  ok(info.ok && info.repo === 'Hello-World', 'repo parsed')
  let res = null, last = 0
  for (const u of tarballUrls(info, 'master')) {
    const r = await fetch(u, { headers: { 'user-agent': CLONE_UA } })
    if (r.ok && r.body) { res = r; break }
    last = r.status
    try { await r.body?.cancel() } catch {}
  }
  ok(!!res, `codeload tarball fetched (last ${last})`)
  if (res) {
    const bytes = await gunzip(res.body)
    const parsed = parseTar(bytes)
    const stripped = stripCommonRoot(parsed.files)
    entries = stripped.files
    ok(entries.length > 0, `parsed ${entries.length} file(s), root stripped`)
  }
}

// ── 3. replay the clone write path through the DEPLOYED route ───────
console.log('3. clone-shaped writes → deployed /api/vfs (workspace "clones")')
{
  ok((await j(await fetch(`${BASE}/api/vfs`, { headers: H }))).status === 200, 'pre-clone: workspace reachable')
  let written = 0
  let spilled = 0
  const saved = []
  for (const e of (entries || [])) {
    const b64 = Buffer.from(e.bytes).toString('base64')
    const r = await j(await fetch(`${BASE}/api/vfs`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ path: `hello-world/${e.path}`, content: b64, workspace: 'clones', isBase64: true }),
    }))
    if (r.status === 200 && r.body?.ok) {
      written++
      if (r.body.stored_in === 'storage') spilled++
      saved.push(r.body.path)
    } else {
      console.error('  write failed:', e.path, r.status, JSON.stringify(r.body).slice(0, 120))
    }
  }
  ok(written === (entries || []).length && written > 0, `all ${written}/${entries?.length} clone files written via deployed route`)
  console.log(`  (${spilled} file(s) spilled to storage bucket)`)
  ok(written > 0 && saved.every((p) => p.startsWith('hello-world/')), 'clone dir prefix kept')
}

// ── 4. list → download → delete ─────────────────────────────────────
console.log('4. list / download / delete')
{
  const r = await j(await fetch(`${BASE}/api/vfs?workspace=clones`, { headers: H }))
  ok(r.status === 200 && r.body?.ok && r.body.files?.length === entries?.length, `list shows the full clone tree (${r.body?.files?.length})`)
  const target = r.body?.files?.find((f) => /readme/i.test(f.path)) || r.body?.files?.[0]
  ok(!!target, `target file present (${target?.path})`)
  if (target) {
    const d = await fetch(`${BASE}/api/vfs?download=1&workspace=clones&path=${encodeURIComponent(target.path)}`, { headers: H })
    const buf = Buffer.from(await d.arrayBuffer())
    ok(d.status === 200 && buf.length === target.size, `download byte-exact (${buf.length}B, ct=${d.headers.get('content-type')})`)
    const src = entries.find((e) => `hello-world/${e.path}` === target.path)
    if (src) ok(buf.equals(Buffer.from(src.bytes)), 'downloaded bytes identical to tarball entry')
    const del = await j(await fetch(`${BASE}/api/vfs?workspace=clones&path=${encodeURIComponent(target.path)}`, { method: 'DELETE', headers: H }))
    ok(del.status === 200 && del.body?.ok, 'delete ok')
    const again = await fetch(`${BASE}/api/vfs?workspace=clones&path=${encodeURIComponent(target.path)}`, { headers: H })
    ok(again.status === 404, 'deleted file reads 404')
  }
}

// ── 5. anon wall ────────────────────────────────────────────────────
console.log('5. anon boundary')
{
  const r = await j(await fetch(`${BASE}/api/vfs`))
  ok(r.status === 401 && r.body?.error === 'unauthenticated', 'anon /api/vfs → 401 unauthenticated (TerminalWorkspace shows sign-in strip)')
}

// ── 6. pages load ───────────────────────────────────────────────────
console.log('6. deployed pages healthy')
{
  const chat = await fetch(`${BASE}/chat`, { headers: { 'user-agent': 'Mozilla/5.0' } })
  const html = await chat.text()
  ok(chat.status === 200, `/chat 200 (${chat.status})`)
  ok(!html.includes('application error') && !html.toLowerCase().includes('unhandled'), 'no crash markers in chat HTML')
  ok(html.includes('__KIVORA_ENV__') && !html.includes('__KIVORA_ENV__":{}') && !html.includes('__KIVORA_ENV__": {}'), 'env bootstrap non-empty (v5.27 fix intact)')
  const home = await fetch(`${BASE}/`, { headers: { 'user-agent': 'Mozilla/5.0' } })
  ok(home.status === 200, `home 200 (${home.status})`)
}

// ── cleanup: remove user (cascades files) ───────────────────────────
console.log('cleanup')
{
  const r = await j(await fetch(`${SUPA}/auth/v1/admin/users/${uid}`, {
    method: 'DELETE',
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  }))
  ok(r.status === 200 || r.status === 204, 'test user deleted (no trace)')
}

console.log(`\n══════════ v5.28 PROD E2E: ${pass} passed, ${fail} failed ══════════`)
if (fail) { console.error('FAILED:', failures.join(' | ')); process.exit(1) }
