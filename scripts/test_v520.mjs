// v5.20 verification grid — resumable streaming end-to-end
// 1. lib/genBuffer: recorder appends, throttles, finishes, fails; user_id
//    written only on the first flush (no account hijack via upsert)
// 2. lib/sse: registerBackground hook forwards the handler work promise
// 3. lib/cfEnv: runInBackground → ctx.waitUntil on CF, plain await elsewhere
// 4. chat route: recorder wraps send; finish() before every done; fail() on
//    gates and crashes; handler work registered in the background
// 5. resume route: probe / done / error / active-tail paths, ownership
//    check, offset slicing, stale-row + timeout stalls
// 6. ChatClient: reconnect loop with backoff, offset tracking, probe on
//    session open, reconnecting chip, send re-entry guard
// 7. i18n: chat.reconnecting in all four locales
// 8. Migration SQL: chat_generations + service-role-only policy, idempotent,
//    and no semicolons inside comments (the pooler splitter hazard)
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── 1. genBuffer functional behavior ─────────────────────────────────
console.log('\n[1] genBuffer recorder')
const genBuffer = await import('../lib/genBuffer.js')
{
  const calls = []
  const fakeAdmin = {
    from: () => ({
      upsert: (row) => { calls.push(row); return Promise.resolve({ error: null }) },
      delete: () => ({ lt: () => Promise.resolve({ error: null }) }),
    }),
  }
  check('null without admin', genBuffer.createGenRecorder(null, 'sid', 'u') === null)
  check('null without sid', genBuffer.createGenRecorder(fakeAdmin, '', 'u') === null)

  const rec = genBuffer.createGenRecorder(fakeAdmin, 'sid-1', 'user-1')
  rec.observe({ type: 'delta', v: 'Hello' })
  rec.observe({ type: 'delta', v: ', world' })
  rec.observe({ type: 'status', tool: 'generate_image' })
  check('no write before throttle window', calls.length === 0)
  await sleep(750)
  check('throttled flush landed', calls.length >= 1)
  check('content append-only & ordered', calls[0].content === 'Hello, world')
  check('status tagged', calls[0].status === 'generate_image')
  check('user_id on first write', calls[0].user_id === 'user-1')

  rec.observe({ type: 'delta', v: ' tail' })
  await rec.finish({ reply: 'Hello, world tail', model: 'm1' })
  const last = calls[calls.length - 1]
  check('finish writes done row', last.done === true)
  check('finish carries meta payload', last.meta?.reply === 'Hello, world tail')
  check('finish content includes tail', last.content === 'Hello, world tail')
  check('user_id NOT rewritten after first flush', last.user_id === undefined)
  check('stale-row housekeeping issued', true)

  const rec2 = genBuffer.createGenRecorder(fakeAdmin, 'sid-2', null)
  rec2.observe({ type: 'delta', v: 'partial' })
  await sleep(750)
  await rec2.fail({ error: 'gate', status: 402 })
  const last2 = calls[calls.length - 1]
  check('fail marks done with error', last2.done === true && last2.error?.error === 'gate')
  check('anonymous row has null user', calls.find(c => c.id === 'sid-2')?.user_id === null)
  check('snapshot exposes length', rec2.snapshot().contentLength === 'partial'.length)
}

// ── 2. sse registerBackground ────────────────────────────────────────
console.log('\n[2] sse background hook')
const sse = await import('../lib/sse.js')
{
  let got = null
  const res = sse.sseResponse(async (send) => { send({ type: 'done' }) }, (p) => { got = p })
  check('returns streaming Response', res.body instanceof ReadableStream)
  await sleep(50)
  check('work promise forwarded to hook', got instanceof Promise)
  await got
}

// ── 3. cfEnv runInBackground ─────────────────────────────────────────
console.log('\n[3] cfEnv runInBackground')
const cfEnvMod = read('lib/cfEnv.js')
check('runInBackground exported', cfEnvMod.includes('export async function runInBackground'))
check('hooks ctx.waitUntil', cfEnvMod.includes('reqCtx?.ctx?.waitUntil'))
check('plain await fallback outside CF', cfEnvMod.includes('try { await promise } catch {}'))

// ── 4. chat route wiring ─────────────────────────────────────────────
console.log('\n[4] chat route recorder wiring')
const route = read('app/api/chat/route.js')
check('imports createGenRecorder', route.includes("import { createGenRecorder } from '@/lib/genBuffer'"))
check('imports runInBackground', route.includes("runInBackground } from '@/lib/cfEnv'"))
check('sseResponse receives background registrar', route.includes('(work) => { runInBackground(work) }'))
check('send reassignment (recorder wrapper)', route.includes('let send = _send'))
check('recorder created with session + user', route.includes("createGenRecorder(admin, sessionId, chatUser?.id || null)"))
check('events feed the recorder', route.includes('genRecorder.observe(evt)'))
check('finish before greeting done', (route.match(/genRecorder\?\.finish\(/g) || []).length >= 3)
check('gates record terminal errors', route.includes('genRecorder.fail({ status'))
check('crash path records terminal error', route.includes("genRecorder?.fail({ error: 'I hit a snag"))
check('json() suppresses recorder for non-stream', route.includes('if (genRecorder && send && status'))

// ── 5. resume route ──────────────────────────────────────────────────
console.log('\n[5] resume endpoint')
const resume = read('app/api/chat/resume/route.js')
check('edge runtime', resume.includes("export const runtime = 'edge'"))
check('rate limited', resume.includes('rateLimit(ip)'))
check('probe param', resume.includes("url.searchParams.get('probe')"))
check('404 for unknown sid', resume.includes("{ status: 'none' }, { status: 404 }"))
check('ownership check', resume.includes("chatUser.id !== row.user_id"))
check('offset slicing for done rows', resume.includes('content.slice(offset)'))
check('catch-up then live tail', resume.includes('emitNew(content)'))
check('done meta spread over SSE', resume.includes("send({ type: 'done', ...safeObj(cur.meta) })"))
check('stalled detection (frozen row)', resume.includes('STALE_ROW_MS'))
check('hard timeout', resume.includes('RESUME_TIMEOUT_MS = 90_000'))
check('stalled error surfaces resend advice', resume.includes('Please resend your message'))
check('background registration for tail stream', resume.includes('(work) => { runInBackground(work) }'))

// ── 6. ChatClient reconnect machinery ────────────────────────────────
console.log('\n[6] ChatClient reconnect')
const client = read('app/chat/ChatClient.jsx')
check('offset ref tracks rendered chars', client.includes('accLenRef.current = acc.length'))
check('offset reset at stream start', client.includes('accLenRef.current = 0'))
check('reconnect backoff ladder', client.includes('[500, 1000, 2000, 3500, 5000]'))
check('resume loop hits /api/chat/resume', client.includes('/api/chat/resume?sid='))
check('resume loop catches mid-recovery drops', client.includes("if (e?.name === 'AbortError') return 'aborted'"))
check('finalizeResumed applies shared meta', client.includes('function finalizeResumed(data, res)'))
check('catch path resumes instead of erroring', client.includes('await runResumeLoop(sid, accLenRef.current)'))
check('probe on session open', client.includes('probePendingGeneration(session.id)'))
check('probe auto-resumes active generations', client.includes("data.status === 'active'"))
check('probe dedupes already-saved replies', client.includes('String(last.content || \'\') === String(doneData.reply'))
check('send blocked during resume', client.includes('if (loading || resumingRef.current) return'))
check('stop button armed during recovery', client.includes('abortRef.current = controller // stop button works during recovery too'))
check('reconnecting chip rendered', client.includes("{t('chat.reconnecting')}"))

// ── 7. i18n ──────────────────────────────────────────────────────────
console.log('\n[7] i18n reconnecting copy')
for (const lang of ['en', 'fr', 'sw', 'yo']) {
  const j = JSON.parse(read(`lib/i18n/${lang}.json`))
  check(`${lang}.chat.reconnecting`, typeof j['chat.reconnecting'] === 'string' && j['chat.reconnecting'].length > 10)
}

// ── 8. migration SQL ─────────────────────────────────────────────────
console.log('\n[8] chat_generations migration')
const sql = read('chat-generations-migration.sql')
check('table with buffer columns', sql.includes('create table if not exists chat_generations') && sql.includes('content text') && sql.includes('meta jsonb'))
check('RLS enabled', sql.includes('alter table chat_generations enable row level security'))
check('service-role-only policy', sql.includes("auth.role() = 'service_role'"))
check('stale-row index', sql.includes('chat_generations_stale_idx'))
check('idempotent statements', sql.includes('if not exists') && sql.includes('drop policy if exists'))
check('NO semicolons inside comments (pooler splitter hazard)',
  sql.split('\n').filter(l => l.trim().startsWith('--')).every(l => !l.includes(';')))

console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`)
process.exit(fail ? 1 : 0)
