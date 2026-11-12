// lib/toolCallRecovery.js — v5.30.15
// Text-embedded tool-call recovery + machinery stripping for visible replies.
// Extracted from app/api/chat/route.js (v5.15 logic) and extended to unwrap
// pseudo-XML action tags (<file type="json" title="…">…</file> and siblings —
// see lib/actionTags.js) that some models emit instead of native tool_calls.
// The tag-wrapped JSON used to dodge the fence/bare-line candidates (the
// payload shares a line with the tag) and surface as raw jargon in the bubble
// while the tool never ran.
//
// Pure + unit-testable: no imports from the server-only tool registry —
// callers pass their known-name set (route.js passes KNOWN_TOOL_NAMES).
import { findActionBlocks } from './actionTags.js'

// Recover the first valid tool call spelled out as visible text.
// Candidate order: action-tag-wrapped blocks (most explicit) → ``` fences →
// bare single-line JSON. A candidate must parse to an object whose tool name
// is in `knownNames` for recovery to fire.
export function recoverToolCallFromText(text, knownNames) {
  const s = String(text || '')
  if (!s || !s.includes('{')) return null
  const candidates = []
  for (const b of findActionBlocks(s)) candidates.push(b.body)
  for (const m of s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(m[1])
  for (const m of s.matchAll(/(^|\n)\s*(\{[^\n]{0,4000}\})\s*(?=\n|$)/g)) candidates.push(m[2])
  for (const raw of candidates) {
    let trimmed = String(raw || '').trim()
    if (!trimmed) continue
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    if (fenced) trimmed = fenced[1].trim()
    if (!trimmed.startsWith('{')) continue
    let obj = null
    try {
      obj = JSON.parse(trimmed)
    } catch {
      continue
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue
    const name = String(obj.tool || obj.tool_name || obj.function || obj.name || '').trim()
    if (!name || !knownNames.has(name)) continue
    const args = { ...(obj.arguments || obj.parameters || obj.args || obj.params || {}) }
    if (args.prompt === undefined && typeof obj.prompt === 'string') args.prompt = obj.prompt
    return { name, args }
  }
  return null
}

// Remove action-tag blocks whose body parses as a tool-call JSON object
// (sanitizeVisibleReply consumer). Non-JSON bodies — legacy <file path="…">
// artifact files, prose examples — are kept byte-for-byte. isToolJson is the
// caller's tool-payload predicate (route.js passes looksLikeToolJson).
export function stripActionTagToolBlocks(text, isToolJson) {
  const s = String(text || '')
  if (!s || !s.includes('<')) return s
  const blocks = findActionBlocks(s)
  if (!blocks.length) return s
  let out = ''
  let cursor = 0
  let stripped = false
  for (const b of blocks) {
    let obj = null
    try {
      obj = JSON.parse(b.body.trim())
    } catch {
      obj = null
    }
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && isToolJson(obj)) {
      out += s.slice(cursor, b.start) + ' '
      cursor = b.end
      stripped = true
    }
  }
  if (!stripped) return s
  out += s.slice(cursor)
  return out
}
