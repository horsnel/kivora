export const runtime = 'edge' 
import { groq, MODEL, VISION_MODEL, groqChat, GroqError, ALLOWED_MODELS, getPrimaryClientAsync, getFallbackClientAsync, setCerebrasApiKey, setSambanovaApiKey, setSiliconflowApiKey, setGeminiApiKey, setOpenrouterApiKey, stripThinking } from '@/lib/groq'
import { mistralChat, mistralChatStream, setMistralApiKeys, isMistralConfigured, messagesHaveImage } from '@/lib/mistral'
import { setJudge0Config } from '@/lib/judge0'
import { sseResponse } from '@/lib/sse'
import { createClient } from '@supabase/supabase-js'
import { getEnvVar, runInBackground } from '@/lib/cfEnv'
import { createGenRecorder } from '@/lib/genBuffer'
import { rateLimit, anonymousRateLimit, anonymousDailyLimit, getClientIP } from '@/lib/ratelimit'
import { safeJson } from '@/lib/payload'
import { toolDefs, toolHandlers, TOOL_INSTRUCTIONS, filterToolsByQuery, detectRequiredTool, setToolSandboxConfig } from '@/lib/toolRegistry'
import { buildSystemPrompt } from '@/lib/systemPrompt'
import { requireCredits, requireFeatureAccess, refundCredits, CREDIT_COSTS } from '@/lib/credits'

const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map(m => m.id)

// ── Image attachment parser ─────────────────────────────────────
// ChatClient sends images as:
//   "[Image: filename]\n<data:image/...;base64,...>"            (no question)
//   "[Image: filename]\n<data:image/...;base64,...>\nquestion"  (with question)
// The OLD regex (/[\s\S]+$/) greedily swallowed the trailing question text
// INTO the data URL — producing "...base64,XXXX\nwho is this?" which every
// vision provider 4xx-rejects (the historic "something went wrong" on
// image+question), and the question was simultaneously erased from the text
// part. Base64 payloads contain only [A-Za-z0-9+/=], so anchoring the capture
// on that alphabet splits the three fields exactly.
function parseImageMessage(content) {
  const m = String(content || '').match(/^\[Image: (.+?)\]\n(data:image\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)(?:\n([\s\S]*))?$/)
  if (!m) return null
  return { fileName: m[1], dataUrl: m[2], text: (m[3] || '').trim() }
}

// ── Session message history coercion ─────────────────────────────────────
// chat_sessions.messages must ALWAYS be an array of {role, content} objects.
// A legacy/corrupted row (object or JSON string) previously poisoned every
// future save through the spread below (string -> per-character "messages",
// object -> key "messages") and crashed the chat page on load with
// "g.map is not a function". Coerce hard instead of trusting the column.
function prevMessages(session) {
  const m = session?.messages
  if (Array.isArray(m)) return m
  if (typeof m === 'string' && m.trim()) {
    try {
      const parsed = JSON.parse(m)
      if (Array.isArray(parsed)) return parsed
    } catch (_) {}
  }
  return []
}

// ── Artifact Extraction ──
function extractArtifacts(text) {
  const artifacts = []
  const regex = /<artifact\s+type="(\w+)"\s+title="([^"]*)">([\s\S]*?)<\/artifact>/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const type = match[1]
    const title = match[2]
    const content = match[3].trim()

    if (type === 'project') {
      // Parse multi-file project
      const files = []
      const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g
      let fileMatch
      while ((fileMatch = fileRegex.exec(content)) !== null) {
        files.push({ path: fileMatch[1], content: fileMatch[2].trim() })
      }
      if (files.length > 0) {
        artifacts.push({ type: 'project', title, files })
      }
    } else {
      artifacts.push({ type, title, code: content })
    }
  }
  return artifacts
}

// ── Response payload schema guards ─────────────────────────────
// The client renders artifacts via artifact.type.toUpperCase() and cards via
// opp.url — a non-array or a non-object item crashes the whole chat page
// ("g.map is not a function" family). Normalize at the API boundary so the
// SSE done event / JSON response can never carry a drifted shape, no matter
// what a tool implementation returns in the future.
function sanitizeArtifactList(list) {
  if (!Array.isArray(list)) return []
  return list.filter(a => a && typeof a === 'object' && !Array.isArray(a))
}

function sanitizeOpportunityList(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter(o => o && typeof o === 'object' && !Array.isArray(o))
    .map(o => ({ ...o, url: typeof o.url === 'string' ? o.url : '#' }))
}

// ── Wiki Ingest (non-blocking) ──────────────────────────────────
// After a substantive assistant reply, fire a background wiki ingest
// so future queries can use the knowledge. We extract entities and
// upsert into wiki_pages. This never blocks the response — failures
// are silently swallowed (logged only).
function slugifyText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80)
}

async function ingestToWiki(admin, { userMessage, assistantReply, userId }) {
  if (!admin || !userMessage || !assistantReply) return
  // Only ingest substantive replies (>150 chars) — skip greetings, errors, short answers
  if (assistantReply.length < 150) return
  // Skip if it's mostly an error message
  if (/^(sorry|error|failed|unable|i can't)/i.test(assistantReply.trim())) return

  try {
    const title = userMessage.slice(0, 80).trim() || 'Untitled conversation'
    const slug = `chat-${slugifyText(title)}-${Date.now().toString(36)}`
    const content = `User asked: ${userMessage.slice(0, 500)}\n\nKivora answered:\n${assistantReply.slice(0, 2500)}`

    await admin
      .from('wiki_pages')
      .upsert({
        slug,
        title: `Chat: ${title}`,
        content,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug' })

    console.log('[chat] Wiki ingest OK:', slug)
  } catch (err) {
    console.warn('[chat] Wiki ingest failed:', err?.message || err)
  }
}

// ── Mistral-first chat with legacy-chain fallback ────────────────
// Mistral's light tiers answer in well under a second of provider time; the
// legacy 7-provider chain (SiliconFlow→SambaNova→Groq→grok→Gemini→
// OpenRouter→Cerebras) adds seconds of dead retries before generation even
// starts, so it is now the FALLBACK. Response shape is OpenAI-compatible for
// both paths (choices[0].message), so callers are unchanged.
//
// v5.11: image messages SKIP Mistral — its pixtral/small vision tiers are
// weak at person/celebrity identification. The legacy chain (lib/groq.js)
// runs an image-aware provider order (qwen3.8-27b → Gemini → Mistral) instead.
async function aiChat(params) {
  if (isMistralConfigured() && !messagesHaveImage(params.messages)) {
    try {
      const m = await mistralChat({
        messages: params.messages,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
        tools: params.tools,
        toolChoice: params.tool_choice,
      })
      if (m?.choices?.[0]?.message) return m
    } catch (err) {
      console.warn(`[chat] mistral unavailable (${String(err?.message).slice(0, 80)}) — falling back to legacy chain`)
    }
  }
  return groqChat(params)
}

// ── Mistral-first STREAMING chat with legacy-chain fallback ──────
// Streams Mistral tokens through onDelta as they arrive. If Mistral is
// unavailable (or dies before the stream starts), falls back to the legacy
// chain — v5.13: the chain now streams too (every provider in lib/groq.js
// forwards deltas through onDelta), so tokens flow token-by-token no matter
// which provider serves the reply. Previously the chain path buffered the
// ENTIRE generation and emitted one giant delta — dead air, then a wall of
// text. That's the "not seamless" bug.
async function aiChatStream(params, { onDelta }) {
  if (isMistralConfigured() && !messagesHaveImage(params.messages)) {
    try {
      const m = await mistralChatStream({
        messages: params.messages,
        temperature: params.temperature,
        maxTokens: params.max_tokens,
        tools: params.tools,
        toolChoice: params.tool_choice,
        onDelta,
      })
      if (m?.choices?.[0]?.message) return m
    } catch (err) {
      console.warn(`[chat] mistral stream unavailable (${String(err?.message).slice(0, 80)}) — falling back to legacy chain`)
    }
  }
  return groqChat(params, { onDelta })
}

// ── Truncation guard: complete-length continuation + sentence finisher ──
// Providers stop at max_tokens (finish_reason 'length') — or silently DROP
// the stream early (finish_reason 'stop' on a mid-sentence corpse). Both
// leave the user with a reply cut mid-thought. This wrapper continues an
// unfinished completion up to MAX_CONTINUATIONS times (streaming the
// continuation through the same onDelta so the client renders seamlessly),
// then trims to the last complete sentence so a reply never ends mid-thought.
const MAX_CONTINUATIONS = 3

// Heuristic: does this text end mid-thought? Catches the silent-drop case
// that never reports finish_reason 'length'. Conservative — only fires on
// replies long enough that an abrupt stop is never intentional. Legitimate
// endings (closed code fence, table row ending in |, bold ending in *,
// list/heading lines) must NOT trigger continuation.
function looksCutOff(text) {
  const s = String(text || '')
  // Unbalanced code fence — a block was opened and never closed. Checked
  // BEFORE the length guard: an unclosed fence at ANY length poisons the
  // whole conversation (everything after renders inside the code block).
  const fenceCount = (s.match(/```/g) || []).length
  if (fenceCount % 2 === 1) return true
  // Unclosed `inline code` span (single backticks, not fence markers)
  const backtickRuns = (s.match(/`+/g) || [])
  const singleBackticks = backtickRuns.filter(r => r.length === 1).length
  if (singleBackticks % 2 === 1) return true
  if (s.trim().length < 400) return false
  const trimmed = s.trimEnd()
  // Ends on a strong dangling token: comma, semicolon, colon, or an unclosed
  // bracket/paren. (Pipes, asterisks, hashes, dashes are excluded — tables,
  // bold, headings and rules end with them legitimately.)
  if (/[,;:([{]$/.test(trimmed)) return true
  // Last line opens a structure it never finished: a list bullet or numbered
  // item with no content after it
  const lastLine = trimmed.slice(trimmed.lastIndexOf('\n') + 1)
  if (/^\s*(-|\*|\d+\.)\s*$/.test(lastLine)) return true
  // Prose with no sentence terminator in the final stretch: the provider
  // stopped mid-paragraph. Requires >200 chars since the last terminator.
  if (!/[.!?)\]"'”’]\s*$/.test(trimmed) && !/```$/.test(trimmed) && !/\|$/.test(lastLine)) {
    const lastTerminator = Math.max(trimmed.lastIndexOf('.'), trimmed.lastIndexOf('!'), trimmed.lastIndexOf('?'))
    if (lastTerminator > 0 && lastTerminator < trimmed.length - 200) return true
  }
  return false
}

async function aiChatComplete(params, { onDelta, stream }) {
  const call = (p) => (stream
    ? aiChatStream(p, { onDelta })
    : aiChat(p))

  let chat = await call(params)
  // v5.14 CRITICAL fix: preserve the provider's message object (tool_calls!).
  // Since v5.11 this wrapper rebuilt the response with ONLY `content`, which
  // silently stripped `message.tool_calls` — so generate_image, web_search,
  // execute_code, deploy_site and every other tool NEVER executed (the route
  // saw an empty reply, the empty-reply fallback re-asked the model WITHOUT
  // tools, and the user got a text description of what the AI "would do").
  const firstMessage = chat?.choices?.[0]?.message || {}
  let text = firstMessage.content || ''
  let finish = chat?.choices?.[0]?.finish_reason
  let rounds = 0

  // Continuation fires when the provider honestly reported a max_tokens stop
  // ('length') OR when the text LOOKS cut off (silent mid-stream drops report
  // a clean 'stop' on a half-finished corpse). Only applies to text replies —
  // a tool_call reply passes through untouched (executing the tool IS the
  // continuation). Tools are stripped from continuation calls: a continuation
  // that itself emits a tool_call would silently swallow the text.
  while ((finish === 'length' || looksCutOff(text)) && !firstMessage.tool_calls && text.trim() && rounds < MAX_CONTINUATIONS) {
    rounds += 1
    console.warn(`[chat] completion ${finish === 'length' ? 'hit max_tokens' : 'looks cut off (silent stream drop)'} (round ${rounds}) — continuing`)
    let cont
    try {
      const contParams = { ...params }
      delete contParams.tools
      delete contParams.tool_choice
      cont = await call({
        ...contParams,
        messages: [
          ...params.messages,
          { role: 'assistant', content: text },
          { role: 'user', content: 'Continue your previous reply from EXACTLY where you stopped. Do not repeat any earlier text, do not add an introduction — resume mid-sentence if that is where you stopped, and finish the thought.' },
        ],
      })
    } catch (contErr) {
      console.warn('[chat] continuation failed:', String(contErr?.message || contErr).slice(0, 100))
      break
    }
    const contText = cont?.choices?.[0]?.message?.content || ''
    if (!contText.trim()) break
    text += contText
    finish = cont?.choices?.[0]?.finish_reason
  }

  return {
    choices: [{
      // Tool-call replies keep the FULL message (tool_calls, id, …) — content
      // is only stripped of thinking blocks. Text replies keep the lean shape.
      message: firstMessage.tool_calls?.length
        ? { ...firstMessage, content: stripThinking(text) }
        : { role: 'assistant', content: stripThinking(text) },
      finish_reason: finish || 'stop',
    }],
  }
}

// Trim an over-running reply back to its last complete sentence. Never trims
// short replies (they may legitimately end without terminal punctuation),
// code fences, or list tables mid-structure.
function completeSentences(text) {
  const s = stripThinking(text)
  if (s.length < 240) return s
  // Balanced code fences — leave code blocks untouched
  const fenceCount = (s.match(/```/g) || []).length
  if (fenceCount % 2 === 1) return s
  if (/[.!?)\]"'”’`*…]\s*$/.test(s.trim())) return s
  // Walk to the last sentence terminator that is followed by whitespace/EOS
  let last = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if ((ch === '.' || ch === '!' || ch === '?') && (i + 1 >= s.length || /\s/.test(s[i + 1]))) last = i
  }
  if (last > 80) return s.slice(0, last + 1).trimEnd()
  return s
}

// ── v5.15 — visible-reply de-jargonizer ─────────────────────────────
// Providers occasionally leak plumbing into visible content: tool-call JSON
// emitted as text (a ```json fence or a bare line), <function=…> fragments,
// <think> tails. This strips them so chat bubbles never show raw machinery.
const KNOWN_TOOL_NAMES = new Set(Object.keys(toolHandlers))
function looksLikeToolJson(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  const name = String(obj.tool || obj.tool_name || obj.function || obj.name || '')
  if (name && KNOWN_TOOL_NAMES.has(name)) return true
  // argument-shaped payloads referencing a tool-ish key also count
  const hasArgs = obj.arguments !== undefined || obj.parameters !== undefined || obj.args !== undefined
  const hasPayload = ['prompt', 'query', 'code', 'url', 'location', 'files'].some(k => obj[k] !== undefined)
  return hasArgs && hasPayload
}
function sanitizeVisibleReply(text) {
  let s = String(text || '')
  if (!s) return s
  if (s.includes('<function=')) {
    s = s.replace(/<function=[\s\S]*?(?:<\/function>|$)/gi, ' ')
  }
  if (s.includes('```')) {
    // Unbalanced fences → the tail block is broken/jargon. Cut from the last
    // opening fence to the end (a real terminated block is untouched).
    const fenceCount = (s.match(/```/g) || []).length
    if (fenceCount % 2 === 1) {
      const lastFence = s.lastIndexOf('```')
      if (lastFence !== -1) s = s.slice(0, lastFence)
    }
    // Drop closed fenced blocks whose body parses as tool-call JSON — keep
    // real code blocks intact.
    if (s.includes('```')) {
      s = s.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (m, body) => {
        const t = String(body || '').trim()
        if (!t.startsWith('{') && !t.startsWith('[')) return m
        try {
          if (looksLikeToolJson(JSON.parse(t))) return ''
        } catch { /* not JSON — keep the code block */ }
        return m
      })
    }
  }
  // Bare JSON tool-call lines ({"tool": …} / {"name": "<known tool>", …})
  s = s.replace(/(^|\n)(\s*\{[^\n]{0,2000}\})(?=\s*(\n|$))/g, (m, pre, body) => {
    try {
      if (looksLikeToolJson(JSON.parse(body))) return pre
    } catch { /* plain text — keep */ }
    return m
  })
  // Tool-call narrations some models prepend ("I'll use the X tool now.")
  s = s.replace(/^\s*I(?:'ll| will|'m going to| am going to)?(?:\s+now)?\s+(?:use|call|invoke|run)\s+(?:the|my)\s+[\w_]+\s+tool\b[^\n]*$/gim, '')
  s = s.replace(/\n{3,}/g, '\n\n').trim()
  // Collapse doubled spaces left by tag removal — only outside code fences
  if (!s.includes('```')) s = s.replace(/ {2,}/g, ' ')
  return s
}
function polishReply(text) {
  return sanitizeVisibleReply(completeSentences(text))
}

// ── v5.15 — text-embedded tool-call recovery ────────────────────────
// When a provider emits the tool call as VISIBLE text (a ```json fence or a
// bare JSON line) instead of a native tool_calls payload, that JSON used to
// surface in the chat bubble as gibberish. Detect it and convert it into a
// real tool call so the tool actually executes.
function recoverToolCallFromText(text) {
  const s = String(text || '')
  if (!s || !s.includes('{')) return null
  const candidates = []
  for (const m of s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(m[1])
  for (const m of s.matchAll(/(^|\n)\s*(\{[^\n]{0,4000}\})\s*(?=\n|$)/g)) candidates.push(m[2])
  for (const raw of candidates) {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('{')) continue
    let obj = null
    try { obj = JSON.parse(trimmed) } catch { continue }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue
    const name = String(obj.tool || obj.tool_name || obj.function || obj.name || '').trim()
    if (!name || !KNOWN_TOOL_NAMES.has(name)) continue
    const args = { ...(obj.arguments || obj.parameters || obj.args || obj.params || {}) }
    if (args.prompt === undefined && typeof obj.prompt === 'string') args.prompt = obj.prompt
    return { name, args }
  }
  return null
}

export async function POST(req) {
  // 10MB cap — chat bodies carry base64 image attachments; this blocks
  // multi-hundred-MB junk requests before they reach any handler logic.
  const body = await safeJson(req, 10 * 1024 * 1024)
  if (body === null) {
    return Response.json({ error: 'Payload too large or invalid JSON.' }, { status: 413 })
  }
  // Streaming mode: SSE response opens immediately, then all events
  // (deltas + final payload / errors) flow through it. The handler's work
  // promise is registered with ctx.waitUntil (v5.20) so generation keeps
  // running — and keeps persisting to the resumable-stream buffer — even
  // after the client's network drops mid-response.
  if (body?.stream) {
    return sseResponse(
      (send, conn) => processChat(req, body, send, conn),
      (work) => { runInBackground(work) }
    )
  }
  return processChat(req, body, null, null)
}

async function processChat(req, body, _send, conn) {
  // v5.20 — every send goes through the recorder: after a client disconnect
  // the raw send turns into a silent no-op (sseResponse swallows enqueue
  // failures), but the recorder keeps persisting output so a reconnecting
  // client can catch up via /api/chat/resume.
  let send = _send
  let genRecorder = null

  // v5.22 — Web Push: when the reply finishes while the client is gone, a
  // notification is the difference between "checked back later" and
  // "never knew". Fire-and-forget at every terminal done path below via
  // pushIfDisconnected(); no-op for anonymous users and unconfigured keys.
  const pushIfDisconnected = async (note) => {
    if (!conn?.closed || !chatUser?.id || !admin) return
    try {
      const { sendPushToUser } = await import('@/lib/push')
      await sendPushToUser(admin, chatUser.id, note, getEnvVar)
    } catch {}
  }

  // JSON emission helper — in streaming mode, error payloads travel through
  // SSE error events instead of Response.json (status is carried in-band).
  // Terminal errors are also recorded in the buffer so a reconnecting
  // client renders the same notice card instead of waiting on a dead stream.
  const json = (payload, status) => {
    if (genRecorder && send && status && status >= 400) {
      try { genRecorder.fail({ status: status || 400, ...payload }) } catch {}
    }
    if (!send) return Response.json(payload, { status: status || 200 })
    send({ type: 'error', status: status || 200, ...payload })
    return null
  }
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    // Stream-aware: in SSE mode this travels as an in-band error event, not a
    // bare Response (a Response returned after the stream opened is silently
    // discarded and the client sees a truncated stream with no explanation).
    return json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, 429)
  }

  // Hoisted so the catch block can refund on failure
  let chatUser = null
  let chatAction = 'chat'
  // Hoisted: the catch block below references `admin` for credit refunds.
  // It used to be declared inside the try, so any LLM failure crashed the
  // catch itself ("admin is not defined") and escaped as a generic stream error.
  let admin = null

  try {
    // Access Cloudflare Workers secrets via getEnvVar (process.env has empty values for secrets)
    const groqKey = await getEnvVar('GROQ_API_KEY')
    const groqFallbackKey = await getEnvVar('GROQ_API_KEY_FALLBACK')
    const cerebrasKey = await getEnvVar('CEREBRAS_API_KEY')
    const sambanovaKey = await getEnvVar('SAMBANOVA_API_KEY')
    const siliconflowKey = await getEnvVar('SILICONFLOW_API_KEY')
    const geminiKey = await getEnvVar('GEMINI_API_KEY')
    const openrouterKey = await getEnvVar('OPENROUTER_API_KEY')
    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const supaKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')

    // Wire all provider keys into the multi-provider chain.
    // Order is: Cerebras → SambaNova → SiliconFlow → Groq(primary) → Groq(fallback) → Gemini → OpenRouter
    const mistralKey = await getEnvVar('MISTRAL_API_KEY')
    const mistralFallbackKey = await getEnvVar('MISTRAL_API_KEY_FALLBACK')
    setMistralApiKeys(mistralKey, mistralFallbackKey)
    setCerebrasApiKey(cerebrasKey)
    setSambanovaApiKey(sambanovaKey)
    setSiliconflowApiKey(siliconflowKey)
    setGeminiApiKey(geminiKey)
    setOpenrouterApiKey(openrouterKey)
    const groqClient = await getPrimaryClientAsync(groqKey)
    if (groqFallbackKey) await getFallbackClientAsync(groqFallbackKey)

    admin = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null
    // Groq client is no longer strictly required — direct providers (Cerebras/SambaNova/SiliconFlow)
    // can serve requests without it. But Supabase is still mandatory for session storage.
    if (!admin) {
      return json({ error: 'Service not configured' }, 503)
    }
    // If no LLM provider is configured at all, fail fast with a clear error.
    if (!isMistralConfigured() && !groqClient && !cerebrasKey && !sambanovaKey && !siliconflowKey && !geminiKey && !openrouterKey) {
      return json({ error: 'No LLM providers configured' }, 503)
    }
    const { messages, sessionId, userId, model: requestedModel, systemPrompt, focusMode, proMode, proModeType, effort: requestedEffort } = body
    // Strict array validation — a client bug once stringified a SyntheticEvent
    // into this field ({} after JSON round-trip). `!messages?.length` let
    // strings and other non-arrays slip through and crash the provider call.
    if (!Array.isArray(messages) || !messages.length) {
      return json({ error: 'messages required' }, 400)
    }

    // ── Charge credits (1 for standard chat, 3 for reasoning model) ──
    // We trust the userId from the body for now (it's authenticated by the
    // Supabase RLS layer when reading sessions). Anonymous users skip charging.
    const authHeader = req.headers.get('authorization') || ''
    const accessToken = authHeader.replace(/^Bearer\s+/i, '')
    const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (accessToken && supaUrl && supaAnon) {
      try {
        const userClient = createClient(supaUrl, supaAnon, {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
        })
        const { data: { user: u } } = await userClient.auth.getUser()
        chatUser = u
      } catch { /* anonymous */ }
    }

    // ── v5.20 resumable-stream buffer ──
    // Created before any gate that can terminate the request, so even a
    // 402/429 rejection survives a reload as a renderable notice.
    if (send && sessionId) {
      genRecorder = createGenRecorder(admin, sessionId, chatUser?.id || null)
      if (genRecorder) {
        const rawSend = send
        send = (evt) => {
          try { genRecorder.observe(evt) } catch {}
          rawSend(evt)
        }
      }
    }

    // Logged-in burst protection (per-account, complements the per-IP limits
    // below — prevents rapid-fire abuse even when the client IP rotates)
    if (chatUser && !rateLimit('u:' + chatUser.id, 8).ok) {
      return json({
        error: "You're sending messages too quickly. Give it a few seconds and try again.",
        quotaExceeded: true,
      }, 429)
    }

    // Anonymous user — apply daily limit (5 chat messages/day) + per-minute burst protection
    if (!chatUser) {
      // Per-minute burst protection (prevents rapid-fire abuse)
      if (!anonymousRateLimit(ip).ok) {
        return json({
          error: "You're sending messages too quickly. Slow down or sign in for more.",
          quotaExceeded: true,
          upgrade_url: '/auth',
        }, 429)
      }
      // Daily limit — 5 chat messages per day for anonymous visitors
      const dailyCheck = await anonymousDailyLimit(admin, ip, 'chat', 5)
      if (!dailyCheck.ok) {
        return json({
          error: "You've used all 5 free chat messages for today. Sign in for unlimited access.",
          quotaExceeded: true,
          anonLimitReached: true,
          limit: dailyCheck.limit,
          used: dailyCheck.used,
          upgrade_url: '/auth',
        }, 429)
      }
    }

    // Determine action: reasoning model costs more
    const isReasoning = proMode || proModeType === 'reasoning' || (requestedModel && /reason|think|o1|o3/i.test(requestedModel))
    chatAction = isReasoning ? 'chat_reasoning' : 'chat'

    if (admin && chatUser?.id) {
      const creditCheck = await requireCredits(req, admin, chatUser, chatAction, {
        cost: CREDIT_COSTS[chatAction],
        description: `Chat: ${messages[messages.length - 1]?.content?.slice(0, 80) || ''}`,
        metadata: {
          session_id: sessionId,
          model: requestedModel || MODEL,
          pro_mode: !!proMode,
          message_count: messages.length,
        },
      })
      // Stream-aware failure: creditCheck.response is a bare 402 Response —
      // returning it after the SSE stream opened gets it silently DISCARDED
      // (ReadableStream.start() ignores return values), leaving the client
      // with an event-less stream it renders as "I couldn't generate a
      // response for that." Route the real reason through the error event.
      if (!creditCheck.ok) {
        const gateRes = creditCheck.response
        const gatePayload = await gateRes.json().catch(() => ({ error: 'Request blocked by your plan or credit balance.' }))
        return json(gatePayload, gateRes.status)
      }
    }

    let model = MODEL
    if (requestedModel && ALLOWED_MODEL_IDS.includes(requestedModel)) {
      model = requestedModel
    }

    // ── Pro model gate — DeepSeek R1 / Qwen QwQ require Pro and above ──
    const modelMeta = ALLOWED_MODELS.find(m => m.id === model)
    if (modelMeta?.pro) {
      if (!chatUser?.id) {
        return json({
          error: `${modelMeta.name} is a Pro model. Sign in with a Pro plan to unlock it.`,
          upgrade_url: '/pricing',
          needed_plan: 'pro',
          quotaExceeded: true,
        }, 402)
      }
      const proGate = await requireFeatureAccess(admin, chatUser, 'proModels')
      // Same stream-aware treatment as the credits gate above — a bare
      // Response return mid-stream is discarded and the user sees nothing.
      if (proGate) {
        const gateRes = proGate.response
        const gatePayload = await gateRes.json().catch(() => ({ error: 'This feature needs a plan upgrade.' }))
        return json(gatePayload, gateRes.status)
      }
    }

    // ── Effort level — controls how much the model is allowed to generate ──
    // v5.11 — raised caps + server-side continuation (aiChatComplete) so a
    // reply that hits the token ceiling CONTINUES instead of stopping
    // mid-sentence. Output still stays concise by default (medium = 6144).
    const EFFORT_TOKENS = { low: 3072, medium: 6144, high: 12288 }
    const effort = EFFORT_TOKENS[requestedEffort] ? requestedEffort : 'medium'

    // Check if the last user message contains an image attachment
    const lastUserMsg = messages[messages.length - 1]
    let hasImage = false
    let imageBase64 = null
    let imageText = ''
    let imageFileName = 'image'

    if (lastUserMsg?.role === 'user' && typeof lastUserMsg.content === 'string') {
      const parsed = parseImageMessage(lastUserMsg.content)
      if (parsed) {
        hasImage = true
        imageBase64 = parsed.dataUrl
        imageText = parsed.text
        imageFileName = parsed.fileName
      }
    }

    // ── Greeting shortcut ──
    // Short-circuit common greetings ("hi", "hello", "hey", "yo", "sup",
    // "good morning", etc.) with a warm canned reply. This guarantees no
    // tool flow ever triggers for greetings, regardless of model behavior.
    // Multi-turn check: only fire if this is the first user message OR the
    // previous assistant message is also a greeting reply.
    if (!hasImage && lastUserMsg?.role === 'user' && typeof lastUserMsg.content === 'string') {
      const trimmed = lastUserMsg.content.trim().toLowerCase()
      // Greeting patterns: bare greeting, or greeting + 1-2 short follow-up words
      const greetingPatterns = [
        /^(hi|hello|hey|yo|sup|hiya|heya|howdy|greetings|good\s+(morning|afternoon|evening)|ello|hay)\b/,
        /^h+e+l+l+o+$/,
        /^h+i+\b/,
      ]
      const isGreeting = greetingPatterns.some(re => re.test(trimmed)) && trimmed.length < 50
      // Don't fire if the user's message has a question mark (likely a real question)
      const hasQuestion = /[?]/.test(trimmed)

      if (isGreeting && !hasQuestion) {
        // Pick a varied greeting — use sessionId hash for deterministic-but-varied pick
        const greetings = [
          "Hey! What can I help you build, research, or figure out today?",
          "Hi there! I'm Kivora. I can search the web, run code, build websites, generate images, and more. What are you working on?",
          "Hello! Ready when you are — ask me anything, or describe what you want to create.",
          "Hey! Good to see you. What's on your mind today?",
          "Hi! Whether it's a quick fact-check, a chunk of code, or a full website — I've got you. What's the task?",
        ]
        const idx = sessionId
          ? Math.abs([...sessionId].reduce((a, c) => a + c.charCodeAt(0), 0)) % greetings.length
          : Math.floor(Math.random() * greetings.length)
        const reply = greetings[idx]

        // Save session so the greeting shows up in history.
        // Identity comes from the verified JWT (chatUser), never the body.
        if (chatUser?.id && sessionId) {
          try {
            const { data: session } = await admin
              .from('chat_sessions')
              .select('messages')
              .eq('id', sessionId)
              .eq('user_id', chatUser.id)
              .single()
            await admin.from('chat_sessions').upsert({
              id: sessionId, user_id: chatUser.id,
              messages: [...prevMessages(session), lastUserMsg, { role: 'assistant', content: reply }],
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' })
          } catch (_) {}
        }
        if (send) {
          send({ type: 'delta', v: reply })
          await genRecorder?.finish({ reply, model: 'kivora-greeting', searchUsed: false })
          send({ type: 'done', reply, model: 'kivora-greeting', searchUsed: false })
          await pushIfDisconnected({ title: 'Kivora', body: 'Your reply is ready.', url: '/chat' })
          return null
        }
        return Response.json({ reply, model: 'kivora-greeting', searchUsed: false })
      }
    }

    // Query wiki for context
    const lastMsg = messages[messages.length - 1]?.content || ''
    let wikiContext = ''
    if (!hasImage && lastMsg.length > 10) {
      try {
        const { data: pages } = await admin
          .from('wiki_pages')
          .select('title, content')
          .or(`title.ilike.%${lastMsg.slice(0, 30)}%,content.ilike.%${lastMsg.slice(0, 30)}%`)
          .not('slug', 'like', 'article-%')
          .limit(2)
        if (pages?.length) {
          wikiContext = pages.map(p => `${p.title}: ${p.content.slice(0, 200)}`).join('\n\n')
        }
      } catch (_) {}
    }

    // ── System Prompt ──
    const SYSTEM_PROMPT = buildSystemPrompt({ systemPrompt, wikiContext, toolInstructions: TOOL_INSTRUCTIONS, focusMode, proMode, proModeType })

    // Build messages array
    let apiMessages

    if (hasImage) {
      const textContent = imageText
      // v5.11 visual-intelligence prompt: full forensic analysis including
      // public-figure / celebrity identification with confidence levels.
      // When tools are available (web_search), the model verifies the
      // identified identity against live web results before answering.
      apiMessages = [
        {
          role: 'system',
          content: `${systemPrompt ? `Additional instructions: ${systemPrompt}\n\n` : ''}You are Kivora — an advanced AI assistant with visual intelligence. The user has attached an image. Analyze it thoroughly and answer any questions about it.\n\n${TOOL_INSTRUCTIONS}\n\nFor people in images: if a person appears to be a public figure or celebrity, identify them by name, state why they are famous, and give a confidence level (high/medium/low). If unsure between candidates, name your top candidates with rough confidence percentages, then USE THE web_search TOOL to verify the identity and enrich the answer with current, accurate context (their profession, recent news, notable work). If the image contains landmarks, artwork, products, or logos, identify those too. Never present a low-confidence guess about a person as certain fact — always label uncertainty clearly. For private, non-famous individuals, describe what is visible without guessing a name. Use markdown with ## sections. No filler phrases — get straight to the analysis.`
        },
        ...messages.slice(0, -1).slice(-8),
        {
          role: 'user',
          content: [
            { type: 'text', text: textContent || 'Please describe this image in detail.' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ]
      model = VISION_MODEL
    } else {
      apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.slice(-8)
      ]
    }

    // Filter tools by query relevance. Sending all 28 tools adds ~4.4K tokens
    // to every request, which blows past Groq 8B's 6K TPM and most free-tier
    // limits. By sending only the 1-8 tools relevant to the user's query, we
    // drop input context to ~1-2K tokens — fits every provider's free tier.
    //
    // v5.11: tools are now ALSO available for image messages — the vision
    // model uses web_search to verify identities of people/landmarks it
    // detects (celebrity recognition needs live confirmation). For image
    // messages the tool filter runs on the user's typed text; when there is
    // none, the default set (which includes web_search) applies.
    const useTools = true
    const lastContent = (lastUserMsg?.content || '').trim()
    // For image messages, run the tool filter on the user's TYPED question —
    // never on the raw content (it used to slice 200 chars of base64 noise).
    // When there's no typed text, the hint still yields the default set
    // (web_search always included) so the vision model can verify identities.
    const relevantTools = filterToolsByQuery(hasImage ? (imageText || 'analyze image identify people landmarks text') : lastContent)

    // ── Force tool_choice when user intent clearly requires a specific tool ──
    // Models (especially Qwen 2.5 and Llama 3.3) often describe what they'd do
    // instead of calling the tool. When the user's query unambiguously maps to
    // a tool (e.g. "generate an image of X" → generate_image), we force that
    // tool call via tool_choice so the model MUST invoke it.
    const requiredTool = useTools ? detectRequiredTool(hasImage ? imageText : lastContent) : null
    const toolChoice = requiredTool && relevantTools.some(t => t.function.name === requiredTool)
      ? { type: 'function', function: { name: requiredTool } }
      : (relevantTools.length > 0 ? 'auto' : undefined)

    const llmParams = {
      model,
      messages: apiMessages,
      max_tokens: EFFORT_TOKENS[effort],
      // v5.13: gpt-oss models think before they speak — on Groq the default
      // 'medium' reasoning burns seconds of invisible tokens before the first
      // visible output. 'low' keeps a brief planning pass but cuts TTFB
      // roughly in half. 'high' user effort earns 'medium' thinking.
      // qwen3.8-27b (vision) defaults to a thinking mode that leaks <think>
      // blocks into content and burns output tokens — disable it for vision
      // replies so answers stream straight out. Direct (non-Groq) providers
      // strip this field before sending.
      ...(model === VISION_MODEL
        ? { reasoning_effort: 'none' }
        : { reasoning_effort: effort === 'high' ? 'medium' : 'low' }),
      ...(relevantTools.length > 0 ? { tools: relevantTools, tool_choice: toolChoice } : {})
    }

    let chat
    try {
      chat = send
        ? await aiChatComplete(llmParams, { onDelta: (v) => send({ type: 'delta', v }), stream: true })
        : await aiChatComplete(llmParams, { stream: false })
    } catch (firstErr) {
      // If the first call hit a quota/rate-limit error, retry immediately —
      // groqChat already tries all providers, so a 15s wait is too long.
      // Instead, throw so the user gets a clear "rate limited" message.
      if (firstErr instanceof GroqError && firstErr.code === 'GROQ_QUOTA_EXCEEDED') {
        console.warn('[chat] all providers quota-exceeded')
        return json({ reply: 'All AI providers are currently at capacity. Please try again in a moment.', model: 'kivora-rate-limited' }, 429)
      } else {
        throw firstErr
      }
    }

    let message = chat.choices[0].message

    // ── Retry with forced tool_choice if model ignored a required tool ──
    // If the user clearly wanted a specific tool (e.g. "generate an image of X")
    // but the model chose NOT to call it (tool_choice was 'auto'), retry with
    // tool_choice forced to that specific function. This catches the case where
    // the provider chain fell through to a model that ignored our intent.
    if (useTools && requiredTool && (!message.tool_calls || message.tool_calls.length === 0)) {
      console.warn(`[chat] model didn't call required tool "${requiredTool}", retrying with forced tool_choice`)
      const forcedParams = {
        ...llmParams,
        tool_choice: { type: 'function', function: { name: requiredTool } }
      }
      try {
        const forcedChat = send
          ? await aiChatComplete(forcedParams, { onDelta: (v) => send({ type: 'delta', v }), stream: true })
          : await aiChatComplete(forcedParams, { stream: false })
        const forcedMessage = forcedChat.choices[0].message
        if (forcedMessage.tool_calls && forcedMessage.tool_calls.length > 0) {
          // Update the message and chat references to the forced response
          chat = forcedChat
          message = forcedMessage
        }
      } catch (forcedErr) {
        console.warn(`[chat] forced tool_choice retry failed: ${forcedErr.message?.slice(0, 100)}`)
        // Fall through — use the original response (which describes the image)
      }
    }

    // ── v5.15 — recover tool calls emitted as visible text ──
    // Some providers/models answer a tool-intent prompt with the tool call
    // spelled out as content (a ```json fence or a bare JSON line) instead of
    // a native tool_calls payload. Left as-is, the user sees raw JSON jargon
    // and the tool never runs. Convert it into a real tool call.
    if (useTools && (!message.tool_calls || message.tool_calls.length === 0) && message.content) {
      const recovered = recoverToolCallFromText(message.content)
      if (recovered) {
        console.warn(`[chat] recovered tool call "${recovered.name}" from text content`)
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: `recovered_${Date.now().toString(36)}`,
            type: 'function',
            function: { name: recovered.name, arguments: JSON.stringify(recovered.args) },
          }],
        }
        chat = { choices: [{ message }] }
      }
    }

    // Handle tool calls
    if (useTools && message.tool_calls && message.tool_calls.length > 0) {
      // Pass CF credentials to tools that need them (deploy_site).
      // On CF Pages, secret_text vars are only accessible via getEnvVar(),
      // not via process.env — so we must look them up here and pass them down.
      const cfApiToken = await getEnvVar('CF_API_TOKEN')
      const cfAccountId = await getEnvVar('CF_ACCOUNT_ID')
      const toolContext = {
        supabaseAdmin: admin,
        userId: userId || null,
        cfApiToken,
        cfAccountId,
      }

      // Set Colab access token from server-side env if available (for run_on_gpu tool)
      const colabToken = await getEnvVar('GOOGLE_COLAB_ACCESS_TOKEN')
      if (colabToken) {
        try {
          const { setColabAccessToken } = await import('@/lib/colab')
          setColabAccessToken(colabToken)
        } catch {}
      }

      // Set Kaggle credentials from server-side env if available (for run_on_gpu tool)
      const kaggleUsername = await getEnvVar('KAGGLE_USERNAME')
      const kaggleKey = await getEnvVar('KAGGLE_KEY')
      if (kaggleUsername && kaggleKey) {
        try {
          const { setKaggleCredentials } = await import('@/lib/kaggle')
          setKaggleCredentials(kaggleUsername, kaggleKey)
        } catch {}
      }

      // Set E2B API key from server-side env if available (for run_code tool)
      // Note: E2B SDK uses Node.js APIs (node:path) that are incompatible with edge runtime
      // We only set the key; the actual SDK is loaded dynamically inside the tool handler
      // which runs outside the edge bundle
      const e2bKey = await getEnvVar('E2B_API_KEY')
      if (e2bKey) {
        try {
          const e2bMod = await import('@/lib/e2b')
          e2bMod.setE2BApiKey(e2bKey)
        } catch {}
      }

      // v5.11 fix: wire Judge0 config into the tool handlers. Previously only
      // /api/execute did this — the chat's execute_code tool fell back to
      // Judge0 with NO config, so dedicated-host credentials were never used
      // and executions failed whenever the public CE endpoint was saturated.
      const judge0Url = await getEnvVar('JUDGE0_URL')
      const judge0Key = await getEnvVar('JUDGE0_API_KEY')
      if (judge0Url || judge0Key) {
        try { setJudge0Config(judge0Url, judge0Key) } catch {}
      }

      // Same for the Cloudflare Sandbox tool path (module-level constants read
      // process.env, which is empty for CF Pages secrets — wire via setter).
      const cfSandboxUrl = await getEnvVar('KIVORA_SANDBOX_URL')
      const cfSandboxKey = await getEnvVar('KIVORA_SANDBOX_KEY')
      if (cfSandboxUrl && cfSandboxKey) {
        try {
          const { setSandboxConfig } = await import('@/lib/sandboxConfig')
          setSandboxConfig(cfSandboxUrl, cfSandboxKey)
        } catch {}
        // toolRegistry keeps its own module-level copy — wire it too so the
        // sandbox_exec / execute_code tools see the credentials.
        try { setToolSandboxConfig(cfSandboxUrl, cfSandboxKey) } catch {}
      }

      // Set Daytona API key from server-side env (primary sandbox provider)
      const daytonaKey = await getEnvVar('DAYTONA_API_KEY')
      if (daytonaKey) {
        try {
          const daytonaMod = await import('@/lib/daytona')
          daytonaMod.setDaytonaApiKey(daytonaKey)
          const daytonaUrl = await getEnvVar('DAYTONA_API_URL')
          if (daytonaUrl) daytonaMod.setDaytonaConfig({ apiUrl: daytonaUrl })
        } catch {}
      }

      // Set Docker host URL from server-side env (self-hosted sandbox fallback)
      const dockerHostUrl = await getEnvVar('DOCKER_HOST_URL')
      if (dockerHostUrl) {
        try {
          const dockerMod = await import('@/lib/dockerSandbox')
          dockerMod.setDockerHost(dockerHostUrl)
        } catch {}
      }

      // Set GitHub token and default repo from server-side env if available (for codespaces tool)
      const githubToken = await getEnvVar('GITHUB_TOKEN')
      if (githubToken) {
        try {
          const csMod = await import('@/lib/codespaces')
          csMod.setGitHubToken(githubToken)
          const defaultRepo = await getEnvVar('GITHUB_DEFAULT_REPO')
          if (defaultRepo) csMod.setDefaultRepository(defaultRepo)
        } catch {}
      }

      const toolResults = {}

      // Execute all tool calls
      const EXEC_TOOLS = new Set(['execute_code', 'sandbox_exec', 'run_code', 'run_on_gpu'])
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name
        // Tell SSE clients what is running before it starts — image
        // generation takes 5-15s and a status event lets the client swap
        // the generic thinking indicator for a dedicated shimmer card.
        // Non-streaming requests have no `send`; legacy clients ignore
        // unknown event types.
        // v5.13: exec tools carry a second `exec` frame with the code payload
        // — the client auto-opens Live Terminal and mirrors the process.
        let execArgs = {}
        if (EXEC_TOOLS.has(toolName)) {
          try { execArgs = JSON.parse(toolCall.function.arguments) || {} } catch {}
        }
        if (send) {
          try { send({ type: 'status', tool: toolName, phase: 'start' }) } catch {}
          if (EXEC_TOOLS.has(toolName)) {
            const code = String(execArgs.code || execArgs.command || execArgs.script || '').slice(0, 8000)
            if (code) {
              try { send({ type: 'status', tool: toolName, phase: 'exec', code, language_id: execArgs.language_id || null }) } catch {}
            }
          }
        }
        const handler = toolHandlers[toolName]
        if (handler) {
          try {
            const args = JSON.parse(toolCall.function.arguments)
            const toolResult = await handler(args, toolContext)
            toolResults[toolCall.id] = toolResult
            // v5.13: exec tools emit a done frame with the output so the
            // terminal can show the result before switching back to chat.
            if (send && EXEC_TOOLS.has(toolName)) {
              let out = ''
              let exitCode = null
              let success = null
              try {
                const parsed = JSON.parse(toolResult)
                out = String(parsed.output || parsed.stdout || '').slice(0, 8000)
                exitCode = parsed.exit_code ?? parsed.exitCode ?? null
                success = typeof parsed.success === 'boolean' ? parsed.success : null
              } catch {
                out = String(toolResult || '').slice(0, 2000)
              }
              try { send({ type: 'status', tool: toolName, phase: 'done', output: out, exit_code: exitCode, success }) } catch {}
            }
          } catch (err) {
            toolResults[toolCall.id] = `Tool error: ${err.message}`
            if (send && EXEC_TOOLS.has(toolName)) {
              try { send({ type: 'status', tool: toolName, phase: 'done', output: `Tool error: ${err.message}`, exit_code: 1, success: false }) } catch {}
            }
          }
        } else {
          toolResults[toolCall.id] = `Unknown tool: ${toolName}`
        }
      }

      // Build tool response messages
      const toolMessages = [message]
      for (const toolCall of message.tool_calls) {
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResults[toolCall.id] || 'No result'
        })
      }

      // ── Optimize: skip second LLM call for image generation ──
      // When generate_image succeeds, the client already renders the image
      // from imageData. A second LLM call to "summarize" wastes 5-10s and
      // risks hitting CF Workers' 30s deadline. Instead, use a fast reply.
      const isImageOnly = message.tool_calls.length === 1 && message.tool_calls[0].function.name === 'generate_image'
      let reply
      let artifacts = []

      if (isImageOnly) {
        // Fast path: skip second LLM call, return a minimal confirmation.
        // v5.15 — the parse is guarded now: the tool handler returns JSON on
        // both success and failure, but any legacy/plain-text result (or a
        // malformed payload) used to throw here and 500 the whole request —
        // the direct cause of the "Something went wrong" card on image gen.
        let imgResult = {}
        try { imgResult = JSON.parse(toolResults[message.tool_calls[0].id] || '{}') || {} } catch { imgResult = {} }
        if (imgResult && imgResult.success && imgResult.base64) {
          reply = `Here's your image — hot off the canvas. Want any tweaks, like a different mood, style or angle?`
        } else {
          // Graceful, human failure copy. The service-level retries already
          // ran (flux → turbo → flux) before we land here, so this is honest.
          reply = `I couldn't generate that image just now — the image service is a little busy. Give it another go in a moment and it should come through.`
        }
      } else {
        // Normal path: second LLM call to synthesize tool results into a reply.
        // Streamed in SSE mode — this is the long generation for tool queries.
        const finalParams = {
          model,
          messages: [...apiMessages, ...toolMessages],
          max_tokens: 4096,
          ...(model === VISION_MODEL
            ? { reasoning_effort: 'none' }
            : { reasoning_effort: 'low' }), // fast post-tool synthesis
          tools: relevantTools,
          tool_choice: 'none'
        }
        const finalChat = send
          ? await aiChatComplete(finalParams, { onDelta: (v) => send({ type: 'delta', v }), stream: true })
          : await aiChatComplete(finalParams, { stream: false })
        reply = polishReply(finalChat.choices[0].message.content)
        if (!reply || !String(reply).trim()) {
          // Empty second-pass reply — synthesize from the raw tool results so
          // the user still sees what the tools returned instead of a blank
          // bubble (which the client renders as a generic failure).
          const toolSummary = toolMessages
            .map(t => String(t.content || '').slice(0, 400))
            .filter(Boolean)
            .join('\n\n')
          reply = toolSummary
            ? `Here's what I found:\n\n${toolSummary}`
            : "The tool ran but I couldn't summarize the results — please try again."
        }
        artifacts = extractArtifacts(reply)
      }

      // Save session. Identity comes from the verified JWT (chatUser),
      // never the client-supplied body userId.
      if (chatUser?.id && sessionId) {
        try {
          const { data: session } = await admin
            .from('chat_sessions')
            .select('messages')
            .eq('id', sessionId)
            .eq('user_id', chatUser.id)
            .single()

          // Mirror the normal path: store a filename-only image reference,
          // not megabytes of base64, so history stays cheap to load.
          let storedUserMsg = { ...messages.slice(-1)[0] }
          if (hasImage) {
            storedUserMsg = { role: 'user', content: `[Image: ${imageFileName}]${imageText ? '\n' + imageText : ''}` }
          }

          await admin.from('chat_sessions').upsert({
            id: sessionId, user_id: chatUser.id,
            messages: [...prevMessages(session), storedUserMsg, { role: 'assistant', content: reply }],
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
        } catch (_) {}
      }

      // Build response metadata
      const response = { reply, model: chat._provider === 'gemini' ? (chat.model || model) : model }
      // Check which tools were used for UI indicators
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name
        if (name === 'web_search') {
          try { response.searchUsed = true; response.searchQuery = JSON.parse(toolCall.function.arguments).query } catch {}
        }
        if (name === 'execute_code' || name === 'calculate_math' || name === 'format_json' || name === 'color_palette') {
          response.codeExecuted = true
        }
        if (name === 'sandbox_exec' || name === 'sandbox_file' || name === 'sandbox_git') {
          response.codeExecuted = true
          response.sandboxUsed = true
        }
        if (name === 'run_on_gpu') {
          response.codeExecuted = true
          response.gpuUsed = true
          try {
            const gpuArgs = JSON.parse(toolCall.function.arguments)
            response.accelerator = gpuArgs.gpu || gpuArgs.tpu || 'T4'
          } catch {}
        }
        if (name === 'run_code') {
          response.codeExecuted = true
          response.remoteExecUsed = true
          try {
            const codeArgs = JSON.parse(toolCall.function.arguments)
            response.execLanguage = codeArgs.language || 'python'
          } catch {}
        }
        if (name === 'generate_downloadable') {
          try {
            const dlResult = JSON.parse(toolResults[toolCall.id])
            if (dlResult.success) {
              response.downloadFile = {
                filename: dlResult.filename,
                data_url: dlResult.data_url,
                download_url: dlResult.download_url,
                download_body: dlResult.download_body,
                path: dlResult.path,
                size: dlResult.size,
                executor: dlResult.executor,
              }
            }
          } catch {}
        }
        if (name === 'read_url' || name === 'web_scrape') {
          try { response.urlRead = true; response.urlReadSource = 'jina' } catch {}
        }
        if (name === 'generate_image') {
          try {
            const imgResult = JSON.parse(toolResults[toolCall.id])
            if (imgResult.base64) {
              response.imageGenerated = true
              response.imageData = `data:image/jpeg;base64,${imgResult.base64}`
              response.imagePrompt = imgResult.prompt
            }
          } catch {}
        }
        if (name === 'recommend_opportunities') {
          try {
            const oppResult = JSON.parse(toolResults[toolCall.id])
            const cleanOpps = sanitizeOpportunityList(oppResult.opportunities)
            if (cleanOpps.length > 0) {
              response.opportunityCards = cleanOpps
            }
          } catch {}
        }
        if (name === 'deploy_site') {
          try {
            const deployResult = JSON.parse(toolResults[toolCall.id])
            if (deployResult.success) {
              response.siteDeployed = true
              response.deployUrl = deployResult.url
              response.deployProject = deployResult.project_name
              // Pass file contents so the new CodePreviewCard can render
              // HTML / CSS / JS tabs alongside the live preview iframe.
              if (deployResult.html) response.deployHtml = deployResult.html
              if (deployResult.css)  response.deployCss  = deployResult.css
              if (deployResult.js)   response.deployJs   = deployResult.js
            }
          } catch {}
        }
      }
      const cleanArtifacts = sanitizeArtifactList(artifacts)
      if (cleanArtifacts.length > 0) response.artifacts = cleanArtifacts
      // Background wiki ingest (non-blocking — fire and forget)
      ingestToWiki(admin, { userMessage: lastUserMsg.content, assistantReply: reply, userId })
      if (send) {
        await genRecorder?.finish(response)
        send({ type: 'done', ...response })
        await pushIfDisconnected({ title: 'Kivora', body: 'Your reply is ready.', url: '/chat' })
        return null
      }
      return Response.json(response)
    }

    // Normal response (no tool calls)
    let reply = polishReply(message.content)

    // ── Empty-reply hardening ──
    // Some providers occasionally return HTTP 200 with empty content (content
    // filters, mid-stream truncation). An empty reply renders client-side as
    // a generic "Something went wrong" — unacceptable. Retry once without
    // tools, then fall back to an honest, actionable message.
    if ((!reply || !String(reply).trim()) && !hasImage) {
      console.warn('[chat] empty reply from', model, '— retrying without tools')
      try {
        const retryChat = await aiChat({
          model,
          messages: apiMessages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: 2048,
        })
        reply = polishReply(retryChat?.choices?.[0]?.message?.content || '')
      } catch (retryErr) {
        console.warn('[chat] empty-reply retry failed:', String(retryErr?.message || retryErr).slice(0, 100))
      }
    }
    if (!reply || !String(reply).trim()) {
      reply = "I received your message but couldn't compose a reply this time. Please send it again — if it keeps happening, try rephrasing or switching models."
    }
    const artifacts = extractArtifacts(reply)

    // Save session. Identity comes from the verified JWT (chatUser),
    // never the client-supplied body userId.
    if (chatUser?.id && sessionId) {
      try {
        const { data: session } = await admin
          .from('chat_sessions')
          .select('messages')
          .eq('id', sessionId)
          .eq('user_id', chatUser.id)
          .single()

        let storedUserMsg = { ...messages.slice(-1)[0] }
        if (hasImage) {
          storedUserMsg = { role: 'user', content: `[Image: ${imageFileName}]${imageText ? '\n' + imageText : ''}` }
        }

        await admin.from('chat_sessions').upsert({
          id: sessionId, user_id: chatUser.id,
          messages: [...prevMessages(session), storedUserMsg, { role: 'assistant', content: reply }],
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
      } catch (_) {}
    }

    const response = { reply, model, searchUsed: false }
    const cleanArtifactsJson = sanitizeArtifactList(artifacts)
    if (cleanArtifactsJson.length > 0) response.artifacts = cleanArtifactsJson
    // Background wiki ingest (non-blocking — fire and forget)
    ingestToWiki(admin, { userMessage: lastUserMsg.content, assistantReply: reply, userId })
    if (send) {
      await genRecorder?.finish(response)
      send({ type: 'done', ...response })
      await pushIfDisconnected({ title: 'Kivora', body: 'Your reply is ready.', url: '/chat' })
      return null
    }
    return Response.json(response)
  } catch (err) {
    console.error('[chat]', err)
    // Record the crash so a reconnecting client gets the same terminal
    // error instead of polling a buffer that will never resolve.
    try { await genRecorder?.fail({ error: 'I hit a snag reaching the AI service. Please try again in a moment.' }) } catch {}
    try { await pushIfDisconnected({ title: 'Kivora', body: 'A reply hit an error in the background — it\'s saved, tap to retry.', url: '/chat', tag: 'kivora-chat-error' }) } catch {}

    // Refund credits on failure — the chat didn't complete
    if (admin && chatUser?.id) {
      try {
        await refundCredits(admin, chatUser.id, CREDIT_COSTS[chatAction], chatAction,
          err instanceof GroqError ? err.code : (err.name || 'unknown'))
      } catch (refundErr) {
        console.error('[chat] refund failed:', refundErr)
      }
    }

    if (err instanceof GroqError && err.code === 'GROQ_QUOTA_EXCEEDED') {
      return json({
        error: 'Too many requests, try again later.',
        quotaExceeded: true,
      }, 429)
    }
    // Generic friendly error — never expose the underlying provider's HTML
    // error page (e.g. Cerebras's Cloudflare WAF 403 challenge page) or
    // provider-specific status codes. Detailed providerOutcomes stay server-
    // side EXCEPT a sanitized copy (provider names + HTTP statuses only —
    // no keys, no payloads) attached as `debug`, so vision-chain outages are
    // diagnosable from a single production request.
    const debugOutcomes = Array.isArray(err?.providerOutcomes)
      ? err.providerOutcomes.map(o => ({
          provider: o.name,
          status: o.status,
          http_status: o.http_status,
        }))
      : undefined
    return json({
      error: 'I hit a snag reaching the AI service. Please try again in a moment.',
      ...(debugOutcomes ? { debug: debugOutcomes } : {}),
    }, 503)
  }
}
