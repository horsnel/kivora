// v5.23 — unit test for lib/sseClient.js createDeltaFlusher
// Verifies the coalescing contract every streaming surface now relies on:
//   1. N rapid pushes produce ONE onFlush call after ~intervalMs
//   2. flushNow() lands a pending flush immediately (trailing-tail guarantee)
//   3. flushNow() with nothing pending is a no-op (no spurious renders)
//   4. pushes after a flush start a fresh cycle (no starvation)
//   5. onFlush exceptions don't break subsequent cycles
import { createDeltaFlusher } from '../lib/sseClient.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── 1. coalescing ────────────────────────────────────────────────
{
  let flushes = 0
  const f = createDeltaFlusher(() => { flushes++ }, 30)
  for (let i = 0; i < 100; i++) f.push()
  check('100 rapid pushes schedule exactly one flush', flushes === 0)
  await sleep(60)
  check('single flush fired after interval', flushes === 1)
}

// ── 2. trailing flushNow lands pending work ──────────────────────
{
  let flushes = 0
  const f = createDeltaFlusher(() => { flushes++ }, 30)
  f.push()
  f.push()
  f.flushNow()
  check('flushNow lands pending flush immediately', flushes === 1)
  await sleep(60)
  check('timer did not double-fire after flushNow', flushes === 1)
}

// ── 3. flushNow with nothing pending is a no-op ──────────────────
{
  let flushes = 0
  const f = createDeltaFlusher(() => { flushes++ }, 30)
  f.flushNow()
  f.flushNow()
  check('flushNow without pending work never fires', flushes === 0)
}

// ── 4. subsequent cycles work (no starvation) ────────────────────
{
  let flushes = 0
  const f = createDeltaFlusher(() => { flushes++ }, 20)
  f.push(); await sleep(50)
  f.push(); await sleep(50)
  f.push(); await sleep(50)
  check('three spaced pushes → three flushes', flushes === 3)
}

// ── 5. onFlush exception isolation ───────────────────────────────
{
  let calls = 0
  const f = createDeltaFlusher(() => { calls++; throw new Error('render blowup') }, 20)
  f.push()
  await sleep(50)
  f.push()
  f.flushNow()
  check('throwing onFlush still consumes the pending flag', calls === 2)
}

// ── 6. realistic burst pattern (provider stream) ─────────────────
// Simulates a fast provider: ~40 events over 400ms → expect ≤ ~15 flushes
// (33Hz cap) instead of 40 per-token renders.
{
  let flushes = 0
  const f = createDeltaFlusher(() => { flushes++ }, 30)
  const start = Date.now()
  while (Date.now() - start < 400) { f.push(); await sleep(10) }
  await sleep(60)
  f.flushNow()
  check(`40 events over 400ms coalesce to ≤ 18 flushes (got ${flushes})`, flushes > 0 && flushes <= 18)
}

console.log(`\n${fail === 0 ? 'ALL GREEN' : 'FAILURES'}: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
