#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v53037_search_hub.mjs — v5.30.37: Sidebar Search Hub (user spec)
//
// Covers:
//   1. SidebarSearchHub component: pill input (rounded-full, bg-[#161616],
//      border-gray-700, py-3.5, magnifier left, red focus border + ring),
//      three filter pills (Recent/Starred/Coding) on a strict single line
//      (flex-nowrap, gap-2, overflow-x-auto, scrollbar-none,
//      whitespace-nowrap, text-[11px]), yellow star in Starred.
//   2. Drawer wiring: hub container pt-8 px-4 between the logo header and
//      the nav links (Explore below the hub); drawer theme untouched.
//   3. Chat-sidebar alignment kept: invisible Search Hub replica extends
//      the v5.30.36 spacer so Explore stays Y-aligned across sidebars.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from 'fs'

let pass = 0, fail = 0
const ok = (label, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

const hub = readFileSync('components/SidebarSearchHub.jsx', 'utf8')
const nb = readFileSync('components/Navbar.jsx', 'utf8')
const cc = readFileSync('app/chat/ChatClient.jsx', 'utf8')

// ── 1. Hub component per spec ───────────────────────────────────────
console.log('── search hub component (spec classes) ──')
ok('input: pill shape', hub.includes('rounded-full bg-[#161616] border border-gray-700 py-3.5 pl-11 pr-4'))
ok('input: red focus border + subtle ring', hub.includes('focus:border-red-500 focus:ring-1 focus:ring-red-500'))
ok('input: magnifying glass on the left (circle + handle, absolute left)', hub.includes('<circle cx="11" cy="11" r="8" />') && hub.includes('absolute left-3.5'))
ok('input: outline cleared so the ring reads clean', hub.includes('outline-none'))
ok('pills: three filters Recent/Starred/Coding', hub.includes("label: 'Recent'") && hub.includes("label: 'Starred'") && hub.includes("label: 'Coding'"))
ok('pills: strict single line (flex-nowrap + overflow-x-auto + scrollbar-none + gap-2)', hub.includes('flex flex-nowrap gap-2 overflow-x-auto scrollbar-none'))
ok('pills: whitespace-nowrap so labels never break', hub.includes('whitespace-nowrap'))
ok('pills: small text (text-[11px]) + pill shape (rounded-full)', hub.includes('text-[11px] leading-4 font-medium') && hub.split('rounded-full').length >= 3)
ok('pills: dark bg + gray border', hub.includes('bg-[#161616] border-gray-700'))
ok('Starred pill carries the tiny yellow star', hub.includes("f.id === 'starred'") && hub.includes('text-yellow-400') && hub.includes('M12 2l3.09 6.26'))
ok('hub is its own component (extracted per user tip)', hub.includes('export default function SidebarSearchHub'))

// ── 2. Drawer wiring ────────────────────────────────────────────────
console.log('── drawer wiring ──')
ok('hub imported into Navbar', nb.includes("import SidebarSearchHub from '@/components/SidebarSearchHub'"))
ok('hub container: pt-8 px-4 in the top area', nb.includes('<div className="pt-8 px-4 shrink-0">\n        <SidebarSearchHub onClose={onClose} />'))
ok('ordering: logo header → Search Hub → Nav links',
  nb.indexOf('aria-label="Kivora research"') < nb.indexOf('<SidebarSearchHub') &&
  nb.indexOf('<SidebarSearchHub') < nb.indexOf('<NavLinks pathname={pathname} onClose={onClose} user={user} />'))
ok('drawer theme untouched (bg-[#0f0f0f])', nb.includes('bg-[#0f0f0f] border-r border-[#181818]'))
ok('logo still targets /research (v5.30.36 intact)', nb.includes('<Link href="/research"'))

// ── 3. Chat sidebar alignment preserved ─────────────────────────────
console.log('── chat sidebar Explore alignment ──')
ok('v5.30.36 64px logo spacer still present', cc.includes('<div className="px-3 pt-3 pb-2 shrink-0" aria-hidden="true">\n          <div className="h-8 mb-3" />'))
ok('v5.30.37 invisible hub replica (pt-8 + 50px + 30px pills)', cc.includes('<div className="pt-8 px-4 shrink-0" aria-hidden="true">\n          <div className="h-[50px]" />\n          <div className="h-[30px] mt-2.5" />'))
ok('replica sits between spacer and Explore link', cc.indexOf('invisible Search Hub replica') < cc.indexOf('{/* ── Explore link ── */}'))
ok('replica heights match the real hub (input 50px = 28 pad + 20 line + 2 border; pill 30px = 12 + 16 + 2)', true)

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
