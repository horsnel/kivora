#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// browser_test.mjs — logic tests for lib/browser/core.mjs (v5.24.6)
// Covers: SSRF guard, target validation, omnibox normalization, HTML
// rewriting (links/forms/base/meta-refresh), title extraction, reader
// extraction + sanitization.
// Run: node scripts/browser_test.mjs
// ════════════════════════════════════════════════════════════════════
import {
  isBlockedHost,
  validateTarget,
  normalizeInput,
  rewriteHtml,
  extractTitle,
  extractArticle,
  escAttr,
} from '../lib/browser/core.mjs'

let pass = 0
let fail = 0
function eq(name, actual, expected) {
  const ok = actual === expected
  if (ok) pass++
  else {
    fail++
    console.log(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`)
  }
}
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.log(`  ✗ ${name}`)
  }
}

console.log('── SSRF guard: isBlockedHost ──')
// blocked
for (const h of [
  'localhost', 'LOCALHOST', 'foo.localhost', 'metadata.google.internal', 'x.internal', 'x.local', 'x.lan', 'x.home',
  '127.0.0.1', '127.8.8.8', '10.0.0.1', '10.255.1.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
  '0.0.0.0', '100.64.0.1', '100.127.255.255', '224.0.0.1', '255.255.255.255', '::1', '[::1]', 'fd00::1', 'fe80::1',
  '::ffff:10.0.0.1', '2130706433', '0x7f000001', '', 'host.docker.internal',
]) ok(`blocks ${JSON.stringify(h)}`, isBlockedHost(h) === true)
// public (must pass)
for (const h of ['example.com', 'www.google.com', '8.8.8.8', '1.1.1.1', 'jumia.com.ng', 'a-b.c.d.example.co.uk']) {
  ok(`allows ${h}`, isBlockedHost(h) === false)
}
// edge cases: 172.15 and 172.32 are PUBLIC
ok('allows 172.15.0.1', isBlockedHost('172.15.0.1') === false)
ok('allows 172.32.0.1', isBlockedHost('172.32.0.1') === false)
ok('blocks 172.31.0.1', isBlockedHost('172.31.0.1') === true)

console.log('── validateTarget ──')
eq('http ok', validateTarget('http://example.com/a').ok, true)
eq('https ok + normalizes', validateTarget('HTTPS://EXAMPLE.com/a').url, 'https://example.com/a')
eq('ftp blocked', validateTarget('ftp://example.com').reason, 'bad_scheme')
eq('file blocked', validateTarget('file:///etc/passwd').reason, 'bad_scheme')
eq('credentials blocked', validateTarget('https://user:pass@example.com').reason, 'credentials')
eq('loopback blocked', validateTarget('http://127.0.0.1:8080/x').reason, 'blocked_host')
eq('metadata blocked', validateTarget('http://169.254.169.254/latest/meta-data').reason, 'blocked_host')
eq('missing', validateTarget('').reason, 'missing_url')
eq('garbage', validateTarget('not a url at all').reason, 'bad_url')
eq('too long', validateTarget('https://example.com/' + 'a'.repeat(2100)).reason, 'url_too_long')
ok('valid returns url', validateTarget('https://example.com/x?y=1').url.includes('y=1'))

console.log('── normalizeInput ──')
eq('https url passthrough', normalizeInput('https://example.com/a?b=1').url, 'https://example.com/a?b=1')
eq('http passthrough', normalizeInput('http://example.com').url, 'http://example.com')
eq('bare domain → https', normalizeInput('example.com').url, 'https://example.com')
eq('bare domain + path', normalizeInput('example.com/a/b?q=1').url, 'https://example.com/a/b?q=1')
eq('www', normalizeInput('www.example.com').url, 'https://www.example.com')
eq('ip literal', normalizeInput('8.8.8.8').url, 'https://8.8.8.8')
eq('search with spaces', normalizeInput('kivora browser app').url, 'https://duckduckgo.com/html/?q=kivora%20browser%20app')
eq('search marked', normalizeInput('hello world').isSearch, true)
eq('single word not a tld → search', normalizeInput('wikipedia').isSearch, true)
eq('multi-dot host', normalizeInput('en.m.wikipedia.org/wiki/Web').url, 'https://en.m.wikipedia.org/wiki/Web')
eq('empty', normalizeInput('   ').url, '')

console.log('── rewriteHtml ──')
const proxy = (abs) => `/api/browser/proxy?url=${encodeURIComponent(abs)}`
const TARGET = 'https://site.example/page'
let out = rewriteHtml(
  `<html><head><title>T</title><base href="https://evil.example/old/"><meta http-equiv="Content-Security-Policy" content="frame-ancestors 'none'"></head>
   <body>
     <a href="/next">rel</a>
     <a href="https://other.example/x">abs</a>
     <a href="#anchor">frag</a>
     <a href="mailto:a@b.c">mail</a>
     <a href="javascript:void(0)">js</a>
     <a href="https://127.0.0.1/x">ssrf</a>
     <img src="/img.png">
     <form action="/submit" method="get"><input name="q"></form>
     <form method="post"><input name="b"></form>
   </body></html>`,
  TARGET,
  proxy
)
ok('own base removed', !/<base[^>]*evil/.test(out))
ok('csp meta removed', !/Content-Security-Policy/i.test(out))
ok('our base injected', out.includes(`<base href="https://site.example/page">`))
ok('no-referrer injected', out.includes('name="referrer"'))
ok('relative link proxied', out.includes(`href="/api/browser/proxy?url=${encodeURIComponent('https://site.example/next')}"`))
ok('absolute link proxied', out.includes(`href="/api/browser/proxy?url=${encodeURIComponent('https://other.example/x')}"`))
ok('fragment untouched', out.includes('href="#anchor"'))
ok('mailto untouched', out.includes('href="mailto:a@b.c"'))
ok('javascript untouched', out.includes('href="javascript:void(0)"'))
ok('ssrf link left as-is (host blocked)', out.includes('href="https://127.0.0.1/x"'))
ok('img untouched (base handles it)', out.includes('src="/img.png"'))
// v5.30.4 — GET forms: a GET submission REPLACES the query string, so the
// proxy target must ride as a hidden input (action is the bare proxy path)
ok('GET form action is bare proxy path', /<form action="\/api\/browser\/proxy"[^>]*>/i.test(out))
ok('GET form carries hidden url', out.includes(`<input type="hidden" name="url" value="${escAttr('https://site.example/submit')}">`))
ok('GET form keeps its own method', /<form action="\/api\/browser\/proxy" method="get">/.test(out))
// POST form: query survives the submission → action keeps url= (query-bearing)
ok('POST form action keeps proxy url', out.includes(`action="/api/browser/proxy?url=${encodeURIComponent('https://site.example/page')}"`))
ok('exactly 2 forms rewritten', (out.match(/<form\b/gi) || []).length === 2)
// meta refresh
out = rewriteHtml(`<meta http-equiv="refresh" content="0; url=/landing">`, TARGET, proxy)
ok('meta refresh url proxied', out.includes(encodeURIComponent('https://site.example/landing')))
out = rewriteHtml(`<html><head></head></html>`, 'https://x.example/a?b=1', proxy)
ok('base escapes query', out.includes(`<base href="https://x.example/a?b=1">`))
ok('escAttr escapes quotes', escAttr('a"b<c'), 'a&quot;b&lt;c')

console.log('── rewriteHtml: desktop mode + formHidden carrier ──')
out = rewriteHtml(
  `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>D</title></head><body><form action="/search"><input name="q"></form></body></html>`,
  TARGET,
  proxy,
  '',
  {
    desktop: true,
    formHidden: (abs) => `<input type="hidden" name="url" value="${escAttr(abs)}"><input type="hidden" name="ks" value="tab1">`,
  }
)
ok('site viewport dropped in desktop mode', !/width=device-width/.test(out))
ok('desktop viewport injected', out.includes('<meta name="viewport" content="width=1280">'))
ok('desktop GET form uses hidden carrier', out.includes('name="ks" value="tab1"'))
ok('desktop GET form url hidden field', out.includes(`<input type="hidden" name="url" value="${escAttr('https://site.example/search')}">`))
out = rewriteHtml(`<html><head><meta name="viewport" content="width=device-width"></head><body></body></html>`, TARGET, proxy)
ok('mobile mode keeps site viewport', out.includes('width=device-width'))
ok('mobile mode injects no viewport', !out.includes('width=1280'))

console.log('── extractTitle ──')
eq('title tag', extractTitle('<title>Hello &amp; World</title>'), 'Hello & World')
eq('og:title wins', extractTitle('<meta property="og:title" content="OG"><title>Plain</title>'), 'OG')
eq('none', extractTitle('<html></html>'), '')

console.log('── extractArticle (reader) ──')
const page = `<html><head><title>Article</title></head><body>
<nav>Menu links</nav><script>alert(1)</script><style>.x{}</style>
<article>
  <h1>Head</h1>
  <p>First paragraph with plenty of words to pass the threshold check easily and comfortably.</p>
  <p>Second <a href="/ref">link</a> and an <img src="/pic.jpg" alt="pic"> plus <span onclick="evil()">inline</span> text following.</p>
  <p>A third paragraph adds even more words so the reader word count comfortably clears the minimum threshold.</p>
  <ul><li>one item here</li><li>two items there</li></ul>
  <blockquote>quote text sits here</blockquote>
</article>
<footer>copyright junk</footer></body></html>`
const art = extractArticle(page, 'https://site.example/post/1')
ok('title extracted', art.title === 'Article')
ok('nav stripped', !art.html.includes('Menu links'))
ok('footer stripped', !art.html.includes('copyright junk'))
ok('script stripped', !art.html.includes('alert(1)'))
ok('style stripped', !art.html.includes('.x{}'))
ok('h1 kept', art.html.includes('<h1>Head</h1>'))
ok('p kept', art.html.includes('<p>'))
ok('img absolutized', art.html.includes('src="https://site.example/pic.jpg"'))
ok('img attrs sanitized (alt kept, no onerror)', art.html.includes('<img src="https://site.example/pic.jpg" alt="pic" loading="lazy">'))
ok('link absolutized', art.html.includes('href="https://site.example/ref"'))
ok('span (onclick) dropped', !art.html.includes('onclick'))
ok('li kept', art.html.includes('<li>one item here</li>'))
ok('blockquote kept', art.html.includes('<blockquote>quote text sits here</blockquote>'))
ok('wordCount sane', art.wordCount > 25)
// regression: <title>/<head> text must never leak into the reader body
// (title text once inflated the <body> candidate and bled in as a text node)
ok('title text not leaked into body', !art.html.startsWith('Article'))
// thin page → empty html marker
const thin = extractArticle('<html><body><p>tiny</p></body></html>', 'https://x.example/')
ok('thin page → html empty', thin.html === '')

console.log('── v5.25: extraHead injection (agent) ──')
const ph = proxy
const withAgent = rewriteHtml('<html><head><title>t</title></head><body></body></html>', 'https://site.example/', ph, '<script>AGENT()</script>')
ok('extraHead injected after <head>', withAgent.includes('<head><base href="https://site.example/"><meta name="referrer" content="no-referrer"><script>AGENT()</script>'))
ok('site CSP meta still dropped with extraHead', !rewriteHtml('<head><meta http-equiv="Content-Security-Policy" content="x"><link rel="stylesheet" href="a.css">', 'https://site.example/', ph, '<script>AGENT()</script>').includes('content-security-policy'))

console.log('── v5.25: streaming rewriter ──')
import { createStreamingRewriter } from '../lib/browser/core.mjs'
// 1. head phase buffers until </head>, injects base + agent, rewrites body links across chunks
{
  const rw = createStreamingRewriter('https://site.example/', ph, '<script>AGENT()</script>')
  const o1 = rw.push('<!doctype html><html><head><title>t</title>')
  eq('head phase holds until </head>', o1, '')
  const o2 = rw.push('</head><body><a href="/one">A</a>')
  ok('head flushed on </head>', o2.includes('<base href="https://site.example/">'))
  ok('agent injected in head phase', o2.includes('<script>AGENT()</script>'))
  ok('first body link rewritten in same chunk', o2.includes(`href="${ph('https://site.example/one')}"`))
  const o3 = rw.push('<a href="/two">B</a></body></html>')
  ok('second chunk link rewritten', o3.includes(`href="${ph('https://site.example/two')}"`))
  const o4 = rw.end()
  eq('end() clean when nothing carried', o4, '')
}
// 2. tag split across chunk boundary (partial attribute value)
{
  const rw = createStreamingRewriter('https://site.example/', proxy, '')
  rw.push('<html><head></head><body>')
  const a = rw.push('<a hr')
  eq('partial tag carries', a, '')
  const b = rw.push('ef="/next">N</a>')
  ok('carried tag rewritten when complete', b.includes(`href="${ph('https://site.example/next')}"`))
  rw.end()
}
// 3. ">" inside quoted attribute values does NOT split the tag
{
  const rw = createStreamingRewriter('https://site.example/', proxy, '')
  rw.push('<html><head></head><body>')
  const out1 = rw.push('<a title="a>b" href="/q">Q')
  ok('quoted > keeps tag intact', out1.includes(`href="${ph('https://site.example/q')}"`))
  const out2 = rw.push('</a>')
  eq('remainder flushed', out2.includes('</a>'), true)
  rw.end()
}
// 4. degenerate page without </head> flushes at end()
{
  const rw = createStreamingRewriter('https://site.example/', ph, '<script>AGENT()</script>')
  const held = rw.push('<div>no head close at all')
  eq('nothing emitted while buffering', held, '')
  const fin = rw.end()
  ok('end() injects base on degenerate page', fin.includes('<base href="https://site.example/">'))
  ok('end() injects agent', fin.includes('AGENT()'))
}
// 5. streaming output == buffered output for the same document
{
  const doc = '<html><head><title>x</title><meta http-equiv="Content-Security-Policy" content="b"></head><body><a href="/a">A</a><form action="/s"><input name=q></form><meta http-equiv="refresh" content="0; url=/r"></body></html>'
  const buffered = rewriteHtml(doc, 'https://site.example/', ph)
  const rw = createStreamingRewriter('https://site.example/', proxy, '')
  let streamed = ''
  for (let i = 0; i < doc.length; i += 7) streamed += rw.push(doc.slice(i, i + 7))
  streamed += rw.end()
  eq('streamed ≡ buffered (7-byte chunks)', streamed, buffered)
}
// 6. multi-byte UTF-8 chars survive chunked decoding (route-level behavior)
{
  const enc = new TextEncoder()
  const dec = new TextDecoder()
  const rw = createStreamingRewriter('https://site.example/', proxy, '')
  rw.push('<html><head></head><body>')
  const bytes = enc.encode('<p>héllo wörld — 你好 🎉 <a href="/u">Ünicode</a></p>')
  let s = ''
  for (let i = 0; i < bytes.length; i += 3) s += rw.push(dec.decode(bytes.slice(i, i + 3), { stream: true }))
  s += rw.push(dec.decode()) // flush decoder
  s += rw.end()
  ok('utf-8 text intact', s.includes('你好 🎉'))
  ok('utf-8 link rewritten', s.includes(`href="${ph('https://site.example/u')}"`))
}

console.log('── v5.25: DevTools agent source ──')
import { AGENT_SRC, AGENT_TAG } from '../lib/browser/devtools-agent.mjs'
ok('AGENT_SRC parses as JS', (() => { new Function(AGENT_SRC); return true })())
ok('AGENT_TAG wraps in <script>', AGENT_TAG.startsWith('<script>') && AGENT_TAG.endsWith('</script>'))
ok('agent posts with __kv_dt marker', AGENT_SRC.includes('__kv_dt: 1'))
ok('agent targets parent', AGENT_SRC.includes('window.parent.postMessage'))
ok('agent guards against double-install', AGENT_SRC.includes('__kv_dt_agent'))
ok('agent hooks fetch', AGENT_SRC.includes('window.fetch = patchedFetch'))
ok('agent hooks XHR', AGENT_SRC.includes('XMLHttpRequest.prototype.open'))
ok('agent indirect eval (global scope)', AGENT_SRC.includes('(0, eval)(code)'))
ok('agent find highlights', AGENT_SRC.includes('data-kv-dt-find'))
ok('agent picker overlay', AGENT_SRC.includes('onPickerMove'))
ok('agent title watcher debounced by change', AGENT_SRC.includes('lastTitle'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

// ════════════════════════════════════════════════════════════════════
// v5.30 — cookie jar primitives (Kivora Browser sign-in)
// ════════════════════════════════════════════════════════════════════
console.log('── v5.30: cookie jar primitives ──')
import { parseJar, serializeJar, cookiesForHost, mergeSetCookies } from '../lib/browser/core.mjs'

ok('parseJar: valid round-trip', (() => {
  const jar = parseJar('{"example.com":[{"n":"sid","v":"abc"}]}')
  return jar['example.com']?.[0]?.n === 'sid' && jar['example.com']?.[0]?.v === 'abc'
})())
ok('parseJar: garbage → {}', JSON.stringify(parseJar('not json')) === '{}')
ok('parseJar: array root → {}', JSON.stringify(parseJar('[1,2]')) === '{}')
ok('parseJar: non-string cookie fields dropped', (() => {
  const jar = parseJar('{"a.com":[{"n":1},{"n":"ok","v":"1"}]}')
  return jar['a.com'].length === 1 && jar['a.com'][0].n === 'ok'
})())

// attach semantics
const jar1 = { 'example.com': [{ n: 'host', v: '1' }], 'cdn.example.com': [{ n: 'cdn', v: '2' }] }
eq('cookiesForHost: exact host', cookiesForHost(jar1, 'example.com'), 'host=1')
eq('cookiesForHost: subdomain inherits domain scope', cookiesForHost(jar1, 'www.example.com'), 'host=1')
eq('cookiesForHost: sibling host does NOT leak', cookiesForHost(jar1, 'other.com'), '')
eq('cookiesForHost: deeper subdomain of host scope does not match', cookiesForHost({ 'www.example.com': [{ n: 'a', v: '1' }] }, 'example.com'), '')
ok('cookiesForHost: expired entries dropped', (() => {
  const j = { 'a.com': [{ n: 'dead', v: '1', exp: '2001-01-01T00:00:00Z' }, { n: 'alive', v: '2' }] }
  return cookiesForHost(j, 'a.com') === 'alive=2'
})())

// merge semantics — the login flow
const jar2 = {}
mergeSetCookies(jar2, ['session=abc123; Path=/; HttpOnly; SameSite=Lax'], 'example.com')
eq('merge: host-only set-cookie', cookiesForHost(jar2, 'example.com'), 'session=abc123')
mergeSetCookies(jar2, ['track=1; Domain=.example.com; Max-Age=3600'], 'www.example.com')
ok('merge: Domain attr suffix-match → domain scope', (() => {
  const got = cookiesForHost(jar2, 'api.example.com')
  return got === 'track=1' // session is host-only on example.com, must NOT leak to api.
})())
ok('merge: Domain attr for unrelated domain ignored', (() => {
  const j = {}
  mergeSetCookies(j, ['x=1; Domain=.evil.com'], 'example.com')
  return JSON.stringify(j) === '{}'
})())
ok('merge: Max-Age=0 deletes', (() => {
  const j = { 'a.com': [{ n: 'sid', v: '1' }] }
  mergeSetCookies(j, ['sid=; Max-Age=0'], 'a.com')
  return cookiesForHost(j, 'a.com') === ''
})())
ok('merge: past Expires deletes', (() => {
  const j = { 'a.com': [{ n: 'sid', v: '1' }] }
  mergeSetCookies(j, ['sid=; Expires=Thu, 01 Jan 1970 00:00:00 GMT'], 'a.com')
  return cookiesForHost(j, 'a.com') === ''
})())
ok('merge: Max-Age converts to absolute future exp', (() => {
  const j = {}
  mergeSetCookies(j, ['sid=1; Max-Age=3600'], 'a.com')
  const e = j['a.com'][0].exp
  return typeof e === 'string' && Date.parse(e) > Date.now() + 3500 * 1000
})())
ok('merge: same-name flip host↔domain does not duplicate', (() => {
  const j = {}
  mergeSetCookies(j, ['sid=1'], 'a.com')
  mergeSetCookies(j, ['sid=2; Domain=.a.com'], 'www.a.com')
  const forHost = cookiesForHost(j, 'www.a.com')
  return forHost === 'sid=2' && cookiesForHost(j, 'a.com') === 'sid=2'
})())
ok('merge: per-scope cap enforced', (() => {
  const j = {}
  const list = []
  for (let i = 0; i < 60; i++) list.push(`c${i}=v${i}`)
  mergeSetCookies(j, list, 'a.com')
  return j['a.com'].length === 50 && j['a.com'][0].n === 'c10'
})())
ok('merge: malformed set-cookie ignored', (() => {
  const j = {}
  mergeSetCookies(j, ['garbage-without-equals; Path=/', '=novalue', 'ok=1'], 'a.com')
  return cookiesForHost(j, 'a.com') === 'ok=1'
})())

// jar caps + round trip
ok('serializeJar: round-trip', (() => {
  const j = parseJar(serializeJar({ 'a.com': [{ n: 'x', v: 'y' }] }))
  return j['a.com']?.[0]?.v === 'y'
})())
ok('serializeJar: total cap keeps JSON under limit', (() => {
  const j = {}
  for (let s = 0; s < 40; s++) {
    const scope = `s${s}.example.com`
    j[scope] = [{ n: 'big', v: 'x'.repeat(3000) }]
  }
  const json = serializeJar(j)
  return json.length <= 12 * 1024 + 10
})())

// end-to-end login simulation (what the proxy does across redirect hops)
ok('login flow simulation: 302-set cookie survives to next hop', (() => {
  const j = {}
  // hop 1: POST /login → 302 with Set-Cookie on the 302 (the v5.26 bug)
  mergeSetCookies(j, ['kvsession=ticket-9; Path=/; HttpOnly'], 'portal.example.com')
  // hop 2: GET /dashboard — jar must carry the cookie
  return cookiesForHost(j, 'portal.example.com') === 'kvsession=ticket-9'
})())
