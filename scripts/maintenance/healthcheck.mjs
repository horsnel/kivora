// ── scripts/maintenance/healthcheck.mjs ──────────────────────────────
// Zero-dependency maintenance probe for Kivora (Node 18+, stdlib only —
// deliberately no npm install so daily runs stay fast and unbreakable).
//
// What it checks
//   Site:        /  (200 + app markup), /api/health (200 ok + commit)
//   PWA:         /manifest.webmanifest (valid, icons), /sw.js (push + click handlers)
//   Push chain:  /api/push/key (valid VAPID public key; optional exact match)
//   Brand:       /og.png (200, image/*)
//   Telemetry:   client_errors (24h crash signatures), push_subscriptions,
//                chat_generations — via Supabase REST when creds are set.
//   WEEKLY=1     adds stale-subscription (60d) + 30-day error trend probes.
//
// Env
//   SITE_URL              default https://kivora.pages.dev
//   VAPID_PUBLIC_KEY      when set, /api/push/key must match it exactly
//   SUPABASE_URL          with SUPABASE_SERVICE_KEY enables telemetry
//   SUPABASE_SERVICE_KEY  service-role key (bypasses RLS — never log it)
//   WEEKLY                "1" = weekly extras
//   CRASH_THRESHOLD       signature count that becomes a crash-spike finding (default 10)
//
// Outputs
//   stdout: human-readable check table
//   $GITHUB_STEP_SUMMARY: markdown summary (when present)
//   ./maintenance-report.json: machine report for workflow steps
// Exit code: 1 if any HARD check failed; 0 otherwise (findings are advisory)
//
// ⚠️ The service key is used only in request headers — never printed.

import { appendFileSync, writeFileSync } from 'node:fs'

const SITE_URL = (process.env.SITE_URL || 'https://kivora.pages.dev').replace(/\/+$/, '')
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const SUPA_URL = process.env.SUPABASE_URL || ''
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const WEEKLY = process.env.WEEKLY === '1'
const CRASH_THRESHOLD = Number(process.env.CRASH_THRESHOLD || 10)
const TIMEOUT = 15000

const results = []       // { check, status: pass|fail|warn|skip, detail }
const failures = []      // hard failures (drive exit code)
const findings = []      // advisory (crash spikes, stale subs, drift)
const crashes = []       // [{signature, count, sample}]

function record(check, status, detail) {
  results.push({ check, status, detail })
  if (status === 'fail') failures.push({ check, detail })
  if (status === 'warn') findings.push({ severity: 'warn', check, message: detail })
  const icon = { pass: '✅', fail: '❌', warn: '⚠️ ', skip: '➖' }[status]
  console.log(`${icon} ${check.padEnd(28)} ${detail}`)
}

async function probe(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) })
  const text = body === undefined ? await res.text().catch(() => '') : ''
  return { res, text }
}

// ── Hard checks ───────────────────────────────────────────────────────────
async function checkSite() {
  try {
    const { res, text } = await probe(`${SITE_URL}/`)
    if (res.status !== 200) return record('site /', 'fail', `HTTP ${res.status}`)
    const hasApp = /__next|id="app"|Kivora/i.test(text)
    if (!hasApp) return record('site /', 'fail', '200 but no app markup found')
    record('site /', 'pass', `200, ${(text.length / 1024).toFixed(0)}KB, app markup present`)
  } catch (e) { record('site /', 'fail', `unreachable: ${String(e?.message || e).slice(0, 120)}`) }
}

async function checkHealthEndpoint() {
  try {
    const { res, text } = await probe(`${SITE_URL}/api/health`)
    if (res.status !== 200) return record('api/health', 'fail', `HTTP ${res.status}`)
    const j = JSON.parse(text)
    if (!j.ok) return record('api/health', 'fail', `ok=false, commit=${j.commit}`)
    record('api/health', 'pass', `ok, commit=${String(j.commit || '?').slice(0, 12)}, time=${j.time?.slice(0, 19)}`)
    return j.commit
  } catch (e) { record('api/health', 'fail', `unreachable: ${String(e?.message || e).slice(0, 120)}`) }
}

async function checkManifest() {
  try {
    const { res, text } = await probe(`${SITE_URL}/manifest.webmanifest`)
    if (res.status !== 200) return record('manifest.webmanifest', 'fail', `HTTP ${res.status}`)
    const j = JSON.parse(text)
    const icons = Array.isArray(j.icons) ? j.icons.length : 0
    if (!j.name || !icons) return record('manifest.webmanifest', 'fail', `name/icons missing (icons=${icons})`)
    record('manifest.webmanifest', 'pass', `name="${j.name}", ${icons} icons`)
  } catch (e) { record('manifest.webmanifest', 'fail', String(e?.message || e).slice(0, 120)) }
}

async function checkServiceWorker() {
  try {
    const { res, text } = await probe(`${SITE_URL}/sw.js`)
    if (res.status !== 200) return record('sw.js', 'fail', `HTTP ${res.status}`)
    const hasPush = /addEventListener\(\s*['"]push['"]/.test(text)
    const hasClick = /notificationclick/.test(text)
    if (!hasPush || !hasClick) return record('sw.js', 'fail', `push=${hasPush}, notificationclick=${hasClick} — push handler missing`)
    record('sw.js', 'pass', 'push + notificationclick handlers present')
  } catch (e) { record('sw.js', 'fail', String(e?.message || e).slice(0, 120)) }
}

async function checkPushKey() {
  try {
    const { res, text } = await probe(`${SITE_URL}/api/push/key`)
    if (res.status !== 200) return record('api/push/key', 'fail', `HTTP ${res.status}`)
    const j = JSON.parse(text)
    const key = String(j.key || '')
    if (!key) {
      return record('api/push/key', 'warn', 'empty key — Web Push is OFF server-side (VAPID env not set)')
    }
    // base64url of a 65-byte uncompressed P-256 point is 87 chars (ceil(65*4/3), unpadded)
    const structuralOk = /^[A-Za-z0-9_-]{87}$/.test(key)
    if (!structuralOk) return record('api/push/key', 'fail', `malformed VAPID public key (len=${key.length}, want 87)`)
    if (VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY !== key) {
      return record('api/push/key', 'fail', 'served key ≠ configured VAPID_PUBLIC_KEY secret — subscriptions created under the old key will be rejected by the push service')
    }
    record('api/push/key', 'pass', `valid P-256 base64url key ${VAPID_PUBLIC_KEY ? '(matches secret)' : ''}`.trim())
  } catch (e) { record('api/push/key', 'fail', String(e?.message || e).slice(0, 120)) }
}

async function checkOgImage() {
  try {
    const { res } = await probe(`${SITE_URL}/og.png`)
    const ct = res.headers.get('content-type') || ''
    if (res.status !== 200 || !ct.startsWith('image/')) {
      return record('og.png', 'fail', `HTTP ${res.status}, content-type=${ct} — social previews will break`)
    }
    record('og.png', 'pass', `200 ${ct}`)
  } catch (e) { record('og.png', 'fail', String(e?.message || e).slice(0, 120)) }
}

// ── Telemetry (soft — needs Supabase service creds) ──────────────────────
function supaHeaders(extra = {}) {
  return {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    ...extra,
  }
}

async function supaCount(table, filters) {
  const qs = new URLSearchParams({ select: 'id', ...filters })
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
    headers: supaHeaders({ Prefer: 'count=exact', Range: '0-0' }),
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const range = res.headers.get('content-range') || ''
  const total = Number(range.split('/')[1] || 0)
  return total
}

async function checkTelemetry() {
  if (!SUPA_URL || !SUPA_KEY) {
    record('telemetry', 'skip', 'SUPABASE_URL / SUPABASE_SERVICE_KEY secrets not set — crash & usage digest disabled')
    return
  }
  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const since7 = new Date(Date.now() - 7 * 86400e3).toISOString()
  const since30 = new Date(Date.now() - 30 * 86400e3).toISOString()
  const since60 = new Date(Date.now() - 60 * 86400e3).toISOString()

  // Crash signatures (24h) — the platform's real-world bug detector
  try {
    const qs = new URLSearchParams({ select: 'message,created_at', created_at: `gte.${since24}`, order: 'created_at.desc', limit: '500' })
    const res = await fetch(`${SUPA_URL}/rest/v1/client_errors?${qs}`, {
      headers: supaHeaders(), signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = await res.json()
    const bySig = new Map()
    for (const r of rows) {
      const sig = String(r.message || 'unknown').slice(0, 160)
      bySig.set(sig, (bySig.get(sig) || 0) + 1)
    }
    const sigs = [...bySig.entries()].sort((a, b) => b[1] - a[1])
    record('client_errors 24h', 'pass', `${rows.length} reports, ${sigs.length} distinct signatures`)
    for (const [signature, count] of sigs.slice(0, 8)) {
      crashes.push({ signature, count, sample: signature.slice(0, 120) })
      if (count >= CRASH_THRESHOLD) {
        findings.push({ severity: 'warn', check: 'crash-spike', message: `signature ×${count} in 24h: ${signature}` })
      }
    }
  } catch (e) {
    record('client_errors 24h', 'warn', `query failed: ${String(e?.message || e).slice(0, 120)}`)
  }

  // Push subscriptions — growth + staleness
  try {
    const total = await supaCount('push_subscriptions', {})
    const recent = await supaCount('push_subscriptions', { created_at: `gte.${since7}` })
    record('push_subscriptions', 'pass', `total=${total}, new_7d=${recent}`)
    if (WEEKLY) {
      const stale = await supaCount('push_subscriptions', { created_at: `lt.${since60}` })
      if (stale > 0) findings.push({ severity: 'warn', check: 'stale-subs', message: `${stale} push subscription(s) older than 60d — stale endpoints waste send attempts until they 410-prune` })
      record('push_subscriptions 60d+', 'pass', `older_than_60d=${stale}`)
    }
  } catch (e) {
    record('push_subscriptions', 'warn', `query failed: ${String(e?.message || e).slice(0, 120)}`)
  }

  // Chat activity
  try {
    const gen24 = await supaCount('chat_generations', { created_at: `gte.${since24}` })
    record('chat_generations 24h', 'pass', `${gen24} buffered generations`)
  } catch (e) {
    record('chat_generations 24h', 'warn', `query failed: ${String(e?.message || e).slice(0, 120)}`)
  }

  if (WEEKLY) {
    try {
      const err30 = await supaCount('client_errors', { created_at: `gte.${since30}` })
      record('client_errors 30d', 'pass', `${err30} total reports`)
    } catch (e) {
      record('client_errors 30d', 'warn', `query failed: ${String(e?.message || e).slice(0, 120)}`)
    }
  }
}

// ── Reporting ─────────────────────────────────────────────────────────────
function writeStepSummary() {
  const target = process.env.GITHUB_STEP_SUMMARY
  if (!target) return
  const lines = [
    `## 🩺 Kivora daily maintenance — ${SITE_URL}`,
    '',
    '| Check | Status | Detail |',
    '|---|---|---|',
    ...results.map(r => `| ${r.check} | ${{ pass: '✅', fail: '❌', warn: '⚠️', skip: '➖' }[r.status]} | ${String(r.detail).replace(/\|/g, '\\|').slice(0, 160)} |`),
  ]
  if (crashes.length) {
    lines.push('', '### Crash signatures (24h)', '', '| × | Signature |', '|---|---|', ...crashes.map(c => `| ${c.count} | \`${c.signature.replace(/`/g, "'").slice(0, 120)}\` |`))
  }
  if (findings.length) {
    lines.push('', '### Findings', '', ...findings.map(f => `- ⚠️ **${f.check}**: ${f.message}`))
  }
  if (failures.length) {
    lines.push('', `> ❌ **${failures.length} hard failure(s)** — see job log; this run is marked failed.`)
  } else {
    lines.push('', '> ✅ No hard failures.')
  }
  try { appendFileSync(target, lines.join('\n') + '\n') } catch {}
}

async function main() {
  console.log(`\n🩺 Kivora healthcheck → ${SITE_URL}${WEEKLY ? ' (weekly mode)' : ''}\n`)
  await checkSite()
  await checkHealthEndpoint()
  await checkManifest()
  await checkServiceWorker()
  await checkPushKey()
  await checkOgImage()
  await checkTelemetry()

  writeStepSummary()

  const report = {
    generated_at: new Date().toISOString(),
    site_url: SITE_URL,
    weekly: WEEKLY,
    failures,
    findings,
    crashes,
    results,
  }
  writeFileSync('maintenance-report.json', JSON.stringify(report, null, 2))

  console.log(`\n${failures.length ? `❌ ${failures.length} hard failure(s)` : '✅ all hard checks passed'}${findings.length ? ` · ⚠️ ${findings.length} finding(s)` : ''}\n`)
  process.exit(failures.length ? 1 : 0)
}

main().catch(e => {
  console.error('healthcheck crashed:', e)
  process.exit(1)
})
