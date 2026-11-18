// ════════════════════════════════════════════════════════════════════
// test_v53031_shell.mjs — shell detection + fallback chain (v5.30.31)
//
// Route-level tests: the REAL proxy route (app/api/browser/proxy) is
// driven with Request objects while globalThis.fetch is stubbed to play
// upstream sites. No network, no credentials:
//   1. healthy content page → streams as before, prefix replay loses
//      nothing (START/END markers across the 192KB sniff boundary),
//      meta CSP stripped by the rewriter (Fix 2, verified not invented)
//   2. shell with static content → simplified view (Fix 3a) with banner
//      + proxied links + x-kv-simplified
//   3. pure shell → js_shell error page with Reader button (Fixes 1+5)
//   4. &diag=1 → machine-readable shell verdict JSON
//   5. 429 → one reader-class retry; article → simplified (Fix 3), no
//      article → error page with Reader button
//   6. POST (form/login flows) never shell-intercepted
//   7. &render=1 without credentials falls through to the raw proxy path
//   8. agent carries the opaque-origin storage shim (Fix 4)
// Run: node --loader ./scripts/loader_v53021.mjs scripts/test_v53031_shell.mjs
// ════════════════════════════════════════════════════════════════════
import { GET as handle, POST as handlePost } from '@/app/api/browser/proxy/route.js'
import { AGENT_TAG } from '@/lib/browser/devtools-agent.mjs'

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

const PROXY = (url, q = '') => new Request(`https://kivora.pages.dev/api/browser/proxy?url=${encodeURIComponent(url)}${q}`)

// ── upstream fixtures ──
const SHELL_HTML = `<!doctype html><html><head><title>Sign in • Site</title><script src="/bundle.js"></script></head>
<body><div id="root"></div><script>window.bootstrap()</script></body></html>`

const CONTENT_PAGE = (() => {
  const paras = Array.from({ length: 120 }, (_, i) => `<p>Paragraph ${i} — real meaningful prose about the topic at hand, long enough to defeat every shell heuristic we ship.</p>`).join('\n')
  return `<!doctype html><html><head><title>Real Article</title>
<meta http-equiv="Content-Security-Policy" content="frame-ancestors 'none'; default-src 'self'">
<meta http-equiv="X-Frame-Options" content="DENY">
<link rel="stylesheet" href="/style.css"></head>
<body><article><h1>STARTMARKER_heading</h1>${paras}<p>ENDMARKER_tail_${Math.random().toString(36).slice(2)}</p><a href="https://elsewhere.example.com/page">an outbound link</a></article></body></html>`
})()

const SHELL_WITH_ARTICLE = `<!doctype html><html><head><title>News</title></head><body>
<div id="__next"></div><noscript>You need to enable JavaScript to run this app.</noscript>
<article><h1>Static fallback headline</h1><p>${'Server-rendered fallback text that readers can still consume. '.repeat(30)}</p>
<a href="/more">read more</a></article></body></html>`

const DDG_SERP = (() => {
  const results = Array.from({ length: 10 }, (_, i) =>
    `<div class="result"><h2><a href="https://result-${i}.example.com/x">Result ${i}</a></h2><p>Snippet ${i} with real descriptive text for the searcher to read and evaluate before clicking through to the destination site.</p></div>`
  ).join('\n')
  return `<!doctype html><html><head><title>DuckDuckGo search</title></head><body><div id="links">${results}</div>
<form action="/q"><input name="q"><input type="submit"></form></body></html>`
})()

// ── fetch stub ──
let upstreamCalls = []
function stubFetch(map) {
  // map: [{ match(url|ua), status, body, contentType }]
  const real = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    const ua = (init.headers && (init.headers['user-agent'] || init.headers.get?.('user-agent'))) || ''
    upstreamCalls.push({ url, ua: String(ua) })
    for (const m of map) {
      if (m.match(url, String(ua))) {
        if (m.count !== undefined) { if (m.count <= 0) continue; m.count-- }
        return new Response(m.body, { status: m.status ?? 200, headers: { 'content-type': m.contentType || 'text/html; charset=utf-8' } })
      }
    }
    return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } })
  }
  return () => { globalThis.fetch = real }
}

// ═══ 1. healthy content page: full pipeline unchanged ═══
console.log('\n[1] content page streams byte-complete (Fix 2 verified)')
{
  const restore = stubFetch([{ match: (u) => u.startsWith('https://example.com/article'), status: 200, body: CONTENT_PAGE }])
  const r = await handle(PROXY('https://example.com/article'))
  const text = await r.text()
  ok('200 + html content-type', r.status === 200 && (r.headers.get('content-type') || '').includes('text/html'))
  ok('START marker survives (prefix replay)', text.includes('STARTMARKER_heading'))
  ok('END marker survives (past 192KB sniff boundary)', text.includes('ENDMARKER_tail_'))
  ok('meta CSP stripped (frame-ancestors gone)', !text.includes('Content-Security-Policy'))
  ok('meta XFO stripped', !text.includes('http-equiv="X-Frame-Options"'))
  ok('agent injected', text.includes('__kv_dt') || text.includes('kv_dt'))
  ok('outbound link proxied', text.includes('/api/browser/proxy?url='))
  ok('no simplified/rendered headers', r.headers.get('x-kv-simplified') === null && r.headers.get('x-kv-rendered') === null)
  restore()
}

// ═══ 2. shell + extractable static content → simplified view ═══
console.log('\n[2] shell → simplified view (Fix 3a)')
{
  const restore = stubFetch([{ match: (u) => u.startsWith('https://spa.example.com/news'), status: 200, body: SHELL_WITH_ARTICLE }])
  const r = await handle(PROXY('https://spa.example.com/news'))
  const text = await r.text()
  ok('x-kv-simplified header', r.headers.get('x-kv-simplified') === '1')
  ok('banner present', text.includes('Simplified view'))
  ok('article content present', text.includes('Static fallback headline'))
  ok('relative link proxied', text.includes('/api/browser/proxy?url='))
  ok('shell script NOT present', !text.includes('window.bootstrap'))
  ok('agent still injected (DevTools intact)', text.includes('kv_dt'))
  restore()
}

// ═══ 3. pure shell → branded error + Reader button (Fixes 1+5) ═══
console.log('\n[3] pure shell → js_shell error page with Reader button')
{
  const restore = stubFetch([{ match: (u) => u.startsWith('https://app.example.com/login'), status: 200, body: SHELL_HTML }])
  const r = await handle(PROXY('https://app.example.com/login'))
  const text = await r.text()
  ok('branded error page (200 UI, not gray stream)', r.status === 200 && text.includes("couldn't be loaded"))
  ok('js_shell reason shown', text.includes('JavaScript app that needs a real browser engine'))
  ok('Reader button present', text.includes('data-kv-reader'))
  ok('reader posts agent envelope', text.includes("type:'reader'"))
  ok('retry link present', text.includes('data-kv-retry'))
  ok('close button still present', text.includes("type:'close'"))
  restore()
}

// ═══ 4. diag: machine-readable shell verdict ═══
console.log('\n[4] diag JSON verdicts')
{
  const restore = stubFetch([
    { match: (u) => u.startsWith('https://app.example.com/login'), status: 200, body: SHELL_HTML },
    { match: (u) => u.startsWith('https://example.com/article'), status: 200, body: CONTENT_PAGE },
    { match: (u) => u.startsWith('https://duckduckgo.example.com/'), status: 200, body: DDG_SERP },
  ])
  const d1 = await (await handle(PROXY('https://app.example.com/login', '&diag=1'))).json()
  ok('shell diag: shell=true', d1.shell === true && d1.ok === true)
  ok('shell diag: no simplified article', d1.simplifiedPossible === false)
  const d2 = await (await handle(PROXY('https://example.com/article', '&diag=1'))).json()
  ok('content diag: shell=false', d2.shell === false)
  const d3 = await (await handle(PROXY('https://duckduckgo.example.com/q=test', '&diag=1'))).json()
  ok('DDG-style SERP diag: NOT a shell (static results detected)', d3.shell === false, `bytes=${d3.bytes}`)
  restore()
}

// ═══ 5. 429: reader-class retry (Fix 3, rate path) ═══
console.log('\n[5] 429 → reader retry')
{
  const restore = stubFetch([
    { match: (u, ua) => u.startsWith('https://limited.example.com') && !ua.includes('KivoraReader'), status: 429, body: '<html><body>Too Many Requests</body></html>', contentType: 'text/html; charset=utf-8' },
    { match: (u, ua) => u.startsWith('https://limited.example.com') && ua.includes('KivoraReader'), status: 200, body: SHELL_WITH_ARTICLE },
  ])
  upstreamCalls.length = 0
  const r = await handle(PROXY('https://limited.example.com/page'))
  const text = await r.text()
  ok('429 → simplified via reader retry', r.headers.get('x-kv-simplified') === '1' && text.includes('Static fallback headline'))
  ok('reader UA used on retry', upstreamCalls.some(c => c.ua.includes('KivoraReader')))
  restore()

  const restore2 = stubFetch([{ match: (u) => u.startsWith('https://limited.example.com'), status: 429, body: '<html><body>Too Many Requests</body></html>', contentType: 'text/html; charset=utf-8' }])
  const r2 = await handle(PROXY('https://limited.example.com/page'))
  const t2 = await r2.text()
  ok('429 → error page with Reader button when retry also fails', t2.includes('data-kv-reader') && t2.includes('too many requests'))
  restore2()
}

// ═══ 6. POST never shell-intercepted (login flows safe) ═══
console.log('\n[6] POST responses bypass shell detection')
{
  const restore = stubFetch([{ match: (u) => u.startsWith('https://app.example.com/login'), status: 200, body: SHELL_HTML }])
  const r = await handlePost(new Request('https://kivora.pages.dev/api/browser/proxy?url=' + encodeURIComponent('https://app.example.com/login'), { method: 'POST', body: 'user=a&pass=b', headers: { 'content-type': 'application/x-www-form-urlencoded' } }))
  const text = await r.text()
  ok('POST shell streams through (login result pages intact)', text.includes('window.bootstrap') || text.includes('id="root"'))
  ok('no simplified header on POST', r.headers.get('x-kv-simplified') === null)
  restore()
}

// ═══ 7. render=1 without credentials falls through ═══
console.log('\n[7] render=1 fallthrough without Browser Run credentials')
{
  const oldToken = process.env.CF_API_TOKEN
  const oldAcct = process.env.CF_ACCOUNT_ID
  delete process.env.CF_API_TOKEN
  delete process.env.CF_ACCOUNT_ID
  const restore = stubFetch([{ match: (u) => u.startsWith('https://example.com/article'), status: 200, body: CONTENT_PAGE }])
  const r = await handle(PROXY('https://example.com/article', '&render=1'))
  const text = await r.text()
  ok('falls through to normal streaming', r.headers.get('x-kv-rendered') === null && text.includes('STARTMARKER_heading'))
  if (oldToken !== undefined) process.env.CF_API_TOKEN = oldToken
  if (oldAcct !== undefined) process.env.CF_ACCOUNT_ID = oldAcct
  restore()
}

// ═══ 8. agent storage shim (Fix 4) ═══
console.log('\n[8] opaque-origin storage shim shipped in the agent')
{
  ok('shim present in AGENT_TAG', AGENT_TAG.includes('localStorage') && AGENT_TAG.includes('kvMemStore'))
  ok('shim only fires when storage THROWS', AGENT_TAG.includes("window.localStorage.getItem('__kv__')"))
  ok('defineProperty shadowing used', AGENT_TAG.includes("Object.defineProperty(window, 'localStorage'"))
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
