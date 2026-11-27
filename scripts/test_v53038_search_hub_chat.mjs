#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v53038_search_hub_chat.mjs — v5.30.38: Search Hub in the CHAT
// HISTORY SIDEBAR only (user fix after v5.30.37 wrongly put it in the
// nav drawer — that commit was reverted). Amended by v5.30.39:
// platform-matched pill styling + FUNCTIONAL filters.
//
// Spec (user, current):
//   1. Nav drawer (Main Menu): logo, nav links, USD/English/Dashboard/
//      Profile footer — NO Search Hub anywhere in it.
//   2. Chat history sidebar: real K-icon header → Search Hub (pill
//      input + filter pills) → history (Today/This Week) → Settings +
//      profile footer (already present, untouched).
//   3. Pills CANNOT overflow the sidebar: equal flex-1 thirds on one
//      line, no wrap, no horizontal scroll, no clipping.
//   4. Hub input is controlled — wired to convSearch (live filtering).
//   5. v5.30.39 restyle: pills lose the grey outline (bg-[#161616],
//      rounded-xl, NOT rounded-full), active = bg-red-500/10 + red text
//      (no border), hover brightens grey (hover:bg-[#222]).
//   6. v5.30.39 function: pills drive the list via activeFilter/
//      onFilterChange → hubFilter; Starred = sessionMeta flag with a
//      Star/Unstar action in the long-press sheet + yellow row star;
//      Recent = last 7 days; Coding = title-keyword heuristic.
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
ok('pills: three filters Recent/Starred/Coding', hub.includes("label: 'Recent'") && hub.includes("label: 'Starred'") && hub.includes("label: 'Coding'"))
ok('pills: equal flex-1 thirds — cannot overflow (flex-1 min-w-0, one line)', hub.includes('flex flex-nowrap gap-2 w-full') && hub.includes('flex-1 min-w-0') && !hub.includes('overflow-x-auto'))
ok('pills: outline dropped (v5.30.39 — no grey bubble border)', !hub.includes('border-gray-600') && hub.includes('bg-[#161616] text-gray-300 hover:bg-[#222]') && !/rounded-xl px-2 py-1\.5 text-\[11px\][^`]*border /.test(hub))
ok('pills: rounded-xl — distinct from the strict pill input', hub.includes('rounded-xl px-2 py-1.5'))
ok('pills: active = subtle red tint + red text, no border (v5.30.39)', hub.includes("activeFilter === f.id\n                ? 'bg-red-500/10 text-red-400'"))
ok('pills: small text (text-[11px])', hub.includes('text-[11px] leading-4 font-medium'))
ok('Starred pill carries the tiny yellow star', hub.includes("f.id === 'starred'") && hub.includes('text-yellow-400') && hub.includes('M12 2l3.09 6.26'))
ok('pills are functional (controlled filter API, no local state)', hub.includes('{ value, onChange, activeFilter, onFilterChange }') && hub.includes("activeFilter === f.id ? null : f.id") && !hub.includes("import { useState }"))

// ── 2. Chat history sidebar wiring ──────────────────────────────────
console.log('── chat history sidebar wiring ──')
ok('hub imported into ChatClient', cc.includes("import SidebarSearchHub from '@/components/SidebarSearchHub'"))
ok('hub wired to convSearch AND hubFilter (v5.30.39)', cc.includes('<SidebarSearchHub value={convSearch} onChange={setConvSearch} activeFilter={hubFilter} onFilterChange={setHubFilter} />'))
ok('old search-conversations box removed', !cc.includes("t('chat.search_conversations')"))
ok('K header → Explore → Hub → list → Settings order',
  cc.indexOf('v5.30.38 — real K-icon header') < cc.indexOf('{/* ── Explore link ── */}') &&
  cc.indexOf('{/* ── Explore link ── */}') < cc.indexOf('<SidebarSearchHub value={convSearch}') &&
  cc.indexOf('<SidebarSearchHub value={convSearch}') < cc.indexOf('{/* ── Conversation list ── */}') &&
  cc.indexOf('{/* ── Conversation list ── */}') < cc.indexOf('Settings toggle + Profile avatar'))
ok('history groups intact (filteredHistory, Today/This Week via i18n)', cc.includes('filteredHistory.map(group =>') && cc.includes('group.labelKey'))
ok('footer intact (Settings + profile avatar)', cc.includes('Settings toggle + Profile avatar — pinned to bottom') && cc.includes('<UserAvatar user={user} size={28} />'))
ok('invisible spacer machinery fully gone', !cc.includes('invisible alignment spacer') && !cc.includes('h-[50px]'))

// ── 3. Functional filters (v5.30.39) ────────────────────────────────
console.log('── functional filters ──')
ok('hubFilter state + pills narrow filteredHistory', cc.includes("const [hubFilter, setHubFilter] = useState(null)") && cc.includes("hubFilter === 'starred') base = base.filter(isSessionStarred)"))
ok('Recent = last 7 days by updated_at (same source as groupByDate)', cc.includes("s.updated_at || s.created_at") && cc.includes('7 * 86400000'))
ok('Starred = sessionMeta flag, same pattern as pinned', cc.includes("sessionMeta[s.id]?.starred ?? s.starred"))
ok('Star/Unstar action in the long-press sheet', cc.includes('toggleSessionStar') && cc.includes("persistSessionMeta(sessionAction.sid, { starred: next })") && cc.includes("t('chat.session.star')"))
ok('starred rows wear a yellow star marker', cc.includes('isSessionStarred(s) ? (') && cc.includes('text-[#facc15]'))
ok('Coding = title-keyword heuristic (no invented metadata)', cc.includes('CODING_TITLE_RE') && cc.includes('isCodingSession'))
ok('filter-aware empty states (starred/coding/recent)', cc.includes('const historyEmptyLabel') && cc.includes('No starred conversations yet') && cc.includes('{historyEmptyLabel}'))

// ── 4. Nav drawer untouched ─────────────────────────────────────────
console.log('── nav drawer untouched ──')
ok('Navbar has NO trace of the hub (reverted + kept out)', !nb.includes('SidebarSearchHub') && !nb.includes('Search Hub'))
ok('drawer structure: logo → nav links → currency/language → auth',
  nb.indexOf('aria-label="Kivora research"') < nb.indexOf('<NavLinks pathname={pathname} onClose={onClose} user={user} />') &&
  nb.indexOf('<NavLinks pathname={pathname} onClose={onClose} user={user} />') < nb.indexOf('Auth section — pinned to bottom'))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
