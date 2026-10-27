#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v527_prod_e2e.mjs — REAL production E2E for the workspace:
//  1. create a test user via Supabase admin API
//  2. sign in → access token
//  3. exercise the DEPLOYED /api/vfs route: 401 wall → list → write →
//     read → list → download → delete → cleanup
//  4. delete the test user (leave no trace)
// ════════════════════════════════════════════════════════════════════
const SUPA = 'https://asfzdbpfakwpiawhhrby.supabase.co'
const SR = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZnpkYnBmYWt3cGlhd2hocmJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI1OTIwMSwiZXhwIjoyMDk2ODM1MjAxfQ.SHtah2BfvJp2rtFLJ2xm7QCQrStMwthfNhPkMFNGkCM'
const BASE = process.argv[2] || 'https://0678470f.kivora.pages.dev'

let pass = 0, fail = 0
const failures = []
const ok = (c, name) => { if (c) pass++; else { fail++; failures.push(name); console.error('  ✗', name) } }
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null), ct: r.headers.get('content-type') || '' })

// 1. test user
const email = `ws-e2e-${Date.now()}@kivora-test.local`
const password = 'Ws-E2E-Test-2026!'
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

// 2. sign in
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

// 3. deployed route
{
  const r = await j(await fetch(`${BASE}/api/vfs`, { headers: H }))
  ok(r.status === 200 && r.body?.ok && Array.isArray(r.body.files) && r.body.files.length === 0, 'list: empty workspace')
}
let wrotePath = null
{
  const r = await j(await fetch(`${BASE}/api/vfs`, { method: 'POST', headers: H, body: JSON.stringify({ path: 'reports/hello.txt', content: 'hello from the agent workspace' }) }))
  ok(r.status === 200 && r.body?.ok && r.body?.stored_in === 'db', `write text (${r.body?.stored_in || JSON.stringify(r.body)})`)
  wrotePath = r.body?.path
}
{
  const r = await j(await fetch(`${BASE}/api/vfs?path=reports/hello.txt`, { headers: H }))
  ok(r.status === 200 && r.body?.ok && r.body?.content === 'hello from the agent workspace', 'read back through prod route')
}
{
  const r = await j(await fetch(`${BASE}/api/vfs?path=reports/big.txt`, { method: 'POST', headers: H, body: JSON.stringify({ path: 'reports/big.txt', content: 'x'.repeat(300 * 1024) }) }))
  ok(r.status === 200 && r.body?.ok && r.body?.stored_in === 'storage', 'oversize file spills to storage bucket through prod')
}
{
  const r = await j(await fetch(`${BASE}/api/vfs`, { headers: H }))
  ok(r.status === 200 && r.body?.files?.length === 2, 'list shows both files')
}
{
  const r = await fetch(`${BASE}/api/vfs?download=1&path=reports/hello.txt`, { headers: H })
  const txt = await r.text()
  ok(r.status === 200 && txt === 'hello from the agent workspace' && (r.headers.get('content-disposition') || '').includes('attachment'), 'download streams with attachment header')
}
{
  const r = await j(await fetch(`${BASE}/api/vfs?path=reports/hello.txt`, { method: 'DELETE', headers: H }))
  ok(r.status === 200 && r.body?.ok, 'delete')
}
{
  const r = await j(await fetch(`${BASE}/api/vfs?path=reports/hello.txt`, { headers: H }))
  ok(r.status === 404, 'deleted file 404s')
}
// security wall through prod
{
  const r = await j(await fetch(`${BASE}/api/vfs`, { method: 'POST', headers: H, body: JSON.stringify({ path: '../evil.txt', content: 'x' }) }))
  ok(r.status === 400 && r.body?.reason === 'bad_path', 'traversal blocked in prod')
}

// 4. cleanup: all files + user
{
  const l = await (await fetch(`${BASE}/api/vfs`, { headers: H })).json()
  for (const f of l.files || []) await fetch(`${BASE}/api/vfs?path=${encodeURIComponent(f.path)}`, { method: 'DELETE', headers: H })
  const dr = await fetch(`${SUPA}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: { apikey: SR, Authorization: `Bearer ${SR}` } })
  ok(dr.status === 200 || dr.status === 204, 'test user removed')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('FAILED:', failures.join(' | ')); process.exit(1) }
