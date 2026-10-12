#!/usr/bin/env node
/**
 * Output-box scroll regression — DevTools / ReelPen / StudyDesk.
 *
 * Bug: the AI output box used `flex-1 overflow-auto` with NO height cap inside
 * a `min-h` flex-col panel → the box grew to full content height (measured
 * 5605px) and never scrolled internally; only the page around it moved.
 * Fix: cap the scroll region like the quiz branch already did
 * (`max-h-[min(600px,72dvh)]` + `min-h-0` so the flex min-size floor can't
 * defeat the cap).
 */
import { readFileSync } from 'node:fs'

const CAP = 'max-h-[min(600px,72dvh)]'
let pass = 0, fail = 0
function t(name, cond) {
  if (cond) { pass++; console.log('  PASS', name) }
  else { fail++; console.log('  FAIL', name) }
}

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const study = read('app/study/StudyClient.jsx')
const reelpen = read('app/reelpen/ReelPenClient.jsx')
const devtools = read('app/devtools/DevToolsClient.jsx')

console.log('── markdown output regions carry the scroll cap ──')
const mdOld = 'className="flex-1 overflow-auto overscroll-behavior-contain"'
const mdNew = `className="flex-1 min-h-0 overflow-auto overscroll-behavior-contain ${CAP}"`
t('StudyDesk markdown result capped', study.includes(mdNew))
t('ReelPen markdown result capped', reelpen.includes(mdNew))
t('DevTools markdown result capped', devtools.includes(mdNew))

console.log('── DevTools diff + API-tester regions capped ──')
t('DevTools diff view capped', devtools.includes(`className="flex-1 min-h-0 overflow-auto overscroll-behavior-contain ${CAP}"`))
t('DevTools API tester capped', devtools.includes(`className="flex-1 min-h-0 overflow-auto overscroll-behavior-contain space-y-4 ${CAP}"`))

console.log('── no uncapped output regions remain ──')
t('old uncapped markdown className gone (study)', !study.includes(mdOld))
t('old uncapped markdown className gone (reelpen)', !reelpen.includes(mdOld))
t('old uncapped markdown className gone (devtools)', !devtools.includes(mdOld))
t('no bare flex-1 overflow-auto without cap in devtools', !/className="flex-1 overflow-auto["]/.test(devtools))

console.log('── quiz cap (the reference pattern) still intact ──')
t('StudyDesk quiz branch keeps max-h-[600px]', study.includes('max-h-[600px]'))

console.log('── min-h-0 guards the cap against flex min-size floor ──')
t('min-h-0 present next to cap in all three pages',
  study.includes('flex-1 min-h-0 overflow-auto') &&
  reelpen.includes('flex-1 min-h-0 overflow-auto') &&
  devtools.includes('flex-1 min-h-0 overflow-auto'))

console.log(`\n${pass + fail === 0 ? 'no assertions' : ''}${pass}/${pass + fail} assertions passed`)
if (fail > 0) process.exit(1)
