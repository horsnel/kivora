// ── Fast code execution — Wandbox first, Judge0 fallback ────────────
// v5.17 — production diagnosis 2026-10-23: the default public Judge0
// (ce.judge0.com) answers a trivial print() in 25-30s (degraded queue).
// Users read that stall as "connection to the terminal is failing".
//
// Wandbox (wandbox.org) is keyless, free and consistently answers in
// 2-6s. It covers 9 of our 12 languages; TypeScript/Java/SQL keep using
// Judge0. If the operator configured a dedicated JUDGE0_URL (RapidAPI /
// self-hosted), that instance goes FIRST because it is fast by design.
//
// Public API (used by /api/execute and lib/toolRegistry execute_code):
//   runCodeFast(code, languageId, stdin) -> Judge0-shaped result
//     { stdout, stderr, compile_output, status:{id,description},
//       exit_code, time, memory, executor }
//     or { error } on total failure.

const WANDOX_URL = 'https://wandbox.org/api/compile.json'
const LIST_URL = 'https://wandbox.org/api/list.json'

// Judge0 language id → Wandbox compiler selector.
// Selectors resolve against the cached compiler list; each entry picks the
// newest matching compiler (version-aware, "head" builds excluded).
const JUDGE0_TO_WANDOX = {
  71: { prefix: 'cpython-', name: 'Python' },            // Python 3
  63: { prefix: 'nodejs-', name: 'JavaScript (Node)' },  // JavaScript
  54: { prefix: 'gcc-', suffix: undefined, cpp: true, name: 'C++' }, // bare gcc- = C++
  50: { prefix: 'gcc-', suffix: '-c', name: 'C' },       // gcc-N-c = C
  60: { prefix: 'go-', name: 'Go' },
  73: { prefix: 'rust-', name: 'Rust' },
  72: { prefix: 'ruby-', name: 'Ruby' },
  68: { prefix: 'php-', name: 'PHP' },
  46: { exact: 'bash', name: 'Bash' },
}

// Pinned fallbacks (used when the compiler list cannot be fetched —
// verified live 2026-10-23).
const PINNED = {
  71: 'cpython-3.14.0',
  63: 'nodejs-20.17.0',
  54: 'gcc-13.2.0',
  50: 'gcc-13.2.0-c',
  60: 'go-1.23.2',
  73: 'rust-1.82.0',
  72: 'ruby-3.4.9',
  68: 'php-8.3.12',
  46: 'bash',
}

// ── Compiler list cache (per isolate, 1h) ──
let _compilerList = null
let _compilerListAt = 0
let _compilerListPending = null

function versionKey(name) {
  const m = name.match(/(\d+(?:\.\d+)*)/)
  return m ? m[1].split('.').map(n => parseInt(n, 10)) : [0]
}

async function fetchCompilerList() {
  const now = Date.now()
  if (_compilerList && now - _compilerListAt < 60 * 60 * 1000) return _compilerList
  if (_compilerListPending) return _compilerListPending
  _compilerListPending = (async () => {
    try {
      const res = await fetch(LIST_URL, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const comps = await res.json()
        if (Array.isArray(comps) && comps.length > 0) {
          _compilerList = comps.map(c => c.name).filter(Boolean)
          _compilerListAt = Date.now()
        }
      }
    } catch { /* list unavailable — pinned names cover us */ }
    return _compilerList
  })()
  return _compilerListPending
}

async function pickCompiler(languageId) {
  const sel = JUDGE0_TO_WANDOX[languageId]
  if (!sel) return null
  if (sel.exact) return sel.exact
  const list = await fetchCompilerList()
  if (list && list.length) {
    const candidates = list.filter(n => {
      if (!n.startsWith(sel.prefix) || n.includes('head')) return false
      if (sel.suffix !== undefined) return n.endsWith(sel.suffix)
      // C++ = bare gcc-N (the '-c' suffix names C); other prefixes: any suffix ok
      if (sel.cpp) return !n.endsWith('-c')
      if (sel.prefix === 'cpython-' || sel.prefix === 'nodejs-' || sel.prefix === 'go-' || sel.prefix === 'rust-' || sel.prefix === 'ruby-' || sel.prefix === 'php-') return true
      return false
    })
    if (candidates.length) {
      candidates.sort((a, b) => {
        const ka = versionKey(a), kb = versionKey(b)
        for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
          const d = (ka[i] || 0) - (kb[i] || 0)
          if (d !== 0) return d
        }
        return 0
      })
      return candidates[candidates.length - 1]
    }
  }
  return PINNED[languageId] || null
}

// ── Wandbox execution ──
// Contract: POST { code, compiler, stdin?, save:false }
//   → { status:"0"|nonzero, signal, program_output, program_error,
//       compiler_output, compiler_error, ... }
export async function runWandbox(code, languageId, stdin = '') {
  const compiler = await pickCompiler(languageId)
  if (!compiler) return { error: `Language ${languageId} is not available on Wandbox` }
  const res = await fetch(WANDOX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, compiler, stdin, save: false }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    return { error: `Wandbox HTTP ${res.status}: ${t.slice(0, 120)}` }
  }
  const data = await res.json().catch(() => null)
  if (!data || typeof data.status === 'undefined') {
    return { error: 'Wandbox returned an unreadable response' }
  }
  const ok = String(data.status) === '0' && !data.signal
  const compileOut = [data.compiler_output, data.compiler_error].filter(Boolean).join('\n').trim()
  return {
    stdout: data.program_output || null,
    stderr: data.program_error || null,
    compile_output: compileOut || null,
    status: { id: ok ? 3 : 5, description: ok ? 'Accepted' : 'Runtime Error' },
    exit_code: ok ? 0 : 1,
    time: null,
    memory: null,
    executor: 'wandbox',
  }
}

// ── Unified fast execution ──────────────────────────────────────────
// Chain (by priority):
//   1. Dedicated Judge0 instance (JUDGE0_URL set) — fast by design → then Wandbox
//   2. Wandbox (keyless, 2-6s) for covered languages — then public Judge0
//   3. Public Judge0 alone for uncovered languages (74 ts, 62 java, 82 sql)
// runJudge0 import is injected to avoid a circular import with lib/judge0.
let _runJudge0 = null
export function setJudge0Runner(fn) { _runJudge0 = fn }
async function judge0(code, languageId, stdin) {
  if (!_runJudge0) {
    try { _runJudge0 = (await import('@/lib/judge0')).runJudge0 } catch { return { error: 'Judge0 unavailable' } }
  }
  return _runJudge0(code, languageId, stdin)
}

export async function runCodeFast(code, languageId, stdin = '', opts = {}) {
  const dedicatedJudge0 = !!(opts.judge0Url && opts.judge0Url.trim())
  const covered = !!JUDGE0_TO_WANDOX[languageId]

  const chain = dedicatedJudge0
    ? [{ name: 'judge0', run: () => judge0(code, languageId, stdin) }, ...(covered ? [{ name: 'wandbox', run: () => runWandbox(code, languageId, stdin) }] : [])]
    : [
        ...(covered ? [{ name: 'wandbox', run: () => runWandbox(code, languageId, stdin) }] : []),
        { name: 'judge0', run: () => judge0(code, languageId, stdin) },
      ]

  let lastError = ''
  for (const step of chain) {
    try {
      const result = await step.run()
      if (result && !result.error) return result
      lastError = `${step.name}: ${String(result?.error || 'failed').slice(0, 140)}`
    } catch (err) {
      lastError = `${step.name}: ${String(err?.message || err).slice(0, 140)}`
    }
  }
  return { error: `All execution providers failed. (${lastError})` }
}

// Test-only surface
export const _internals = { JUDGE0_TO_WANDOX, PINNED, pickCompiler, versionKey }
