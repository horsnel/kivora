#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v53034_responsive_branding.mjs — v5.30.34: "Responsive Branding"
// (text on pages, icon-only in sidebars).
//
// Spec:
//   1. Nav drawer: red K mark ONLY (32px box, no wordmark), links home,
//      aria-labelled for accessibility.
//   2. Chat-history sidebar: red K mark ONLY on the left, X (close) on
//      the right, the small + stays beside the search bar.
//   3. Main-page mobile bar: hamburger + red "Kivora" wordmark (text on
//      pages), hidden while the drawer is open so they never stack.
//   4. Chat page stays logo-free: no wordmark anywhere in ChatClient,
//      conversation title remains centered in the top bar.
//   5. Consistency: same #dc2626 red + same K SVG shape on every mark.
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

// ── 3. Chat-history sidebar: icon-only ──────────────────────────────
console.log('── chat-history sidebar: icon-only mark ──')
const chatLink = blockAround(cc, 'aria-label="Kivora home"')
ok('chat sidebar: link carries accessible name', !!chatLink)
ok('chat sidebar: red K mark sized 32px (w-8 h-8)', !!chatLink && chatLink.includes('w-8 h-8 bg-[#dc2626]'))
ok('chat sidebar: wordmark removed (icon only)', !!chatLink && !chatLink.includes('Ki<span'))
ok('chat sidebar: old 28px mark replaced', !!chatLink && !chatLink.includes('w-7 h-7'))
ok('chat sidebar: X (close) on the right', /aria-label="Close conversations"[\s\S]{0,220}<IconClose size=\{16\} \/>/.test(cc))
ok('chat sidebar: + stays beside search bar', /Search conversations[\s\S]{0,900}aria-label="New chat"/.test(cc))

// ── 4. Chat page stays logo-free ────────────────────────────────────
console.log('── chat page stays logo-free ──')
ok('no wordmark anywhere in ChatClient', !cc.includes('Ki<span className="text-red-500">vora</span>'))
ok('conversation title still centered in top bar', cc.includes('data-chat-title="true"'))
ok('chat excluded from shared sidebar (NO_SIDEBAR)', nb.includes("'/auth', '/', '/onboarding', '/chat'"))

// ── 5. Brand consistency ────────────────────────────────────────────
console.log('── brand consistency across surfaces ──')
ok('same red (#dc2626) on both sidebar marks', /bg-\[#dc2626\] rounded-lg/.test(cc) && /bg-\[#dc2626\] rounded-lg/.test(nb))
ok('same K shape on every mark', cc.includes(`d="${K_PATH}"`) && nb.includes(`d="${K_PATH}"`))
ok('aria-label on every icon-only mark (1 each)', (cc.match(/aria-label="Kivora home"/g) || []).length === 1 && (nb.match(/aria-label="Kivora home"/g) || []).length === 1)

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
