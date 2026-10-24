// v5.24.3 — disconnect deadline guard smoke tests (node scripts/test_disconnect_guard.mjs)
// Covers: armDisconnectGuard timing + idempotence + error containment, and the
// guard × createGenRecorder interplay (partial finish → late full finish upgrade).
import { createGenRecorder, armDisconnectGuard } from '../lib/genBuffer.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}`) }
}

// Fake Supabase admin: chainable .from().upsert/.select().single/.delete
function fakeAdmin() {
  const upserts = []
  const mk = () => {
    const q = {
      upsert: (row, opts) => { upserts.push({ row, opts }); return Promise.resolve({ error: null }) },
      select: () => ({ ...q, single: () => Promise.resolve({ data: { messages: [{ role: 'user', content: 'hi' }] }, error: null }) }),
      eq: () => q,
      delete: () => Promise.resolve({ error: null }),
      lt: () => ({ ...q, then: (res) => Promise.resolve({ error: null }).then(res) }),
    }
    return q
  }
  return { upserts, from: () => mk() }
}

async function t1_noDisconnect_neverFires() {
  let fired = 0
  const g = armDisconnectGuard({ conn: { closed: false }, delayMs: 250, pollMs: 50, onDeadline: () => { fired++ } })
  await sleep(450)
  g.dispose()
  check('t1 no disconnect → no fire', fired === 0)
}

async function t2_disconnect_firesOnce() {
  let fired = 0
  const conn = { closed: false }
  const g = armDisconnectGuard({ conn, delayMs: 300, pollMs: 50, onDeadline: () => { fired++ } })
  setTimeout(() => { conn.closed = true }, 100)
  await sleep(600)
  check('t2 disconnect → fires', fired === 1)
  check('t2 fires exactly once', fired === 1)
}

async function t3_isFinished_blocks() {
  let fired = 0
  const conn = { closed: false }
  const g = armDisconnectGuard({ conn, delayMs: 300, pollMs: 50, isFinished: () => true, onDeadline: () => { fired++ } })
  setTimeout(() => { conn.closed = true }, 100)
  await sleep(600)
  check('t3 finished generation → guard no-op', fired === 0)
}

async function t4_dispose_blocks() {
  let fired = 0
  const conn = { closed: false }
  const g = armDisconnectGuard({ conn, delayMs: 300, pollMs: 50, onDeadline: () => { fired++ } })
  setTimeout(() => { conn.closed = true; g.dispose() }, 100)
  await sleep(600)
  check('t4 dispose after disconnect → no fire', fired === 0)
}

async function t5_throwingOnDeadline_contained() {
  const conn = { closed: false }
  const g = armDisconnectGuard({ conn, delayMs: 250, pollMs: 50, onDeadline: () => { throw new Error('boom') } })
  setTimeout(() => { conn.closed = true }, 80)
  await sleep(500)
  g.dispose()
  check('t5 throwing onDeadline contained (no crash)', true)
}

async function t6_guardXRecorder_partialThenUpgrade() {
  const admin = fakeAdmin()
  const rec = createGenRecorder(admin, 'sess-1', 'user-1')
  const conn = { closed: false }
  let finalized = 0
  const g = armDisconnectGuard({
    conn, delayMs: 300, pollMs: 50,
    isFinished: () => { try { return !!rec.snapshot().done } catch { return true } },
    onDeadline: async () => {
      finalized++
      const raw = rec.snapshot().content
      // route-side shape: polish would happen here; just verify the buffer feed
      await rec.finish({ reply: raw.replace(/\s+$/, '') + ' …(partial)', interrupted: true })
    },
  })
  // simulate streaming: partial code block (unclosed fence) then disconnect
  rec.observe({ type: 'delta', v: 'Here is the artifact:\n\n```html\n<div>(₦50' })
  setTimeout(() => { conn.closed = true }, 100)
  await sleep(550) // guard deadline (~450ms) fires FIRST → partial finalize
  await rec.finish({ reply: 'FULL REPLY', model: 'test', searchUsed: false }) // late normal done (upgrade)
  await sleep(100)
  g.dispose()
  const snap = rec.snapshot()
  check('t6 guard fired on disconnected gen', finalized === 1)
  check('t6 buffer content accumulated', snap.content.includes('(₦50'))
  check('t6 done landed', snap.done === true)
  check('t6 full reply overwrote partial meta (upgrade)', snap.meta && snap.meta.reply === 'FULL REPLY')
  check('t6 meta not the partial', !(snap.meta && snap.meta.interrupted))
  check('t6 writes hit the buffer table', admin.upserts.length >= 2)
  check('t6 final write carries done=true', admin.upserts[admin.upserts.length - 1].row.done === true)
}

async function t7_emptyContent_failPath() {
  const admin = fakeAdmin()
  const rec = createGenRecorder(admin, 'sess-2', 'user-1')
  const conn = { closed: false }
  let errPath = 0
  const g = armDisconnectGuard({
    conn, delayMs: 250, pollMs: 50,
    isFinished: () => rec.snapshot().done,
    onDeadline: async () => {
      const raw = rec.snapshot().content
      if (!raw.trim()) { errPath++; await rec.fail({ error: 'interrupted before content' }) }
    },
  })
  setTimeout(() => { conn.closed = true }, 80)
  await sleep(500)
  g.dispose()
  const snap = rec.snapshot()
  check('t7 empty content → fail path taken', errPath === 1)
  check('t7 fail lands done=true with error', snap.done === true && !!snap.error)
}

const results = await Promise.all([
  t1(), t2(), t3(), t4(), t5(), t6(), t7(),
]).then(() => true).catch((e) => { console.error('suite crash:', e); return false })

async function t1() { return t1_noDisconnect_neverFires() }
async function t2() { return t2_disconnect_firesOnce() }
async function t3() { return t3_isFinished_blocks() }
async function t4() { return t4_dispose_blocks() }
async function t5() { return t5_throwingOnDeadline_contained() }
async function t6() { return t6_guardXRecorder_partialThenUpgrade() }
async function t7() { return t7_emptyContent_failPath() }

console.log(`\n${pass} passed, ${fail} failed, suite=${results ? 'ok' : 'crashed'}`)
process.exit(fail > 0 || !results ? 1 : 0)
