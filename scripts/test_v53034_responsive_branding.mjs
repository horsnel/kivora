#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v53034_responsive_branding.mjs — v5.30.34 "Responsive Branding"
// (text on pages, icon-only in sidebars), amended by v5.30.35 (chat
// sidebar header stripped), v5.30.36 (drawer mark links /research +
// invisible spacer), and v5.30.38 (user: the chat sidebar gets its REAL
// K-icon header back, plus the Search Hub — the invisible spacer is
// replaced by the real header, alignment preserved by construction).
//
// Spec (current, after v5.30.38 amendments):
//   1. Nav drawer: red K mark ONLY (32px box, no wordmark), links
//      /research, aria-labelled. NO Search Hub in this sidebar.
//   2. Chat-history sidebar: real K-icon header (same 64px geometry as
//      the drawer) → Search Hub (replaces the old search box) →
//      history; NO close X, NO +; mobile closes via overlay tap /
//      conversation selection; new chat lives in the main top bar.
//   3. Main-page mobile bar: hamburger + red "Kivora" wordmark (text on
//      pages), hidden while the drawer is open so they never stack.
//   4. Chat page top bar stays wordmark-free; conversation title remains
//      centered. The K mark shape now lives in the chat sidebar header.
//   5. Consistency: both marks share the #dc2626 red + K SVG shape; the
//      drawer logo remains the only brand LINK (chat mark is static).
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

// ── 1. Nav drawer: icon-only, no Search Hub ─────────────────────────
console.log('── nav drawer: icon-only mark ──')
const drawerLink = blockAround(nb, 'aria-label="Kivora research"')
ok('nav drawer: link carries accessible name', !!drawerLink)
ok('nav drawer: red K mark sized 32px (w-8 h-8)', !!drawerLink && drawerLink.includes('w-8 h-8 bg-[#dc2626]'))
ok('nav drawer: inner K svg scaled to 16px', !!drawerLink && drawerLink.includes('width="16" height="16" viewBox="0 0 32 32"'))
ok('nav drawer: wordmark removed (icon only)', !!drawerLink && !drawerLink.includes('Ki<span'))
ok('nav drawer: mark links to /research (v5.30.36)', !!drawerLink && drawerLink.includes('href="/research"'))
ok('nav drawer: NO Search Hub (v5.30.38 — drawer untouched)', !nb.includes('SidebarSearchHub'))

// ── 2. Main pages: hamburger + red wordmark ─────────────────────────
console.log('── main pages: hamburger + red wordmark ──')
ok('mobile bar: wordmark beside hamburger', /aria-label="Open sidebar"[\s\S]{0,300}Ki<span className="text-red-500">vora<\/span>/.test(nb))
ok('mobile bar: wordmark is red-accented (text-red-500)', /aria-label="Open sidebar"[\s\S]{0,300}text-red-500/.test(nb))
ok('mobile bar: hidden while drawer is open', /!\s*mobileOpen && \([\s\S]{0,500}aria-label="Open sidebar"/.test(nb))
ok('wordmark inventory: dead minimal branch (2) + live bar (1)', (nb.match(/Ki<span className="text-red-500">vora<\/span>/g) || []).length === 3)

// ── 3. Chat-history sidebar: K header + Search Hub (v5.30.38) ───────
console.log('── chat-history sidebar: K header + Search Hub ──')
ok('chat sidebar: real K mark restored (v5.30.38 user request)', cc.includes('bg-[#dc2626] rounded-lg'))
ok('chat sidebar: X (close) still removed', !cc.includes('Close conversations'))
ok('chat sidebar: + beside search still removed', !cc.includes('aria-label="New chat"'))
ok('chat sidebar: old search box replaced by the hub (controlled)', !cc.includes("t('chat.search_conversations')") && cc.includes('<SidebarSearchHub value={convSearch} onChange={setConvSearch} />'))
ok('chat sidebar: real 64px K header replaces the invisible spacer', /v5\.30\.38 — real K-icon header[\s\S]{0,700}<div className="px-3 pt-3 pb-2 shrink-0">\n          <span className="w-8 h-8 mb-3 bg-\[#dc2626\] rounded-lg/.test(cc) && !cc.includes('aria-hidden="true">\n          <div className="h-8 mb-3" />'))
ok('chat sidebar: hub sits between Explore and the history list',
  cc.indexOf('{/* ── Explore link ── */}') < cc.indexOf('<SidebarSearchHub value={convSearch}') &&
  cc.indexOf('<SidebarSearchHub value={convSearch}') < cc.indexOf('{/* ── Conversation list ── */}'))
ok('mobile close path survives (overlay tap)', /bg-black\/50 backdrop-blur-sm z-40 lg:hidden" onClick=\{\(\) => setHistoryOpen\(false\)\}/.test(cc))
ok('new chat still in main top bar (t(\'chat.new\'))', cc.includes("aria-label={t('chat.new')}"))

// ── 4. Chat page top bar stays wordmark-free ────────────────────────
console.log('── chat page top bar stays wordmark-free ──')
ok('no wordmark anywhere in ChatClient', !cc.includes('Ki<span className="text-red-500">vora</span>'))
ok('K mark shape now lives in the chat sidebar header (v5.30.38)', cc.includes(`d="${K_PATH}"`))
ok('conversation title still centered in top bar', cc.includes('data-chat-title="true"'))
ok('chat excluded from shared sidebar (NO_SIDEBAR)', nb.includes("'/auth', '/', '/onboarding', '/chat'"))

// ── 5. Brand consistency ────────────────────────────────────────────
console.log('── brand consistency across surfaces ──')
ok('drawer + chat marks share the red (#dc2626)', /bg-\[#dc2626\] rounded-lg/.test(nb) && /bg-\[#dc2626\] rounded-lg/.test(cc))
ok('drawer + chat marks share the K shape', nb.includes(`d="${K_PATH}"`) && cc.includes(`d="${K_PATH}"`))
ok('drawer mark is still the only brand LINK (aria-label ×1)', (nb.match(/aria-label="Kivora research"/g) || []).length === 1 && !cc.includes('aria-label="Kivora research"'))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
