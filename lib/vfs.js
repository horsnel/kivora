// ════════════════════════════════════════════════════════════════════
// lib/vfs.js — Kivora Agent Workspace (v5.27)
//
// A persistent virtual file system for the AI agent, backed by Supabase
// (public.agent_files table + 'agent-files' storage bucket). This is the
// fix for the reported snag: "no file system to save executed files" —
// on Cloudflare Pages there is no Daytona/Docker/Cloudflare Sandbox, so
// the terminal ran on ephemeral Judge0 and every created file vanished.
//
// Three integration points:
//   1. sandbox_file  → VFS tier: read/write/ls/mkdir/rm persist per user
//                      per workspace (sandbox_id doubles as workspace).
//   2. sandbox_exec  → the Judge0 fallback now STAGES the workspace's
//                      files into the ephemeral container before the
//                      command and AUTO-CAPTURES files the command
//                      creates (find -newer marker + base64 markers) —
//                      the terminal effectively has a real workspace.
//   3. generate_downloadable → every downloadable file is ALSO saved
//                      into the workspace, so downloads survive the chat.
//
// Layout rules:
//   - path: workspace-relative, no leading '/', no '..' segments,
//     charset [A-Za-z0-9._/ -] (bash-safe), depth ≤ 10, ≤ 240 chars
//   - text ≤ 256 KB → content column; anything else → storage bucket
//   - limits: 500 files/user, 5 MB/file
//
// Pure helpers (normalizePath, mimeFor, buildWorkspaceScript,
// parseCapturedOutput, formatBytes) are exported for tests.
// ════════════════════════════════════════════════════════════════════

export const VFS_LIMITS = {
  MAX_TEXT_DB: 256 * 1024, // content column threshold (UTF-8 bytes)
  MAX_FILE: 5 * 1024 * 1024, // 5 MB per file
  MAX_FILES: 500, // per user, across workspaces
  STAGE_MAX_FILES: 60, // files staged into an exec run
  STAGE_MAX_FILE_KB: 96, // staged file size cap (base64 in bash)
  CAPTURE_MAX_FILES: 12, // files auto-captured per exec run
  CAPTURE_MAX_FILE_KB: 96, // captured file size cap (stdout budget)
  WORKSPACE_RE: /^[a-zA-Z0-9._-]{1,40}$/,
}

const MIME_BY_EXT = {
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values',
  json: 'application/json', xml: 'text/xml', yaml: 'text/yaml', yml: 'text/yaml',
  html: 'text/html', htm: 'text/html', css: 'text/css', svg: 'image/svg+xml',
  js: 'text/javascript', mjs: 'text/javascript', jsx: 'text/javascript',
  ts: 'text/typescript', tsx: 'text/typescript',
  py: 'text/x-python', rb: 'text/x-ruby', php: 'text/x-php', sh: 'text/x-shellscript', bash: 'text/x-shellscript',
  c: 'text/x-csrc', h: 'text/x-csrc', cpp: 'text/x-c++src', hpp: 'text/x-c++src', cs: 'text/x-csharp',
  java: 'text/x-java', go: 'text/x-go', rs: 'text/x-rust', sql: 'text/x-sql', r: 'text/x-r',
  ini: 'text/plain', cfg: 'text/plain', conf: 'text/plain', env: 'text/plain', log: 'text/plain',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon',
  pdf: 'application/pdf', zip: 'application/zip', gz: 'application/gzip', wasm: 'application/wasm',
  mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
}

export function mimeFor(path) {
  const ext = String(path || '').split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

export function isTextMime(mime) {
  return typeof mime === 'string' && (mime.startsWith('text/') || ['application/json', 'image/svg+xml', 'application/xml', 'application/javascript', 'application/x-yaml'].includes(mime))
}

// ── path normalization — the security wall ──────────────────────────
// Returns { ok: true, path } or { ok: false, reason }.
export function normalizePath(raw) {
  let p = String(raw || '').trim().replace(/\\/g, '/')
  if (p.startsWith('/')) p = p.slice(1)
  if (!p) return { ok: false, reason: 'empty path' }
  if (p.length > 240) return { ok: false, reason: 'path too long' }
  const segs = p.split('/')
  if (segs.length > 10) return { ok: false, reason: 'too deep' }
  for (const s of segs) {
    if (!s || s === '.' || s === '..') return { ok: false, reason: `invalid segment "${s}"` }
    if (!/^[A-Za-z0-9._ -]{1,120}$/.test(s)) return { ok: false, reason: `illegal characters in "${s}"` }
  }
  return { ok: true, path: segs.join('/') }
}

export function normalizeWorkspace(ws) {
  const w = String(ws || 'default').trim()
  return VFS_LIMITS.WORKSPACE_RE.test(w) ? w : null
}

export function formatBytes(n) {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(2)} MB`
}

// ── exec wrapper: stage the workspace + capture created files ───────
// The whole thing degrades silently — if base64/find are unavailable or
// anything fails, the USER COMMAND still runs exactly as before.
// files: [{ path, b64 }] (text or binary, already base64)
export function buildWorkspaceScript(command, files = [], opts = {}) {
  const stageMax = opts.stageMaxFiles ?? VFS_LIMITS.STAGE_MAX_FILES
  const capMax = opts.captureMaxFiles ?? VFS_LIMITS.CAPTURE_MAX_FILES
  const capKb = opts.captureMaxFileKb ?? VFS_LIMITS.CAPTURE_MAX_FILE_KB
  const parts = []
  parts.push('set +e')
  parts.push("mkdir -p /tmp/kvws 2>/dev/null || true")
  parts.push('cd /tmp/kvws 2>/dev/null || true')
  for (const f of files.slice(0, stageMax)) {
    const n = normalizePath(f.path)
    if (!n.ok) continue
    const dir = n.path.includes('/') ? n.path.slice(0, n.path.lastIndexOf('/')) : ''
    if (dir) parts.push(`mkdir -p '${dir}' 2>/dev/null || true`)
    // base64 alphabet never contains single quotes — safe to inline
    parts.push(`printf '%s' '${f.b64}' | base64 -d > '${n.path}' 2>/dev/null || true`)
  }
  parts.push('touch .kv_mark 2>/dev/null || true')
  // snapshot BEFORE the command — timestamp granularity on container
  // filesystems can be coarse (same-tick files share mtimes, which breaks
  // a pure `find -newer` capture), so new files are detected by a LIST
  // DIFF (comm) with the -newer check as a secondary source.
  parts.push("find . -type f -not -name '.kv_mark' 2>/dev/null | sort > /tmp/kv_before 2>/dev/null || true")
  parts.push(String(command || ''))
  parts.push('__KV_RC=$?')
  parts.push("find . -type f -not -name '.kv_mark' 2>/dev/null | sort > /tmp/kv_after 2>/dev/null || true")
  parts.push(
    `{ comm -13 /tmp/kv_before /tmp/kv_after 2>/dev/null; find . -type f -newer .kv_mark -not -name '.kv_mark' -size -${capKb}k 2>/dev/null; } 2>/dev/null | sort -u | sed 's/^\\.\\///' | head -${capMax} | while IFS= read -r f; do [ -f "$f" ] || continue; [ "$(wc -c < "$f" 2>/dev/null)" -le ${capKb * 1024} ] || continue; echo "__KV_FILE__ $f"; base64 "$f" 2>/dev/null; echo "__KV_END__"; done || true`
  )
  parts.push('echo "__KV_RC__ $__KV_RC"')
  parts.push('exit 0')
  return parts.join('\n')
}

// Parses the wrapper's stdout: strips __KV_FILE__/__KV_END__ sections and
// the trailing __KV_RC__ marker; returns the clean output, captured files
// (base64) and the user command's exit code.
export function parseCapturedOutput(stdout) {
  const text = String(stdout || '')
  const files = []
  const outLines = []
  let cur = null
  let rc = null
  for (const line of text.split('\n')) {
    if (line.startsWith('__KV_FILE__ ')) {
      cur = { path: line.slice(12).trim(), b64: '' }
      continue
    }
    if (line === '__KV_END__') {
      if (cur && cur.path) {
        cur.b64 = cur.b64.replace(/\s+/g, '')
        files.push(cur)
      }
      cur = null
      continue
    }
    const m = /^__KV_RC__ (-?\d+)\s*$/.exec(line)
    if (m) {
      rc = parseInt(m[1], 10)
      continue
    }
    if (cur) cur.b64 += line
    else outLines.push(line)
  }
  if (cur && cur.path) files.push(cur) // unterminated tail — still keep
  return { output: outLines.join('\n').replace(/\n+$/, ''), files, exitCode: rc }
}

// ── Supabase-backed operations ──────────────────────────────────────
// `admin` = service-role supabase-js client (from toolContext / route).

function b64ToBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function bytesToB64(bytes) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  return btoa(bin)
}

export async function vfsWrite(admin, userId, workspace, rawPath, content, opts = {}) {
  if (!admin || !userId) return { ok: false, reason: 'workspace_unavailable', detail: 'Sign in to save files to your workspace.' }
  const ws = normalizeWorkspace(workspace)
  if (!ws) return { ok: false, reason: 'bad_workspace' }
  const n = normalizePath(rawPath)
  if (!n.ok) return { ok: false, reason: 'bad_path', detail: n.reason }

  let mime = opts.mime || mimeFor(n.path)
  let size = 0
  let dbContent = null
  let storagePath = null

  if (opts.isBase64) {
    // binary/base64 payload (auto-captured terminal files)
    const bytes = b64ToBytes(content)
    size = bytes.length
    if (size > VFS_LIMITS.MAX_FILE) return { ok: false, reason: 'too_large', detail: `max ${formatBytes(VFS_LIMITS.MAX_FILE)}` }
    if (isTextMime(mime)) {
      const text = new TextDecoder().decode(bytes)
      if (text.length <= VFS_LIMITS.MAX_TEXT_DB) dbContent = text
      else storagePath = `${userId}/${ws}/${n.path}`
    } else {
      storagePath = `${userId}/${ws}/${n.path}`
    }
    if (storagePath) {
      const up = await admin.storage.from('agent-files').upload(storagePath, bytes, { contentType: mime, upsert: true })
      if (up.error) return { ok: false, reason: 'storage_error', detail: up.error.message }
    }
  } else {
    const text = String(content ?? '')
    size = new TextEncoder().encode(text).length
    if (size > VFS_LIMITS.MAX_FILE) return { ok: false, reason: 'too_large', detail: `max ${formatBytes(VFS_LIMITS.MAX_FILE)}` }
    if (size <= VFS_LIMITS.MAX_TEXT_DB) dbContent = text
    else {
      storagePath = `${userId}/${ws}/${n.path}`
      const up = await admin.storage.from('agent-files').upload(storagePath, new TextEncoder().encode(text), { contentType: mime, upsert: true })
      if (up.error) return { ok: false, reason: 'storage_error', detail: up.error.message }
    }
  }

  // per-user file-count quota. `opts.fileCount` lets batch writers (git
  // clone) supply the current count once instead of one query per file —
  // they increment it locally as they write.
  const cnt = opts.fileCount != null
    ? { count: opts.fileCount, error: null }
    : await admin.from('agent_files').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (!cnt.error && cnt.count >= VFS_LIMITS.MAX_FILES) {
    // upserts of EXISTING paths must not be blocked by the quota — allow when the row exists
    const exists = await admin.from('agent_files').select('id').eq('user_id', userId).eq('workspace', ws).eq('path', n.path).maybeSingle()
    if (!exists.data) return { ok: false, reason: 'quota', detail: `workspace full (max ${VFS_LIMITS.MAX_FILES} files)` }
  }

  const row = {
    user_id: userId,
    workspace: ws,
    path: n.path,
    mime,
    size,
    content: dbContent,
    storage_path: storagePath,
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from('agent_files').upsert(row, { onConflict: 'user_id,workspace,path' })
  if (error) return { ok: false, reason: 'db_error', detail: error.message }
  return { ok: true, path: n.path, workspace: ws, size, mime, stored_in: storagePath ? 'storage' : 'db' }
}

export async function vfsRead(admin, userId, workspace, rawPath) {
  if (!admin || !userId) return { ok: false, reason: 'workspace_unavailable', detail: 'Sign in to use your workspace.' }
  const ws = normalizeWorkspace(workspace)
  const n = normalizePath(rawPath)
  if (!ws) return { ok: false, reason: 'bad_workspace' }
  if (!n.ok) return { ok: false, reason: 'bad_path', detail: n.reason }
  const { data, error } = await admin
    .from('agent_files')
    .select('path, mime, size, content, storage_path, updated_at')
    .eq('user_id', userId)
    .eq('workspace', ws)
    .eq('path', n.path)
    .maybeSingle()
  if (error) return { ok: false, reason: 'db_error', detail: error.message }
  if (!data) return { ok: false, reason: 'not_found' }
  let content = data.content
  if (content == null && data.storage_path) {
    const dl = await admin.storage.from('agent-files').download(data.storage_path)
    if (dl.error) return { ok: false, reason: 'storage_error', detail: dl.error.message }
    const buf = await dl.data.arrayBuffer()
    content = isTextMime(data.mime) ? new TextDecoder().decode(buf) : bytesToB64(new Uint8Array(buf))
    return { ok: true, path: data.path, mime: data.mime, size: data.size, updated_at: data.updated_at, content, isBase64: !isTextMime(data.mime) }
  }
  return { ok: true, path: data.path, mime: data.mime, size: data.size, updated_at: data.updated_at, content: content ?? '', isBase64: false }
}

export async function vfsList(admin, userId, workspace, prefix = '') {
  if (!admin || !userId) return { ok: false, reason: 'workspace_unavailable', detail: 'Sign in to use your workspace.' }
  const ws = normalizeWorkspace(workspace)
  if (!ws) return { ok: false, reason: 'bad_workspace' }
  let q = admin
    .from('agent_files')
    .select('path, mime, size, updated_at')
    .eq('user_id', userId)
    .eq('workspace', ws)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (prefix) {
    const np = normalizePath(prefix)
    if (np.ok) q = q.like('path', `${np.path}/%`)
  }
  const { data, error } = await q
  if (error) return { ok: false, reason: 'db_error', detail: error.message }
  return { ok: true, workspace: ws, files: (data || []).map((f) => ({ path: f.path, mime: f.mime, size: f.size, updated_at: f.updated_at })) }
}

export async function vfsDelete(admin, userId, workspace, rawPath) {
  if (!admin || !userId) return { ok: false, reason: 'workspace_unavailable', detail: 'Sign in to use your workspace.' }
  const ws = normalizeWorkspace(workspace)
  const n = normalizePath(rawPath)
  if (!ws) return { ok: false, reason: 'bad_workspace' }
  if (!n.ok) return { ok: false, reason: 'bad_path', detail: n.reason }
  const sel = await admin.from('agent_files').select('storage_path').eq('user_id', userId).eq('workspace', ws).eq('path', n.path).maybeSingle()
  if (sel.error) return { ok: false, reason: 'db_error', detail: sel.error.message }
  if (!sel.data) return { ok: false, reason: 'not_found' }
  if (sel.data.storage_path) await admin.storage.from('agent-files').remove([sel.data.storage_path])
  const { error } = await admin.from('agent_files').delete().eq('user_id', userId).eq('workspace', ws).eq('path', n.path)
  if (error) return { ok: false, reason: 'db_error', detail: error.message }
  return { ok: true }
}
