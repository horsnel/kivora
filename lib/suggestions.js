// v5.30.9 — follow-up suggestion pills for the tool pages (DevTools / StudyDesk / ReelPen)
//
// SERVER side: `SUGGESTIONS_TAIL` is appended to every tool prompt in the three
// tool routes, telling the model to finish its answer with a machine-readable
// block. An HTML comment is used because it never renders as markdown — the raw
// block is invisible even before the client strips it.
//
// CLIENT side: `splitSuggestions()` extracts the block from the accumulated
// stream text. While the block is still streaming in (no closing `-->` yet) it
// is hidden entirely so the raw marker never flashes in the output box.

export const SUGGESTIONS_TAIL = `


FOLLOW-UP SUGGESTIONS — mandatory last block:
After you finish the answer, append EXACTLY this block as the very last thing in your output:
<!--SUGGESTIONS
3 short follow-up prompts the user could run next in this same tool, one per line
-->
Rules: each line is a ready-to-submit input for THIS tool, phrased the way the user would type it (no quotes, no numbering, no lead-in words — just the prompt text). 30-48 characters per line, and keep all three lines close to the same length so they render as a tidy row of equal-looking pills. Make them specific to THIS result (reference its actual subject, code, data or text), never generic. Do not mention or explain the block anywhere in the answer body.`

const MAX_PILLS = 5

// v5.30.10 — single source of truth for the follow-up pill styling, imported by
// all three tool clients. Self-contained metrics (explicit line-height + font
// family) so the pills render pixel-identical on every page regardless of the
// inherited context; whitespace-nowrap + ellipsis keeps every pill one line tall.
// v5.30.13 — same chrome as the tool pills (bg-[#141414] border-[#262626] text-muted
// hover:text-white hover:border-[#3a3a3a]) per user ask; inline-block (not inline-flex)
// so whitespace-nowrap + overflow-hidden + text-ellipsis actually render a trailing
// ellipsis — text-overflow does nothing on a flex container, which is why long pills
// used to clip abruptly. lib/ is now in the tailwind content globs so every utility
// here really compiles.
export const SUGGESTION_PILL_CLASS = 'inline-block max-w-full text-[11px] leading-[16px] px-3 py-1.5 rounded-full bg-[#141414] border border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a] transition-colors whitespace-nowrap overflow-hidden text-ellipsis disabled:opacity-50'

// Strip list-item decoration a model might add despite instructions
function cleanLine(l) {
  return l.replace(/^[\s>*\-•]+\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
}

export function splitSuggestions(text) {
  const s = String(text || '')
  // Complete block at the tail
  let m = s.match(/<!--SUGGESTIONS\s*\n([\s\S]*?)-->\s*$/)
  if (m) {
    const suggestions = m[1].split('\n').map(cleanLine).filter(Boolean).slice(0, MAX_PILLS)
    return { body: s.slice(0, m.index).replace(/\s+$/, ''), suggestions }
  }
  // Still streaming — hide the unterminated tail
  m = s.match(/<!--SUGGESTIONS\s*\n[\s\S]*$/)
  if (m) return { body: s.slice(0, m.index).replace(/\s+$/, ''), suggestions: [] }
  return { body: s, suggestions: [] }
}
