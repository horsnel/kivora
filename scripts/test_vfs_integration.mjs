#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_vfs_integration.mjs — REAL round-trip against Supabase:
// pure helpers + DB write/read/list/delete + storage upload/download.
// Uses the service-role key directly (server-side equivalence).
// ════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import {
  normalizePath, normalizeWorkspace, mimeFor, isTextMime, formatBytes,
  buildWorkspaceScript, parseCapturedOutput,
  vfsWrite, vfsRead, vfsList, vfsDelete, VFS_LIMITS,
} from '../lib/vfs.js'

let pass = 0, fail = 0
const failures = []
const ok = (c, name) => { if (c) pass++; else { fail++; failures.push(name); console.error('  ✗', name) } }

// ── 1. pure helpers ──
console.log('── pure helpers ──')
ok(normalizePath('src/main.py').path === 'src/main.py', 'plain path kept')
ok(normalizePath('/abs/path.txt').path === 'abs/path.txt', 'leading slash stripped')
ok(!normalizePath('../../etc/passwd').ok, 'traversal rejected')
ok(!normalizePath('a//b').ok, 'empty segment rejected')
ok(!normalizePath("bad'name").ok, 'quote rejected (bash-safe charset)')
ok(!normalizePath('a/$HOME').ok, 'dollar rejected')
ok(normalizePath('my file v2.txt').ok, 'spaces allowed')
ok(normalizePath('d/'.concat('x/'.repeat(12), 'f')).ok === false, 'depth cap')
ok(normalizeWorkspace('default') === 'default', 'workspace default')
ok(normalizeWorkspace('../evil') === null, 'workspace traversal rejected')
ok(mimeFor('a.csv') === 'text/csv', 'csv mime')
ok(mimeFor('photo.PNG') === 'image/png', 'png mime case-insensitive')
ok(isTextMime('text/csv') && !isTextMime('image/png'), 'text mime classification')
ok(formatBytes(2048) === '2.0 KB', 'formatBytes')

// exec wrapper
const script = buildWorkspaceScript('python main.py', [{ path: 'main.py', b64: 'cHJpbnQoJ2hpJyk=' }])
ok(script.includes("printf '%s' 'cHJpbnQoJ2hpJyk=' | base64 -d > 'main.py'"), 'staging heredoc-free base64 write')
ok(script.includes('touch .kv_mark'), 'marker after staging')
ok(script.includes('python main.py'), 'user command present')
ok(script.includes('-newer .kv_mark'), 'capture only new files')
ok(script.includes('__KV_RC__'), 'exit code marker')
ok(!buildWorkspaceScript('echo hi', [{ path: '../evil', b64: 'x' }]).includes("'../evil'"), 'bad paths skipped in staging')

// capture parser
const sample = ['hello world', '__KV_FILE__ out.csv', 'aGVsbG8=', '__KV_END__', '__KV_FILE__ bin.dat', 'AAEC', '__KV_END__', 'line after', '__KV_RC__ 0', ''].join('\n')
const parsed = parseCapturedOutput(sample)
ok(parsed.output === 'hello world\nline after', 'markers stripped from visible output: ' + JSON.stringify(parsed.output))
ok(parsed.files.length === 2 && parsed.files[0].path === 'out.csv' && parsed.files[0].b64 === 'aGVsbG8=', 'text file captured')
ok(parsed.files[1].b64 === 'AAEC', 'binary file captured')
ok(parsed.exitCode === 0, 'exit code extracted')
const plain = parseCapturedOutput('just output\nexit 2\n')
ok(plain.output === 'just output\nexit 2' && plain.files.length === 0 && plain.exitCode === null, 'plain passthrough untouched')

// ── 2. real Supabase round-trip ──
console.log('── supabase integration ──')
const admin = createClient('https://asfzdbpfakwpiawhhrby.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZnpkYnBmYWt3cGlhd2hocmJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI1OTIwMSwiZXhwIjoyMDk2ODM1MjAxfQ.SHtah2BfvJp2rtFLJ2xm7QCQrStMwthfNhPkMFNGkCM')
// deterministic test user (no FK on user_id — any uuid)
const UID = '11111111-1111-4111-8111-111111111111'
const WS = 'default'
const cleanup = async () => {
  const l = await vfsList(admin, UID, WS)
  for (const f of l.files || []) await vfsDelete(admin, UID, WS, f.path)
}
await cleanup()

let r = await vfsWrite(admin, UID, WS, 'src/main.py', "print('hello workspace')\n")
ok(r.ok, `write text to db (${r.detail || r.reason})`)
ok(r.stored_in === 'db', 'small text stored in db')

r = await vfsWrite(admin, UID, WS, 'data.csv', 'a,b\n' + '1,2\n'.repeat(20000)) // ~80KB → still db
ok(r.ok && r.stored_in === 'db', '80KB text in db')
r = await vfsWrite(admin, UID, WS, 'big.txt', 'x'.repeat(VFS_LIMITS.MAX_TEXT_DB + 1024))
ok(r.ok && r.stored_in === 'storage', 'oversize text spills to storage bucket')
r = await vfsWrite(admin, UID, WS, 'img.bin', 'AAECAwQFBgcICQ==', { mime: 'application/octet-stream', isBase64: true })
ok(r.ok && r.stored_in === 'storage', 'binary base64 → storage')

r = await vfsRead(admin, UID, WS, 'src/main.py')
ok(r.ok && r.content.includes('hello workspace'), 'read back from db')
r = await vfsRead(admin, UID, WS, 'big.txt')
ok(r.ok && r.content.length === VFS_LIMITS.MAX_TEXT_DB + 1024, 'read back from storage (text)')
r = await vfsRead(admin, UID, WS, 'img.bin')
ok(r.ok && r.isBase64 && r.content === 'AAECAwQFBgcICQ==', 'binary read back as base64')
r = await vfsRead(admin, UID, WS, 'nope.txt')
ok(!r.ok && r.reason === 'not_found', 'missing file → not_found')

r = await vfsList(admin, UID, WS)
ok(r.ok && r.files.length === 4, `list shows 4 files (got ${r.files?.length})`)
ok(r.files.some((f) => f.path === 'src/main.py'), 'nested path listed')
const sub = await vfsList(admin, UID, WS, 'src')
ok(sub.ok && sub.files.length === 1 && sub.files[0].path === 'src/main.py', 'prefix filter')

// upsert overwrite
await vfsWrite(admin, UID, WS, 'src/main.py', "print('v2')")
r = await vfsRead(admin, UID, WS, 'src/main.py')
ok(r.content.includes('v2'), 'upsert overwrites')

// security walls through the full stack
r = await vfsWrite(admin, UID, WS, '../escape.txt', 'x')
ok(!r.ok && r.reason === 'bad_path', 'traversal blocked end-to-end')
r = await vfsWrite(admin, UID, 'ws/../x', 'y')
ok(!r.ok && r.reason === 'bad_workspace', 'bad workspace blocked')

// quota check fires (chainable mock admin that reports MAX_FILES rows)
const chainable = {
  select: () => chainable, eq: () => chainable, like: () => chainable,
  limit: () => chainable, order: () => chainable, single: () => Promise.resolve({ data: null, error: null }),
  maybeSingle: () => Promise.resolve({ data: null, error: null }),
  delete: () => Promise.resolve({ error: null }),
  then: (res) => Promise.resolve({ error: null, count: VFS_LIMITS.MAX_FILES }).then(res),
}
const fakeAdmin = { from: () => chainable, storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), remove: () => Promise.resolve({ error: null }) }) } }
r = await vfsWrite(fakeAdmin, UID, WS, 'one_more.txt', 'x')
ok(!r.ok && r.reason === 'quota', 'quota blocks new file at cap')

// cleanup real rows
await cleanup()
r = await vfsList(admin, UID, WS)
ok(r.ok && r.files.length === 0, 'cleanup leaves workspace empty')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('FAILED:', failures.join(' | ')); process.exit(1) }
