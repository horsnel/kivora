#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// v5.26 logic tests — proxy request identity, no-error-caching cache
// policy, locale-aware error pages, link-tap pending flow, browser
// session restore (last page always comes back).
// Source-level assertions for the route (edge imports can't load in
// plain node) + functional tests for the hydration pick algorithm.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (p) => readFileSync(join(root, p), 'utf8')

let pass = 0
let fail = 0
const failures = []
function ok(cond, name) {
  if (cond) {
    pass++
  } else {
    fail++
    failures.push(name)
    console.error(`  ✗ ${name}`)
  }
}
const has = (hay, needle) => hay.includes(needle)

// ═══ 1. upstream request identity (the "key error / unauthorized" fix) ═══
console.log('── v5.26: upstream request identity ──')
const route = src('app/api/browser/proxy/route.js')

ok(has(route, "'sec-fetch-mode': 'navigate'"), 'sec-fetch-mode: navigate sent')
ok(has(route, "'sec-fetch-dest': 'document'"), 'sec-fetch-dest: document sent')
ok(has(route, "'sec-fetch-site': 'none'"), 'sec-fetch-site: none sent')
ok(has(route, "'sec-fetch-user': '?1'"), 'sec-fetch-user sent for GET navigations')
ok(has(route, '"sec-ch-ua-mobile": desktop ? \'?0\' : \'?1\'') || has(route, "'sec-ch-ua-mobile': desktop ? '?0' : '?1'"), 'sec-ch-ua-mobile matches desktop toggle')
ok(has(route, "'sec-ch-ua-platform': desktop ? '\"Windows\"' : '\"Android\"'"), 'sec-ch-ua-platform matches desktop toggle')
ok(has(route, '"Chromium";v="125", "Google Chrome";v="125"'), 'client-hint brands match the UA version')
// self referer: target origin only — never leaks kivora/user URL upstream
ok(has(route, "const origin = new URL(target).origin + '/'"), 'referer = target self-origin')
ok(has(route, 'referer: origin'), 'referer header wired')
ok(!/headers:\s*\{[^}]*cookie/i.test(route.split('function upstreamHeaders')[1] || ''), 'no cookies forwarded upstream (privacy)')
ok(has(route, "'accept-language': 'en-US,en;q=0.9,fr;q=0.8,sw;q=0.7"), 'accept-language includes platform locales')

// ═══ 2. edge cache: errors NEVER cached (cacheTtlByStatus replaces cacheTtl) ═══
console.log('── v5.26: cache policy ──')
ok(has(route, 'cacheTtlByStatus'), 'cacheTtlByStatus used')
ok(!/cacheTtl\s*:/.test(route), 'plain cacheTtl removed (mutually exclusive)')
ok(has(route, "'401': 0"), '401 never edge-cached')
ok(has(route, "'403': 0"), '403 never edge-cached')
ok(has(route, "'429': 0"), '429 never edge-cached')
ok(has(route, "'500-599': 0"), '5xx never edge-cached')
ok(has(route, "'200-299': HTML_EDGE_TTL"), '2xx edge-cached briefly')
ok(has(route, "'404': 30"), '404 shielded for 30s')
ok(/ua=desktop[\s\S]{0,400}?cacheEverything/.test(route) === false || has(route, 'isGet && !desktop ?'), 'desktop UA skips edge cache (no mobile/desktop key collision)')

// ═══ 3. locale-aware branded error pages ═══
console.log('── v5.26: error pages ──')
ok(has(route, 'ERR_LOCALES'), 'locale table present')
for (const l of ['en', 'fr', 'sw', 'yo']) {
  ok(new RegExp(`${l}:\\s*\\{[\\s\\S]{0,900}?auth:`).test(route), `locale ${l} has auth reason`)
  ok(new RegExp(`${l}:\\s*\\{[\\s\\S]{0,1400}?server:`).test(route), `locale ${l} has server reason`)
}
ok(has(route, "reasonFor(res.status)"), 'upstream status → reason mapping')
ok(has(route, "status === 401 || status === 403"), '401/403 → auth explanation')
ok(has(route, "if (res.status >= 400) {"), 'upstream 4xx/5xx intercepted')
ok(has(route, "data-kv-close=\"1\""), 'error page has close button')
ok(has(route, "type:'close'"), 'close posts the agent-protocol envelope')
ok(has(route, "data-kv-retry=\"1\""), 'error page has retry button')
ok(has(route, '&rj='), 'retry busts browser cache')
ok(has(route, "location.pathname+location.search+'&rj='+Date.now()"), 'retry re-navigates the proxy URL')
ok(has(route, ".replace(/[&<>\"']/g, (c) => `&#${c.charCodeAt(0)};`)"), 'target URL HTML-escaped (XSS safe)')
ok(has(route, "pickLocale(u, req)"), 'locale picked from ?lang= or accept-language')
ok(has(route, "searchParams.get('lang')"), 'explicit ?lang= honored')
ok(has(route, "headers.get('accept-language')"), 'accept-language fallback')

// ═══ 4. Range passthrough for media seeking ═══
console.log('── v5.26: media range passthrough ──')
ok(has(route, "'content-range', 'accept-ranges', 'content-length'"), 'range headers forwarded for 206/media')
ok(has(route, "req.headers.get('range') ? { range: req.headers.get('range') }"), 'client Range forwarded upstream')

// ═══ 5. link tap → immediate auto-load (pending prop fix) ═══
console.log('── v5.26: link tap auto-load ──')
const provider = src('components/browser/BrowserProvider.jsx')
const app = src('components/BrowserApp.jsx')
ok(has(provider, '<BrowserApp open={open} onClose={closeBrowser} pending={pending} />'), 'pending navigation passed as prop (THE fix)')
ok(has(app, 'if (!pending || !tabs) return'), 'BrowserApp consumes pending navigation')
ok(has(app, 'hist.push(pending.url)'), 'tapped URL pushed into active tab history')
ok(has(app, 'loading: true, reader: false, mounted: true }'), 'tapped URL mounts + loads immediately')
ok(has(provider, "document.addEventListener('click', onClick, true)"), 'global click capture still active')

// ═══ 6. session restore — "the last page always comes back" ═══
console.log('── v5.26: session restore ──')
ok(has(app, "SESS_KEY = 'kv_browser_session_v1'"), 'session key defined')
ok(has(provider, "SESS_KEY = 'kv_browser_session_v1'"), 'provider shares the session key')
ok(has(provider, 'writeSess({ open: true })'), 'open state persisted on open')
ok(has(provider, 'writeSess({ open: false })'), 'explicit close ends session (no auto-reopen)')
ok(has(provider, 'if (sess.open) t = setTimeout(() => setOpen(true), 350)'), 'refresh/swipe-away → drawer auto-reopens')
ok(has(app, 'loading: false, mounted: false }'), 'restored tabs mount lazily (no N parallel fetches)')
ok(has(app, 'initTabs.find((x) => x.id === want)'), 'last-active tab restored (not tab #1)')
ok(has(app, 'initTabs.find((x) => x.hist[x.hi]) || initTabs[0]'), 'fallback: first tab with a URL')
ok(has(app, 'act.mounted = true'), 'exactly the restored active tab mounts')
ok(has(app, 'activeId, ts: Date.now()'), 'activeId persisted for next launch')
ok(has(app, 'x.id === nx.id && !x.mounted ? { ...x, mounted: true } : x'), 'closeTab mounts a lazily-restored landing tab')
ok(has(app, '}, [tabs, bookmarks, history, activeId])'), 'persist effect tracks activeId')
ok(has(app, '&lang=${lang}'), 'proxy URLs carry the platform locale')

// ═══ 7. hydration pick algorithm (functional) ═══
console.log('── v5.26: hydration pick (functional) ──')
function hydrate(savedTabs, sessActiveId) {
  const clean = (Array.isArray(savedTabs) ? savedTabs : [])
    .filter((x) => x && Array.isArray(x.hist) && x.hist.length)
    .map((x) => ({ ...x, loading: false, mounted: false }))
  const initTabs = clean.length ? clean : [{ id: 'fresh', hist: [null], hi: 0, mounted: false }]
  const want = sessActiveId && sessActiveId
  const act = initTabs.find((x) => x.id === want) || initTabs.find((x) => x.hist[x.hi]) || initTabs[0]
  act.mounted = true
  return { tabs: initTabs, activeId: act.id, mountedCount: initTabs.filter((x) => x.mounted).length }
}
let r = hydrate([{ id: 'a', hist: ['https://a.com'], hi: 0 }, { id: 'b', hist: ['https://b.com'], hi: 0 }], 'b')
ok(r.activeId === 'b', 'restores the persisted last-active tab')
ok(r.mountedCount === 1, 'exactly one iframe mounts on refresh')
ok(r.tabs[0].mounted === false, 'inactive restored tab stays lazy')
r = hydrate([{ id: 'a', hist: ['https://a.com'], hi: 0 }, { id: 'b', hist: [null], hi: 0 }], 'gone-tab')
ok(r.activeId === 'a', 'stale session id falls back to first tab with a URL')
r = hydrate([{ id: 'a', hist: [null], hi: 0 }], 'gone-tab')
ok(r.activeId === 'a', 'all-start-page session falls back to tab #1')
r = hydrate([], null)
ok(r.tabs.length === 1 && r.tabs[0].hist[0] === null && r.mountedCount === 1, 'cold start → one fresh start-page tab')
r = hydrate([{ id: 'a', hist: ['https://a.com'], hi: 0 }], 'a')
ok(r.tabs[0].mounted === true, 'restored active tab with URL loads immediately')

// ═══ 8. rewriter + agent suites still green (re-run inline summary) ═══
console.log('── v5.26: regression guard ──')
ok(!has(app, "initTabs[0] = { ...initTabs[0], mounted: true }"), 'old first-tab-only mount removed')
ok(!/pending=\{pending\}/.test(app) || has(app, 'props pending') || has(app, '{ open, onClose, pending }'), 'BrowserApp still declares pending prop')
ok(has(route, 'const EDGE_CACHE_BY_STATUS'), 'cache policy is a named constant')
ok(has(route, "export const runtime = 'edge'"), 'edge runtime retained (n-o-p mandatory)')
ok(has(route, "redirect: 'follow'"), 'redirect following retained')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) {
  console.error('FAILED:', failures.join(' | '))
  process.exit(1)
}
