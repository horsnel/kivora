#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// generate-csp.mjs — post-build CSP generator for Kivora on CF Pages
//
// Runs AFTER `@cloudflare/next-on-pages` and BEFORE `wrangler pages deploy`.
//
// Why: the security scanners flagged `script-src 'unsafe-inline'`. The 30
// prerendered (static) pages have their exact inline scripts baked into
// HTML at build time, so we authorize them with per-file SHA-256 HASHES
// instead of 'unsafe-inline'. A strict CSP (hash-based, no unsafe-inline,
// no blanket CDN allowlist) is then injected into the OUTPUT
// _headers file, scoped per path.
//
// The 4 server-rendered page routes (/auth/callback, /build/<id>,
// /build/<id>/<part>, /explore/<slug>) render per request — their inline
// scripts can't be hashed. They are covered by the per-request nonce CSP
// in middleware.js instead (their paths get NO _headers CSP: browsers
// enforce every CSP header, and a second policy would break the nonce).
// ════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, appendFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const OUT_DIR = join(process.cwd(), '.vercel', 'output', 'static')
const HEADERS_PATH = join(OUT_DIR, '_headers')
const WORKER_INDEX = join(OUT_DIR, '_worker.js', 'index.js')

// ── Tech-stack fingerprint stripping ────────────────────────────────
// The next-on-pages adapter bakes these headers into the prerender
// manifest / routes table inside _worker.js/index.js (they are NOT set by
// our code). They fingerprint the framework on every prerendered response
// and middleware never runs on those short-circuited paths, so strip the
// literals from the generated bundle. All three are pure response-header
// data entries — no runtime logic reads them back on Cloudflare Pages.
function stripLeakyWorkerHeaders() {
  if (!existsSync(WORKER_INDEX)) {
    console.error(`generate-csp: worker entry not found: ${WORKER_INDEX}`)
    process.exit(1)
  }
  let src = readFileSync(WORKER_INDEX, 'utf8')
  const before = src.length
  const removals = [
    // routes table entries: {"x-matched-path":"/"} / {"x-matched-path":"/$1"}
    /"x-matched-path":"[^"]*"/g,
    // prerender manifest headers: "x-nextjs-stale-time":"300", / "x-nextjs-prerender":"1",
    /"x-nextjs-stale-time":"[^"]*",?/g,
    /"x-nextjs-prerender":"[^"]*",?/g,
  ]
  for (const re of removals) src = src.replace(re, '')
  // tidy any now-empty headers objects left by the x-matched-path removal
  src = src.replace(/headers:\{\}/g, 'headers:{}')
  if (src.length !== before) {
    writeFileSync(WORKER_INDEX, src)
    console.log(`generate-csp: stripped ${before - src.length} bytes of leaky tech-stack headers from _worker.js/index.js`)
  } else {
    console.log('generate-csp: no leaky headers found in worker bundle (already clean)')
  }
}

// Keep in sync with DYNAMIC_PAGE_RE in middleware.js
const DYNAMIC_PAGE_PATTERNS = [
  /^\/auth\/callback$/,
  /^\/build\/[^/]+(?:\/[^/]+)?$/,
  /^\/explore\/[^/]+$/,
]
const isDynamicPage = (path) => DYNAMIC_PAGE_PATTERNS.some((re) => re.test(path))

// ArtifactViewer loads mermaid from SELF-HOSTED /vendor/mermaid.min.js now
// (no third-party script origins in the CSP at all).

function listHtmlFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listHtmlFiles(full))
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

function filePathToRoute(file) {
  const rel = relative(OUT_DIR, file).split(sep).join('/')
  // index.html → / ; auth/reset.html → /auth/reset ; 500.html → skip later
  const route = '/' + rel.replace(/\.html$/, '').replace(/(^|\/)index$/, '')
  return route === '/index' || rel === 'index.html' ? '/' : route
}

function extractInlineScriptHashes(html) {
  const hashes = new Set()
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let m
  while ((m = scriptRe.exec(html)) !== null) {
    const attrs = m[1] || ''
    const content = m[2] || ''
    if (/\bsrc\s*=/i.test(attrs)) continue // external scripts are 'self'/allowlist
    if (!content.trim()) continue
    const digest = createHash('sha256').update(content).digest('base64')
    hashes.add(`'sha256-${digest}'`)
  }
  return [...hashes]
}

function buildCsp(hashes) {
  const scriptSrc = ["'self'", ...hashes].join(' ')
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data: https:",
    // next/font self-hosts Inter + JetBrains Mono — no external font hosts
    "font-src 'self' data:",
    "connect-src 'self' https://asfzdbpfakwpiawhhrby.supabase.co wss://asfzdbpfakwpiawhhrby.supabase.co",
    "frame-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

function main() {
  if (!existsSync(OUT_DIR)) {
    console.error(`generate-csp: output dir not found: ${OUT_DIR}`)
    process.exit(1)
  }
  if (!existsSync(HEADERS_PATH)) {
    console.error(`generate-csp: _headers not found: ${HEADERS_PATH}`)
    process.exit(1)
  }

  const htmlFiles = listHtmlFiles(OUT_DIR)
  const sections = []
  let skipped = []

  for (const file of htmlFiles) {
    const route = filePathToRoute(file)
    // Error/catchall pages can't be path-scoped; skip (no user content there)
    if (/^\/(500|404|_not-found)$/.test(route)) { skipped.push(route); continue }
    // SSR'd page routes use the middleware nonce CSP instead
    if (isDynamicPage(route)) { skipped.push(route + ' (dynamic)'); continue }

    const html = readFileSync(file, 'utf8')
    const hashes = extractInlineScriptHashes(html)
    if (hashes.length === 0) {
      skipped.push(route + ' (no inline scripts)')
      continue
    }
    const csp = buildCsp(hashes)
    sections.push(`\n# CSP (hash-based, generated by scripts/generate-csp.mjs — do not edit by hand)\n${route}\n  Content-Security-Policy: ${csp}`)
  }

  if (sections.length === 0) {
    console.error('generate-csp: no CSP sections generated — aborting to avoid shipping a broken/absent policy')
    process.exit(1)
  }

  stripLeakyWorkerHeaders()
  appendFileSync(HEADERS_PATH, sections.join('\n') + '\n')
  console.log(`generate-csp: injected hash-based CSP for ${sections.length} route(s)${skipped.length ? `; skipped: ${skipped.join(', ')}` : ''}`)
}

main()
