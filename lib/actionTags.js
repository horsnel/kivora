// lib/actionTags.js — v5.30.15
// Some models spell tool calls as visible pseudo-XML instead of native
// tool_calls payloads — e.g.
//   <file type="json" title="Cloning Appwrite Repo"> {"name": "sandbox_git",
//   "arguments": {...}} </file>
// That raw tag+JSON used to land in the chat bubble as dumped text. Three
// consumers share this module:
//   1. app/api/chat/route.js recovery  — converts the block into a REAL
//      tool call (lib/toolCallRecovery.js)
//   2. app/api/chat/route.js sanitizer — strips leftover machinery from
//      visible replies (belt-and-suspenders)
//   3. ChatClient rendering            — renders the block as a system-action
//      card (components/chat/AIActionCard.jsx)
// Pure, dependency-free, safe on client and server. Fenced code (``` … ```)
// is NEVER converted — a fenced <file> block is content (docs, examples),
// not machinery.

// Tag names a model may use to wrap a tool-call payload. Deliberately a
// closed set: arbitrary tags stay untouched, and legacy <file path="…">
// artifact bodies (HTML, not JSON) fail the JSON gate below and pass through.
export const ACTION_TAG_NAMES = ['file', 'tool_call', 'tool', 'action', 'function']

// Closed action block: backreference keeps open/close names in sync (also
// enforces case-insensitive pairing via the gi flags). Attributes are
// captured; only `title` is surfaced to the UI.
const ACTION_TAG_RE = new RegExp(
  `<(${ACTION_TAG_NAMES.join('|')})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`,
  'gi'
)

// Byte ranges of fenced code regions. An unclosed fence (streaming tail or
// broken reply) masks everything after its opening so the scanner never
// converts code-sample content.
export function fencedRanges(text) {
  const s = String(text || '')
  const ranges = []
  const fenceRe = /```/g
  let open = null
  let m
  while ((m = fenceRe.exec(s))) {
    if (open === null) open = m.index
    else {
      ranges.push([open, m.index + 3])
      open = null
    }
  }
  if (open !== null) ranges.push([open, s.length])
  return ranges
}

function straddlesRegionStart(ranges, from) {
  // A fence only masks content that starts AFTER the fence opened. A fence
  // that begins INSIDE an action-tag body belongs to that body (models wrap
  // tool JSON in ```json fences inside the tag), so it must not reject the
  // enclosing tag match.
  for (const [a, b] of ranges) {
    if (a < from && b > from) return true
  }
  return false
}

// Body → JSON object (objects only; primitives/arrays are not tool payloads).
// Tolerates a ```json fence wrapped around the payload inside the tag.
function tryParseBody(body) {
  let t = String(body || '').trim()
  if (!t) return null
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) t = fenced[1].trim()
  try {
    const o = JSON.parse(t)
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null
  } catch {
    return null
  }
}

// All CLOSED action-tag blocks outside fenced code. json = parsed object or
// null when the body is not a JSON object payload.
export function findActionBlocks(text) {
  const s = String(text || '')
  if (!s) return []
  const ranges = fencedRanges(s)
  const out = []
  for (const m of s.matchAll(ACTION_TAG_RE)) {
    if (straddlesRegionStart(ranges, m.index)) continue
    const attrs = m[2] || ''
    const body = m[3] || ''
    const titleM =
      attrs.match(/title\s*=\s*"([^"]*)"/i) || attrs.match(/title\s*=\s*'([^']*)'/i)
    out.push({
      tagName: m[1].toLowerCase(),
      title: titleM ? titleM[1] : '',
      body,
      json: tryParseBody(body),
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
    })
  }
  return out
}

// Streaming guard: byte offset where an unclosed action-tag OPEN begins
// (fenced content excluded), or -1 when the text has no dangling tag. The
// renderer cuts the display tail there so a half-streamed tag never flickers
// as raw text; once the close arrives the block renders as a card.
export function unclosedActionTagStart(text) {
  const s = String(text || '')
  if (!s) return -1
  const ranges = fencedRanges(s)
  const openRe = new RegExp(`<(${ACTION_TAG_NAMES.join('|')})\\b[^>]*>?`, 'gi')
  let last = -1
  for (const m of s.matchAll(openRe)) {
    if (straddlesRegionStart(ranges, m.index)) continue
    const closeIdx = s.toLowerCase().indexOf(`</${m[1].toLowerCase()}>`, m.index)
    if (closeIdx === -1) last = m.index
  }
  return last
}

// Message-content splitter for the chat renderer. Ordered segments:
//   { type: 'text', text } | { type: 'action', toolName, title, args, rawJson, valid }
// Only blocks whose body parses as a JSON object become action segments —
// everything else keeps its original bytes for the markdown renderer.
export function parseActionSegments(content, { streaming = false } = {}) {
  const s = String(content || '')
  if (!s) return [{ type: 'text', text: '' }]
  // Fast path: no action-ish tag anywhere → the string is untouched.
  if (!new RegExp(`<(?:${ACTION_TAG_NAMES.join('|')})\\b`, 'i').test(s)) {
    return [{ type: 'text', text: s }]
  }
  let display = s
  if (streaming) {
    const cut = unclosedActionTagStart(display)
    if (cut !== -1) display = display.slice(0, cut)
  }
  const blocks = findActionBlocks(display)
  if (!blocks.length) return [{ type: 'text', text: display }]
  const segments = []
  let cursor = 0
  for (const b of blocks) {
    if (!b.json) continue // not a machine payload — leave bytes alone
    if (b.start > cursor) segments.push({ type: 'text', text: display.slice(cursor, b.start) })
    const name = String(
      b.json.name || b.json.tool || b.json.tool_name || b.json.function || ''
    ).trim()
    const args =
      b.json.arguments ?? b.json.parameters ?? b.json.args ?? b.json.params ?? null
    segments.push({
      type: 'action',
      toolName: name || b.tagName,
      title: b.title || name || b.tagName,
      args,
      rawJson: b.body.trim(),
      valid: Boolean(name),
    })
    cursor = b.end
  }
  if (cursor < display.length) segments.push({ type: 'text', text: display.slice(cursor) })
  return segments.length ? segments : [{ type: 'text', text: display }]
}
