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
ok('form action proxied', out.includes(`action="/api/browser/proxy?url=${encodeURIComponent('https://site.example/submit')}"`))
ok('action-less form got proxy action', (out.match(/<form action="/g) || []).length === 2)
// meta refresh
out = rewriteHtml(`<meta http-equiv="refresh" content="0; url=/landing">`, TARGET, proxy)
ok('meta refresh url proxied', out.includes(encodeURIComponent('https://site.example/landing')))
out = rewriteHtml(`<html><head></head></html>`, 'https://x.example/a?b=1', proxy)
ok('base escapes query', out.includes(`<base href="https://x.example/a?b=1">`))
ok('escAttr escapes quotes', escAttr('a"b<c'), 'a&quot;b&lt;c')

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

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
