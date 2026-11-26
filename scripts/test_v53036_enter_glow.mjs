#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v53036_enter_glow.mjs — v5.30.36: mobile Enter fix + glow gating
// + retry clipping + logo target.
//
// Covers:
//   1. Enter = newline in every prompt composer (mobile fix): no
//      Enter-send keydown handlers; collapsed single-line fields are
//      real <textarea>s; sending happens only via the send buttons.
//   2. Widen/expand buttons removed from all text bars (chat collapsed
//      pill + expanded toolbar, research collapsed pill + toolbar,
//      greeting bar); tallEditor/editorMax state gone.
//   3. Glow border spins ONLY while a task runs: base ::before rules
//      have no animation; a .bar-busy-gated rule carries it; containers
//      get bar-busy from loading (chat) / isResearching (research).
//   4. Retry/rerun action row no longer clipped: message list container
//      gained bottom padding (pt-6 pb-12) + the bar's own pb bumped.
//   5. Drawer K mark links to /research (not the landing page).
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from 'fs'

let pass = 0, fail = 0
const ok = (label, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

const cc = readFileSync('app/chat/ChatClient.jsx', 'utf8')
const rc = readFileSync('app/research/ResearchClient.jsx', 'utf8')
const rp = readFileSync('app/research/page.jsx', 'utf8')
const nb = readFileSync('components/Navbar.jsx', 'utf8')

// ── 1. Enter = newline ──────────────────────────────────────────────
console.log('── enter = newline in every composer ──')
const ENTER_SEND = /if \(e\.key === 'Enter' && !e\.shiftKey\)/
ok('chat: no Enter-send handlers left', !ENTER_SEND.test(cc))
ok('research client: no Enter-send handlers left', !ENTER_SEND.test(rc))
ok('research page: no Enter-send handlers left', !ENTER_SEND.test(rp))
ok('research dialogue: Enter no longer submits', !rc.includes('submitDialogue(dialogueInput) } }'))
ok('chat collapsed field is a <textarea>', cc.includes('<textarea\n                    ref={collapsedInputRef}'))
ok('research collapsed field is a <textarea> (client)', rc.includes('<textarea\n                    ref={collapsedInputRef}'))
ok('research collapsed field is a <textarea> (page)', rp.includes('<textarea\n                      ref={collapsedInputRef}'))
ok('collapsed textareas keep vertical centering helpers', (cc.match(/resize-none overflow-hidden pt-\[7px\]/g) || []).length === 1
  && (rc.match(/resize-none overflow-hidden pt-\[7px\]/g) || []).length === 1
  && (rp.match(/resize-none overflow-hidden pt-\[7px\]/g) || []).length === 1)
ok('send buttons still the only send path (chat)', cc.includes('onClick={() => send()}'))
ok('send buttons still the only send path (research)', rc.includes('onClick={handleSubmit}') && rp.includes('onClick={handleSubmit}'))

// ── 2. Widen/expand controls removed ────────────────────────────────
console.log('── widen/expand controls removed ──')
ok('no widen/shrink labels in chat', !cc.includes('Widen editor') && !cc.includes('Shrink editor'))
ok('no widen/shrink labels in research client', !rc.includes('Widen editor') && !rc.includes('Shrink editor'))
ok('no widen/shrink labels in research page', !rp.includes('Widen editor') && !rp.includes('Shrink editor'))
ok('no expand-on-click buttons left in chat', !cc.includes("onClick={() => setBarExpanded(true)}"))
ok('no expand-on-click buttons left in research client', !rc.includes("onClick={() => setBarExpanded(true)}"))
ok('no expand-on-click buttons left in research page', !rp.includes("onClick={() => setBarExpanded(true)}"))
ok('tallEditor/editorMax state fully gone', !cc.includes('tallEditor') && !cc.includes('editorMax')
  && !rc.includes('tallEditor') && !rc.includes('editorMax')
  && !rp.includes('tallEditor') && !rp.includes('editorMax'))
ok('focus-expands still intact (tap field → full editor)', cc.includes('onFocus={() => setBarExpanded(true)}')
  && rc.includes('onFocus={() => setBarExpanded(true)}')
  && rp.includes('onFocus={() => setBarExpanded(true)}'))

// ── 3. Glow spins only while busy ───────────────────────────────────
console.log('── glow border gated on task execution ──')
ok('chat: exactly one spin rule, gated on .bar-busy', (cc.match(/animation: bar-angle-spin/g) || []).length === 1
  && cc.includes('.chat-bar-collapsed.bar-busy::before') && cc.includes('.chat-container-expanded.bar-busy::before'))
ok('research client: exactly one spin rule, gated on .bar-busy', (rc.match(/animation: bar-angle-spin/g) || []).length === 1
  && rc.includes('.research-bar-collapsed.bar-busy::before') && rc.includes('.research-container-expanded.bar-busy::before'))
ok('research page: exactly one spin rule, gated on .bar-busy', (rp.match(/animation: bar-angle-spin/g) || []).length === 1
  && rp.includes('.research-bar-collapsed.bar-busy::before') && rp.includes('.chat-container-expanded.bar-busy::before'))
ok('chat containers toggle bar-busy on loading', cc.includes('{`chat-bar-collapsed${loading ? \' bar-busy\' : \'\'}`}')
  && cc.includes('{`chat-container-expanded${loading ? \' bar-busy\' : \'\'}`} ref={chatBarRef}>'))
ok('research client containers toggle bar-busy on isResearching', rc.includes('{`research-bar-collapsed${isResearching ? \' bar-busy\' : \'\'}`}')
  && rc.includes('{`research-container-expanded${isResearching ? \' bar-busy\' : \'\'}`}'))
ok('research page containers toggle bar-busy on isResearching (×3)',
  (rp.match(/isResearching \? ' bar-busy' : ''/g) || []).length === 3)

// ── 4. Retry row not clipped ────────────────────────────────────────
console.log('── retry/action row clipping fix ──')
ok('message list: pt-6 pb-12 bottom room', cc.includes('max-w-[960px] mx-auto px-[min(5vw,48px)] pt-6 pb-12 space-y-4'))
ok('action bar: pb-1.5 (was pb-1)', cc.includes('mt-2 pb-1.5 flex items-center gap-3 overflow-visible'))
ok('rerun button still present in the action bar', cc.includes('data-ab="rerun"'))

// ── 5. Drawer mark targets /research ────────────────────────────────
console.log('── drawer logo target ──')
ok('drawer K mark links to /research', nb.includes('<Link href="/research" className="flex items-center" onClick={onClose} title="Kivora" aria-label="Kivora research">'))
ok('no landing-page href left on the drawer mark', !nb.includes('<Link href="/" className="flex items-center"'))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
