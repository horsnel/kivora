#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v53038_search_hub_chat.mjs — v5.30.38: Search Hub in the CHAT
// HISTORY SIDEBAR only (user fix after v5.30.37 wrongly put it in the
// nav drawer — that commit was reverted).
//
// Spec (user, post-revert):
//   1. Nav drawer (Main Menu): logo, nav links, USD/English/Dashboard/
//      Profile footer — NO Search Hub anywhere in it.
//   2. Chat history sidebar: real K-icon header → Search Hub (pill
//      input + side-by-side filter pills) → history (Today/This Week)
//      → Settings + profile footer (already present, untouched).
//   3. Pills CANNOT overflow the sidebar: equal flex-1 thirds on one
//      line, no wrap, no horizontal scroll, no clipping.
//   4. Hub input is controlled — wired to convSearch so typing filters
//      the conversation history exactly like the old search box.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from 'fs'

let pass = 0, fail = 0
const ok = (label, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

const hub = readFileSync('components/SidebarSearchHub.jsx', 'utf8')
const cc = readFileSync('app/chat/ChatClient.jsx', 'utf8')
const nb = readFileSync('components/Navbar.jsx', 'utf8')

// ── 1. Hub component per spec ───────────────────────────────────────
console.log('── search hub component (spec classes) ──')
ok('input: pill shape (rounded-full, bg-[#161616], border-gray-700, py-3.5)', hub.includes('rounded-full bg-[#161616] border border-gray-700 py-3.5 pl-11 pr-4'))
ok('input: red focus border + subtle ring', hub.includes('focus:border-red-500 focus:ring-1 focus:ring-red-500'))
ok('input: magnifying glass on the left (absolute left-3.5)', hub.includes('<circle cx="11" cy="11" r="8" />') && hub.includes('absolute left-3.5'))
ok('input: controlled (value/onChange) — filters conversations live', hub.includes('value={value}') && hub.includes('onChange?.('))
ok('hub does no routing (stays in the chat sidebar, no useRouter)', !hub.includes('useRouter') && !hub.includes('router.push'))
ok('pills: three filters Recent/Starred/Coding', hub.includes("label: 'Recent'") && hub.includes("label: 'Starred'") && hub.includes("label: 'Coding'"))
ok('pills: equal flex-1 thirds — cannot overflow (flex-1 min-w-0, one line)', hub.includes('flex flex-nowrap gap-2 w-full') && hub.includes('flex-1 min-w-0') && !hub.includes('overflow-x-auto'))
ok('pills: small text (text-[11px]) + pill shape (rounded-full)', hub.includes('text-[11px] leading-4 font-medium') && hub.split('rounded-full').length >= 3)
ok('Starred pill carries the tiny yellow star', hub.includes("f.id === 'starred'") && hub.includes('text-yellow-400') && hub.includes('M12 2l3.09 6.26'))

// ── 2. Chat history sidebar wiring ──────────────────────────────────
console.log('── chat history sidebar wiring ──')
ok('hub imported into ChatClient', cc.includes("import SidebarSearchHub from '@/components/SidebarSearchHub'"))
ok('hub wired to convSearch (old search state, no regression)', cc.includes('<SidebarSearchHub value={convSearch} onChange={setConvSearch} />'))
ok('old search-conversations box removed', !cc.includes('t(\'chat.search_conversations\')'))
ok('K header → Explore → Hub → list → Settings order',
  cc.indexOf('v5.30.38 — real K-icon header') < cc.indexOf('{/* ── Explore link ── */}') &&
  cc.indexOf('{/* ── Explore link ── */}') < cc.indexOf('<SidebarSearchHub value={convSearch}') &&
  cc.indexOf('<SidebarSearchHub value={convSearch}') < cc.indexOf('{/* ── Conversation list ── */}') &&
  cc.indexOf('{/* ── Conversation list ── */}') < cc.indexOf('Settings toggle + Profile avatar'))
ok('history groups intact (filteredHistory, Today/This Week via i18n)', cc.includes('filteredHistory.map(group =>') && cc.includes('group.labelKey'))
ok('footer intact (Settings + profile avatar)', cc.includes('Settings toggle + Profile avatar — pinned to bottom') && cc.includes('<UserAvatar user={user} size={28} />'))
ok('invisible spacer machinery fully gone', !cc.includes('invisible alignment spacer') && !cc.includes('h-[50px]'))

// ── 3. Nav drawer untouched ─────────────────────────────────────────
console.log('── nav drawer untouched ──')
ok('Navbar has NO trace of the hub (reverted + kept out)', !nb.includes('SidebarSearchHub') && !nb.includes('Search Hub'))
ok('drawer structure: logo → nav links → currency/language → auth',
  nb.indexOf('aria-label="Kivora research"') < nb.indexOf('<NavLinks pathname={pathname} onClose={onClose} user={user} />') &&
  nb.indexOf('<NavLinks pathname={pathname} onClose={onClose} user={user} />') < nb.indexOf('Auth section — pinned to bottom'))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
