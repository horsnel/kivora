// ── scripts/maintenance/dep-audit.mjs ────────────────────────────────
// Weekly dependency sweep (zero-dep, Node 18+). Complements dependabot:
// dependabot PROPOSES updates weekly; this script REPORTS what we're
// missing and blocks on advisories that aren't explicitly accepted.
//
// Reads:  package.json (runtime deps), npm registry (latest versions)
// Runs:   npm audit --omit=dev --json (prod advisories)
// Writes: dep-audit-report.json { blocking: [], outdated: [] }
//         $GITHUB_STEP_SUMMARY markdown table
// Exit:   1 when unaccepted high/critical advisories exist, or audit
//         itself is unparseable, or npm registry checks hard-fail.

import { execSync } from 'node:child_process'
import { appendFileSync, writeFileSync, readFileSync } from 'node:fs'

const ACCEPTED = new Set(
  (process.env.ACCEPTED || 'GHSA-9g9p-9gw9-jx7f GHSA-ggv3-7p47-pfv8').split(/\s+/).filter(Boolean)
)
const RUNTIME_DEPS = ['next', 'react', 'react-dom', '@supabase/supabase-js', 'groq-sdk']

const blocking = []
const outdated = []
const summary = []

function note(s) { console.log(s); summary.push(s) }

// ── 1. npm audit (production deps) ───────────────────────────────────────
let audit = null
try {
  const raw = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  audit = JSON.parse(raw)
} catch (e) {
  // npm audit exits non-zero when advisories exist — stdout still has JSON
  try { audit = JSON.parse(e.stdout || '{}') } catch { audit = null }
  if (!audit) {
    blocking.push('npm audit produced unparseable output — investigate manually (possible registry/broken lockfile issue)')
  }
}

const vulns = audit?.vulnerabilities || {}
const blockingVulns = []
for (const [name, v] of Object.entries(vulns)) {
  const severity = v.severity || 'unknown'
  const ghsa = (v.via || []).filter(x => typeof x === 'object' && x.url).map(x => x.url.split('/').pop())
  const acceptedHit = ghsa.some(g => ACCEPTED.has(g))
  if (['critical', 'high'].includes(severity) && !acceptedHit) {
    blockingVulns.push(`${name}: ${severity} (${ghsa.join(', ') || 'indirect via ' + (v.via || []).filter(x => typeof x === 'string').join(', ')})`)
  }
}
if (blockingVulns.length) {
  blocking.push(...blockingVulns.map(x => `unaccepted ${x}`))
}

// ── 2. Missed updates — registry latest vs installed (runtime deps) ─────
let pkg
try { pkg = JSON.parse(readFileSync('package.json', 'utf8')) } catch { pkg = {} }
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }

async function latest(name) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/vnd.npm.version+json' },
  })
  if (!res.ok) throw new Error(`registry HTTP ${res.status} for ${name}`)
  return (await res.json()).version
}

function cmpMajor(installed, latestV) {
  const a = String(installed).replace(/[^0-9.].*$/, '').split('.').map(Number)
  const b = String(latestV).split('.').map(Number)
  return (b[0] || 0) > (a[0] || 0)
}

try {
  for (const name of RUNTIME_DEPS) {
    const installedSpec = deps[name]
    if (!installedSpec) continue
    const installed = installedSpec.replace(/[^0-9.].*$/, '')
    const latestV = await latest(name)
    if (installed && latestV && installed !== latestV) {
      const majorBehind = cmpMajor(installed, latestV)
      outdated.push(`${name}: installed ${installedSpec}, latest ${latestV}${majorBehind ? ' — MAJOR version behind, schedule an upgrade' : ''}`)
    }
  }
} catch (e) {
  blocking.push(`registry check failed: ${String(e?.message || e).slice(0, 160)}`)
}

// ── 3. Report ────────────────────────────────────────────────────────────
const target = process.env.GITHUB_STEP_SUMMARY
if (target) {
  const lines = [
    '## 🛡️ Weekly dependency audit',
    '',
    '| Area | Result |',
    '|---|---|',
    `| Prod advisories (high/critical, unaccepted) | ${blockingVulns.length ? '❌ ' + blockingVulns.length : '✅ none'} |`,
    `| Runtime deps behind registry | ${outdated.length ? 'ℹ️ ' + outdated.length : '✅ all current'} |`,
    '',
    ...(outdated.length ? ['### Missed updates', '', ...outdated.map(o => `- ${o}`)] : []),
    ...(blocking.length ? ['', '### ❌ Blocking', '', ...blocking.map(b => `- ${b}`)] : []),
  ]
  try { appendFileSync(target, lines.join('\n') + '\n') } catch {}
}

writeFileSync('dep-audit-report.json', JSON.stringify({ blocking, outdated }, null, 2))

note(blocking.length
  ? `❌ dependency audit: ${blocking.length} blocking issue(s)`
  : `✅ dependency audit clean${outdated.length ? ` (${outdated.length} missed update(s) noted)` : ''}`)

process.exit(blocking.length ? 1 : 0)
