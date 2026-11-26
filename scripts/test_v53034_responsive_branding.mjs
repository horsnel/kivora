#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v53034_responsive_branding.mjs — v5.30.34 "Responsive Branding"
// (text on pages, icon-only in sidebars), amended by v5.30.35: the chat
// sidebar drops ALL header furniture (mark, close, +) — the conversation
// list IS the content.
//
// Spec:
//   1. Nav drawer: red K mark ONLY (32px box, no wordmark), links home,
//      aria-labelled for accessibility.
//   2. Chat-history sidebar: NO logo, NO close X, NO + beside search —
//      header stripped entirely; mobile closes via overlay tap /
//      conversation selection; new chat lives in the main top bar.
//   3. Main-page mobile bar: hamburger + red "Kivora" wordmark (text on
//      pages), hidden while the drawer is open so they never stack.
//   4. Chat page stays brand-free: no wordmark, no K mark anywhere in
//      ChatClient; conversation title remains centered in the top bar.
//   5. Consistency: the drawer mark keeps the #dc2626 red + K SVG shape.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from 'fs'

let pass = 0, fail = 0
const ok = (label, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

const nb = readFileSync('components/Navbar.jsx', 'utf8')
const cc = readFileSync('app/chat/ChatClient.jsx', 'utf8')

// Slice a full JSX link block: from the <Link opening tag before the
// anchor to the next closing </Link>
const blockAround = (src, anchor) => {
  const i = src.indexOf(anchor)
  if (i === -1) return null
  const start = src.lastIndexOf('<Link', i)
  const end = src.indexOf('</Link>', i)
  return (start === -1 || end === -1 || start > i) ? null : src.slice(start, end)
}

const K_PATH = 'M16 4L6 24L16 18Z'

// ── 1. Nav drawer: icon-only ────────────────────────────────────────
console.log('── nav drawer: icon-only mark ──')
const drawerLink = blockAround(nb, 'aria-label="Kivora home"')
ok('nav drawer: link carries accessible name', !!drawerLink)
ok('nav drawer: red K mark sized 32px (w-8 h-8)', !!drawerLink && drawerLink.includes('w-8 h-8 bg-[#dc2626]'))
ok('nav drawer: inner K svg scaled to 16px', !!drawerLink && drawerLink.includes('width="16" height="16" viewBox="0 0 32 32"'))
ok('nav drawer: wordmark removed (icon only)', !!drawerLink && !drawerLink.includes('Ki<span'))
ok('nav drawer: old 28px mark replaced', !!drawerLink && !drawerLink.includes('w-7 h-7'))
ok('nav drawer: mark links home', !!drawerLink && drawerLink.includes('href="/"'))

// ── 2. Main pages: hamburger + red wordmark ─────────────────────────
console.log('── main pages: hamburger + red wordmark ──')
ok('mobile bar: wordmark beside hamburger', /aria-label="Open sidebar"[\s\S]{0,300}Ki<span className="text-red-500">vora<\/span>/.test(nb))
ok('mobile bar: wordmark is red-accented (text-red-500)', /aria-label="Open sidebar"[\s\S]{0,300}text-red-500/.test(nb))
ok('mobile bar: hidden while drawer is open', /!\s*mobileOpen && \([\s\S]{0,500}aria-label="Open sidebar"/.test(nb))
ok('wordmark inventory: dead minimal branch (2) + live bar (1)', (nb.match(/Ki<span className="text-red-500">vora<\/span>/g) || []).length === 3)

// ── 3. Chat-history sidebar: header stripped (v5.30.35) ─────────────
console.log('── chat-history sidebar: header stripped ──')
ok('chat sidebar: logo mark removed', !cc.includes('aria-label="Kivora home"') && !cc.includes('bg-[#dc2626] rounded-lg'))
ok('chat sidebar: X (close) removed', !cc.includes('Close conversations'))
ok('chat sidebar: + beside search removed', !cc.includes('aria-label="New chat"'))
ok('chat sidebar: search input intact', cc.includes("placeholder={t('chat.search_conversations') || 'Search conversations'}"))
ok('chat sidebar: search input layout simplified (no flex sibling row)', !cc.includes('flex-1 min-w-0">\n              <IconSearch size={13}'))
ok('mobile close path survives (overlay tap)', /bg-black\/50 backdrop-blur-sm z-40 lg:hidden" onClick=\{\(\) => setHistoryOpen\(false\)\}/.test(cc))
ok('new chat still in main top bar (t(\'chat.new\'))', cc.includes("aria-label={t('chat.new')}"))

// ── 4. Chat page stays brand-free ───────────────────────────────────
console.log('── chat page stays brand-free ──')
ok('no wordmark anywhere in ChatClient', !cc.includes('Ki<span className="text-red-500">vora</span>'))
ok('no K mark shape anywhere in ChatClient', !cc.includes(`d="${K_PATH}"`))
ok('conversation title still centered in top bar', cc.includes('data-chat-title="true"'))
ok('chat excluded from shared sidebar (NO_SIDEBAR)', nb.includes("'/auth', '/', '/onboarding', '/chat'"))

// ── 5. Brand consistency ────────────────────────────────────────────
console.log('── brand consistency across surfaces ──')
ok('drawer mark keeps the red (#dc2626)', /bg-\[#dc2626\] rounded-lg/.test(nb) && !/bg-\[#dc2626\] rounded-lg/.test(cc))
ok('drawer mark keeps the K shape', nb.includes(`d="${K_PATH}"`) && !cc.includes(`d="${K_PATH}"`))
ok('drawer mark is the only icon-only mark (aria-label ×1)', (nb.match(/aria-label="Kivora home"/g) || []).length === 1 && !cc.includes('aria-label="Kivora home"'))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
