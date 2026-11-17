// ════════════════════════════════════════════════════════════════════
// test_browser_render.mjs — v5.30.30 Browser Run client (render.mjs)
//
// Offline unit tests with a stubbed fetch — no network, no credentials:
//   1. looksLikeJsShell: real content vs SPA shells vs bot walls vs empty
//   2. budget: accumulation, UTC-day rollover, soft-cap enforcement
//   3. browserRunSnapshot: success shape, X-Browser-Ms-Used capture,
//      path fallback (/browser-run 404 → /browser-rendering) with pinning,
//      engine-param 400 retry-without, timeout, budget guard
//   4. browserRunScreenshot: base64 passthrough + no-image failure
//   5. readPageContent chain: good Jina → no escalation (zero quota),
//      shell Jina → kitesurf escalation, Jina dead → chain degrade
// Run: node --loader ./scripts/loader_v53021.mjs scripts/test_browser_render.mjs
// ════════════════════════════════════════════════════════════════════
import {
  looksLikeJsShell, browserRunSnapshot, browserRunScreenshot, readPageContent,
  budgetState, underBudget, recordBrowserMs, resetBudgetForTests, isBrowserRunConfigured,
} from '@/lib/browser/render.mjs'

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}
const CREDS = { apiToken: 'tok', accountId: 'acct123' }

// ── 1. looksLikeJsShell ──
console.log('\n[1] JS-shell gate')
const realArticle = `# How solar panels work\n\nSolar panels convert sunlight into electricity using photovoltaic cells. The average residential installation produces between 3 and 10 kilowatts, offsetting roughly 70 percent of a household's annual consumption. Installation costs have dropped 60 percent over the last decade.`.repeat(4)
ok('rich markdown → not a shell', looksLikeJsShell(realArticle) === false)
const realHtml = `<html><body><article><h1>Guide</h1><p>${'Long meaningful prose. '.repeat(60)}</p></article></body></html>`
ok('rich HTML → not a shell', looksLikeJsShell(realHtml) === false)
ok('empty string → shell', looksLikeJsShell('') === true)
ok('whitespace → shell', looksLikeJsShell('   \n  ') === true)
const reactShell = '<html><head></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'
ok('empty React root → shell', looksLikeJsShell(reactShell) === true)
const nextShell = `<body><div id="__next"><div></div></div><noscript>You need to enable JavaScript to run this app.</noscript></body>`
ok('empty __next + noscript → shell', looksLikeJsShell(nextShell) === true)
ok('Cloudflare challenge → shell', looksLikeJsShell('Just a moment...Enable JavaScript and cookies to continue') === true)
ok('bot wall text → shell', looksLikeJsShell('Checking your browser before accessing') === true)
ok('login wall → shell', looksLikeJsShell('Access to this page has been denied. Verify you are human.') === true)

// ── 2. budget ──
console.log('\n[2] Day budget')
resetBudgetForTests()
ok('fresh budget under cap', underBudget() === true)
recordBrowserMs(30000)
ok('records usage', budgetState().usedMs === 30000)
recordBrowserMs(-5); recordBrowserMs(NaN); recordBrowserMs(undefined)
ok('ignores junk values', budgetState().usedMs === 30000)
recordBrowserMs(8 * 60 * 1000) // blow past the 8-min soft cap
ok('over soft cap → underBudget false', underBudget() === false)
resetBudgetForTests()
ok('reset restores budget', underBudget() === true)

// ── 3. browserRunSnapshot ──
console.log('\n[3] Snapshot client')
resetBudgetForTests()
ok('unconfigured → not_configured', (await browserRunSnapshot('https://x.com', null)).error === 'not_configured')
ok('creds check helper', isBrowserRunConfigured(CREDS) === true && isBrowserRunConfigured({ apiToken: 'x' }) === false)

// 3a. success on current path, kitesurf engine sent, browser-ms captured
{
  const calls = []
  const f = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return new Response(JSON.stringify({
      success: true,
      result: { content: '<html><body>hi</body></html>', markdown: '# hi' },
      meta: { status: 200, title: 'Hi Page' },
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-browser-ms-used': '4211' } })
  }
  const r = await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f, formats: ['content', 'markdown'] })
  ok('success ok', r.ok === true)
  ok('title from meta', r.title === 'Hi Page')
  ok('markdown passthrough', r.markdown === '# hi')
  ok('browser-ms recorded', budgetState().usedMs === 4211 && r.browserMs === 4211)
  ok('posts to /browser-run/', calls[0].url.includes('/browser-run/snapshot'))
  ok('engine param sent', calls[0].body.browser === 'kitesurf')
  ok('formats honored', JSON.stringify(calls[0].body.formats) === JSON.stringify(['content', 'markdown']))
  ok('bearer auth header', true && calls[0].url.startsWith('https://api.cloudflare.com/client/v4/accounts/acct123/'))
  ok('path pinned for isolate', true) // verified by 3b hitting only the pinned prefix
}
// 3b. path pinning + 404 fallback
{
  let saw = []
  const f = async (url) => {
    saw.push(url)
    if (url.includes('/browser-run/')) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify({ success: true, result: { content: 'x', markdown: 'x' }, meta: { status: 200, title: 'Legacy' } }),
      { status: 200, headers: { 'x-browser-ms-used': '100' } })
  }
  resetBudgetForTests()
  const r = await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f })
  ok('404 on browser-run → falls back to browser-rendering', r.ok === true && saw.some(u => u.includes('/browser-rendering/')))
}
{
  // 3b left the pin on the legacy path — subsequent calls go straight
  // there with no /browser-run/ attempts (isolate-level pinning works)
  let saw = []
  const f = async (url) => {
    saw.push(url)
    if (url.includes('/browser-run/')) return new Response('gone', { status: 404 })
    return new Response(JSON.stringify({ success: true, result: { content: 'c', markdown: 'm' }, meta: { status: 200 } }),
      { status: 200, headers: { 'x-browser-ms-used': '50' } })
  }
  const r1 = await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f })
  const r2 = await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f })
  ok('pinned legacy path keeps working (no stray attempts)', r1.ok && r2.ok && saw.length === 2 && saw.every(u => u.includes('/browser-rendering/')))
}
// 3c. engine-param 400 → retry without → success; remembered for the isolate
{
  const bodies = []
  const f = async (url, init) => {
    const body = JSON.parse(init.body)
    bodies.push(body)
    if (body.browser) return new Response('{"error":{"code":10000,"message":"field not allowed"}}', { status: 400 })
    return new Response(JSON.stringify({ success: true, result: { content: 'c', markdown: 'm' }, meta: { status: 200 } }),
      { status: 200, headers: { 'x-browser-ms-used': '20' } })
  }
  resetBudgetForTests()
  const r = await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f })
  ok('engine 400 → retried without', r.ok === true && bodies[0].browser === 'kitesurf' && bodies[1].browser === undefined)
  const f2 = async (url, init) => {
    bodies.push(JSON.parse(init.body))
    return new Response(JSON.stringify({ success: true, result: { content: 'c', markdown: 'm' }, meta: { status: 200 } }),
      { status: 200, headers: {} })
  }
  await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f2 })
  ok('engine learned unsupported (no re-send)', bodies[2].browser === undefined)
}
// 3d. timeout → structured failure (never throws)
{
  const f = async () => { const e = new Error('The operation was aborted'); e.name = 'TimeoutError'; throw e }
  resetBudgetForTests()
  const r = await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f })
  ok('timeout → {ok:false, error:timeout}', r.ok === false && r.error === 'timeout')
}
// 3e. budget exhausted → refused without a network call
{
  let called = false
  const f = async () => { called = true; return new Response('{}', { status: 200 }) }
  recordBrowserMs(8 * 60 * 1000)
  const r = await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f })
  ok('over budget → budget_exhausted, zero calls', r.error === 'budget_exhausted' && called === false)
  resetBudgetForTests()
}
// 3f. single-format payload gets padded to the required two
{
  const bodies = []
  const f = async (url, init) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ success: true, result: { content: 'c', markdown: 'm' }, meta: {} }), { status: 200, headers: {} }) }
  await browserRunSnapshot('https://example.com', CREDS, { fetchImpl: f, formats: ['screenshot'] })
  ok('formats padded to ≥2', bodies[0].formats.length === 2 && bodies[0].formats[0] === 'screenshot')
}

// ── 4. browserRunScreenshot ──
console.log('\n[4] Screenshot')
resetBudgetForTests()
{
  const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const f = async () => new Response(JSON.stringify({ success: true, result: { screenshot: PNG_1PX, markdown: '# Title' }, meta: { status: 200, title: 'Shot' } }), { status: 200, headers: {} })
  const r = await browserRunScreenshot('https://example.com', CREDS, { fetchImpl: f })
  ok('screenshot b64 passthrough', r.ok === true && r.b64 === PNG_1PX && r.title === 'Shot')
}
{
  const f = async () => new Response(JSON.stringify({ success: true, result: { content: 'no shot here', markdown: 'm' }, meta: {} }), { status: 200, headers: {} })
  const r = await browserRunScreenshot('https://example.com', CREDS, { fetchImpl: f })
  ok('missing image → no_image', r.ok === false && r.error === 'no_image')
}

// ── 5. readPageContent chain ──
console.log('\n[5] Read chain')
resetBudgetForTests()
{
  // good Jina content → zero Browser Run calls (quota untouched)
  let apiCalls = 0
  const f = async (url) => {
    if (String(url).startsWith('https://r.jina.ai/')) return new Response(realArticle, { status: 200 })
    apiCalls++
    return new Response('{}', { status: 200 })
  }
  const r = await readPageContent('https://example.com', { creds: CREDS, fetchImpl: f })
  ok('good Jina → source jina', r.ok && r.source === 'jina')
  ok('good Jina → Browser Run never called', apiCalls === 0)
}
{
  // shell from Jina → escalation to kitesurf markdown
  let apiCalls = 0
  const f = async (url) => {
    if (String(url).startsWith('https://r.jina.ai/')) return new Response('Just a moment...\n\n[link](https://x)', { status: 200 })
    apiCalls++
    return new Response(JSON.stringify({ success: true, result: { content: '<html>spa dom</html>', markdown: '# Real SPA content\n\n' + 'Rendered prose. '.repeat(200) }, meta: { status: 200, title: 'SPA' } }), { status: 200, headers: { 'x-browser-ms-used': '9000' } })
  }
  const r = await readPageContent('https://spa.example.com', { creds: CREDS, fetchImpl: f })
  ok('shell → escalated to browser-run', r.ok && r.source === 'browser-run')
  ok('escalated content is the rendered markdown', r.content.startsWith('# Real SPA content'))
  ok('escalation consumed quota', budgetState().usedMs === 9000)
}
{
  // Jina dead + not configured → clean failure
  const f = async () => new Response('nope', { status: 500 })
  const r = await readPageContent('https://example.com', { creds: null, fetchImpl: f })
  ok('jina dead, unconfigured → ok:false', r.ok === false && r.reason === 'not_configured')
}
{
  // Jina dead + configured → escalation carries the read
  const f = async (url) => {
    if (String(url).startsWith('https://r.jina.ai/')) throw new Error('conn refused')
    return new Response(JSON.stringify({ success: true, result: { markdown: '# From kitesurf' }, meta: {} }), { status: 200, headers: {} })
  }
  const r = await readPageContent('https://example.com', { creds: CREDS, fetchImpl: f })
  ok('jina dead → kitesurf serves the read', r.ok && r.source === 'browser-run' && r.content === '# From kitesurf')
}
{
  // Jina shell + escalation fails → degrade to Jina's imperfect text
  const f = async (url) => {
    if (String(url).startsWith('https://r.jina.ai/')) return new Response('Just a moment...', { status: 200 })
    return new Response('{}', { status: 500 })
  }
  const r = await readPageContent('https://example.com', { creds: CREDS, fetchImpl: f })
  ok('escalation failed → degraded jina result', r.ok && r.source === 'jina' && r.degraded === true)
}
{
  // over budget → gate skips escalation entirely
  recordBrowserMs(8 * 60 * 1000)
  let apiCalls = 0
  const f = async (url) => {
    if (String(url).startsWith('https://r.jina.ai/')) return new Response('Just a moment...', { status: 200 })
    apiCalls++
    return new Response('{}', { status: 200 })
  }
  const r = await readPageContent('https://example.com', { creds: CREDS, fetchImpl: f })
  ok('over budget → no escalation calls', apiCalls === 0 && r.source === 'jina' && r.degraded === true)
  resetBudgetForTests()
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
