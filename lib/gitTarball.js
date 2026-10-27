// ════════════════════════════════════════════════════════════════════
// lib/gitTarball.js — workspace git clone engine (v5.28)
//
// On Cloudflare Pages there is no Daytona/Docker/Cloudflare Sandbox, so
// `sandbox_git` previously died with "No sandbox provider configured".
// This module gives the chat AI a real clone path that needs NO sandbox
// and NO git binary: it downloads the repo's tarball (GitHub codeload /
// GitLab archive), gunzips it with the runtime-native DecompressionStream
// and parses the tar stream in pure JS — then the caller writes the
// entries into the user's persistent VFS workspace (lib/vfs.js).
//
// A tarball snapshot of HEAD ≈ `git clone --depth 1` for the agent's
// purpose: full working tree, no history — exactly what analysis, file
// reading and workspace runs need.
//
// Pure functions only (parseRepoInput, tarballUrls, parseTar, gunzip,
// asciiSafePath, stripCommonRoot) — everything is unit-testable, and the
// parser never touches the network.
// ════════════════════════════════════════════════════════════════════

// ── clone caps (kept deliberately below the VFS limits of 500 files /
//    5 MB per file so a clone never strands the user's quota) ─────────
export const CLONE_LIMITS = {
  MAX_GZIP_BYTES: 48 * 1024 * 1024, // compressed download buffer cap
  MAX_TOTAL_BYTES: 28 * 1024 * 1024, // uncompressed payload cap
  MAX_FILES: 400, // entries written per clone (VFS quota is 500)
  MAX_FILE_BYTES: 4 * 1024 * 1024, // per-entry cap (VFS MAX_FILE is 5 MB)
  TREE_PREVIEW: 60, // paths echoed back to the model
}

// ── repo URL parsing ────────────────────────────────────────────────
// Accepts: https://github.com/o/r, github.com/o/r/tree/branch/sub/dir,
// git@github.com:o/r.git, https://gitlab.com/g/s/r(/-/tree/ref),
// and the short form "owner/repo" (assumed GitHub).
// Returns { ok:false, reason } | { ok:true, kind, owner, repo, ref, subpath, repoName }
export function parseRepoInput(raw) {
  let s = String(raw || '').trim()
  if (!s) return { ok: false, reason: 'empty_url' }
  // scp-like syntax: git@host:path
  const scp = /^git@([^:/]+):(.+?)(?:\.git)?\/?$/i.exec(s)
  if (scp) s = `https://${scp[1]}/${scp[2]}`
  s = s.replace(/\.git$/i, '').replace(/\/+$/, '')
  // scheme-less but host-prefixed → assume https
  if (!s.includes('://') && /^(www\.)?(github\.com|gitlab\.com)\//i.test(s)) s = `https://${s}`
  // short form: owner/repo (no scheme, single segment pair, no host dots)
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s) && !s.includes('://')) {
    s = `https://github.com/${s}`
  }
  let u
  try {
    u = new URL(s)
  } catch {
    return { ok: false, reason: 'unparseable_url' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: 'unsupported_protocol' }
  const host = u.hostname.replace(/^www\./i, '').toLowerCase()
  const segs = u.pathname.split('/').filter(Boolean)

  if (host === 'github.com') {
    if (segs.length < 2) return { ok: false, reason: 'github_needs_owner_repo' }
    const [owner, repo, ...rest] = segs
    let ref = null
    let subpath = null
    // /tree/<ref>(/sub/dir…) — optional sub-directory clone
    if (rest[0] === 'tree' && rest[1]) {
      ref = decodeURIComponent(rest[1])
      if (rest.length > 2) subpath = decodeURIComponent(rest.slice(2).join('/'))
    } else if (rest[0] === 'blob') {
      return { ok: false, reason: 'blob_url_not_repo', detail: 'Pass the repository URL (github.com/owner/repo), not a single file.' }
    }
    return { ok: true, kind: 'github', owner, repo, ref, subpath: subpath || null, repoName: repo }
  }

  if (host === 'gitlab.com') {
    // /groups(/groups…)/repo(/-/tree/ref)? — subgroups fold into the path
    let ref = null
    let path = segs
    const tIdx = segs.indexOf('tree')
    if (tIdx !== -1 && segs[tIdx - 1] === '-' && segs[tIdx + 1]) {
      ref = decodeURIComponent(segs[tIdx + 1])
      path = segs.slice(0, tIdx - 1)
    } else if (tIdx !== -1 && segs[tIdx + 1]) {
      ref = decodeURIComponent(segs[tIdx + 1])
      path = segs.slice(0, tIdx)
    }
    if (path.length < 2) return { ok: false, reason: 'gitlab_needs_path_repo' }
    const repo = path[path.length - 1]
    const owner = path.slice(0, -1).join('/')
    return { ok: true, kind: 'gitlab', owner, repo, ref, subpath: null, repoName: repo }
  }

  return { ok: false, reason: 'unsupported_host', detail: 'Supported hosts: github.com, gitlab.com (tarball snapshot; full working tree, no history).' }
}

// ── tarball URL candidates, in fallback order ───────────────────────
// GitHub codeload serves: /tar.gz/refs/heads/<ref>, /tar.gz/<ref>
// (legacy tag/sha form) and /tar.gz (default branch). GitLab serves
// /-/archive/<ref>/<anything>.tar.gz.
export function tarballUrls(info, refOverride) {
  const ref = refOverride ?? info.ref ?? null
  if (info.kind === 'github') {
    const base = `https://codeload.github.com/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.repo)}/tar.gz`
    if (ref) return [`${base}/refs/heads/${encodeURIComponent(ref)}`, `${base}/${encodeURIComponent(ref)}`, base]
    // codeload's bare /tar.gz form answers 404 for many repos today —
    // try the two dominant default-branch names first (the handler
    // probes api.github.com for the true default branch before this)
    return [`${base}/refs/heads/main`, `${base}/refs/heads/master`, base]
  }
  if (info.kind === 'gitlab') {
    const p = encodeURIComponent(`${info.owner}/${info.repo}`)
    const r = encodeURIComponent(ref || 'main')
    return [`https://gitlab.com/api/v4/projects/${p}/repository/archive.tar.gz?sha=${r}`]
  }
  return []
}

// GitLab default-branch probe (only needed when the URL carries no ref).
export const gitlabProjectApi = (info) =>
  `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${info.owner}/${info.repo}`)}`

// Polite upstream identity for tarball fetches (codeload requires a UA).
export const CLONE_UA = 'Kivora/5.28 (+https://kivora.pages.dev)'

// Human message for a rejected repo URL.
export function repoUrlError(info) {
  if (info?.detail) return info.detail
  switch (info?.reason) {
    case 'empty_url': return 'No repository URL was given.'
    case 'unparseable_url': return 'That URL could not be parsed.'
    case 'unsupported_protocol': return 'Only http(s) repository URLs are supported.'
    case 'github_needs_owner_repo': return 'GitHub URLs need owner and repo, e.g. github.com/owner/repo.'
    case 'blob_url_not_repo': return 'Pass the repository URL (github.com/owner/repo), not a single file.'
    case 'gitlab_needs_path_repo': return 'GitLab URLs need a project path, e.g. gitlab.com/group/project.'
    case 'unsupported_host': return 'Supported hosts: github.com, gitlab.com (tarball snapshot; full working tree, no history).'
    default: return 'That repository URL is not supported.'
  }
}

// ── gunzip with a hard byte cap (DecompressionStream is native in
//    Cloudflare Workers, Node 18+ and all modern browsers) ────────────
export async function gunzip(bodyStream, maxBytes = CLONE_LIMITS.MAX_GZIP_BYTES) {
  const out = bodyStream.pipeThrough(new DecompressionStream('gzip'))
  const reader = out.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      try { await reader.cancel() } catch {}
      throw new Error('decompressed_too_large')
    }
    chunks.push(value)
  }
  const all = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    all.set(c, off)
    off += c.byteLength
  }
  return all
}

// ── tar number parsing (octal text or GNU base-256 binary) ──────────
function tarSize(buf, off) {
  if (buf[off] & 0x80) {
    // base-256: high bit of first byte set, remaining bits big-endian
    let v = buf[off] & 0x7f
    for (let i = off + 1; i < off + 12; i++) v = v * 256 + buf[i]
    return v
  }
  let v = 0
  let started = false
  for (let i = off; i < off + 12; i++) {
    const c = buf[i]
    if (c === 0 || c === 0x20) {
      if (started) break
      continue
    }
    if (c < 0x30 || c > 0x37) break
    started = true
    v = v * 8 + (c - 0x30)
  }
  return v
}

function tarStr(buf, start, len) {
  let end = start
  const lim = start + len
  while (end < lim && buf[end] !== 0) end++
  return new TextDecoder('utf-8', { fatal: false }).decode(buf.subarray(start, end))
}

// ── traversal wall — never let an archive path escape the clone dir ──
// Rejects absolute paths, '..' segments and NULs BEFORE any name
// sanitizing (sanitizing must never rescue a malicious path).
export function safeExtractPath(name) {
  const p = String(name || '').replace(/\\/g, '/').replace(/\0/g, '')
  if (!p || p.startsWith('/')) return null
  const segs = p.split('/')
  // generous SECURITY sanity cap only — VFS depth policy (≤10 segments)
  // is enforced by normalizePath/vfsWrite at write time, not here
  if (segs.length > 40) return null
  for (const s of segs) {
    if (!s || s === '.' || s === '..') return null
    if (/^[A-Za-z]:/.test(s)) return null // windows drive letter
    if (s.includes('\0')) return null
  }
  return segs.join('/')
}

// Map a path onto the VFS charset ([A-Za-z0-9._ -] per segment) by
// replacing illegal characters with '_'. Returns { path, renamed }.
export function asciiSafePath(p) {
  const segs = String(p).split('/')
  let renamed = false
  const out = segs.map((s) => {
    let clean = ''
    let changed = false
    for (const ch of s) {
      if (/[A-Za-z0-9._ -]/.test(ch)) clean += ch
      else {
        clean += '_'
        changed = true
      }
    }
    clean = clean.replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '') || 'file'
    if (changed) renamed = true
    return clean
  })
  return { path: out.join('/'), renamed }
}

// Strip the single common leading directory every archive entry shares
// (e.g. "kivora-main/", "repo-ref-abc1234/"). Returns { files, root }.
export function stripCommonRoot(files) {
  if (!files.length) return { files, root: null }
  const first = files[0].path.split('/')
  if (first.length < 2) return { files, root: null }
  const root = first[0]
  for (const f of files) {
    if (!f.path.startsWith(root + '/')) return { files, root: null }
  }
  return {
    files: files.map((f) => ({ ...f, path: f.path.slice(root.length + 1) })),
    root,
  }
}

// ── the tar parser ──────────────────────────────────────────────────
// Handles ustar (with prefix field), GNU long names ('L') and pax
// extended headers ('x', path/size overrides). Regular files and
// directories are returned; links/specials are counted as skipped.
// Caps: maxFiles / maxTotalBytes / maxFileBytes — when a cap trips the
// parser sets `truncated` and stops cleanly (no throw).
export function parseTar(buf, opts = {}) {
  const maxFiles = opts.maxFiles ?? CLONE_LIMITS.MAX_FILES
  const maxTotalBytes = opts.maxTotalBytes ?? CLONE_LIMITS.MAX_TOTAL_BYTES
  const maxFileBytes = opts.maxFileBytes ?? CLONE_LIMITS.MAX_FILE_BYTES
  const files = []
  const skipped = []
  let dirs = 0
  let truncated = false
  let totalBytes = 0

  let off = 0
  // pending long-name state (applies to the next header)
  let pendingName = null // from GNU 'L' or pax 'path'
  let pendingSize = null // from pax 'size'

  const finish = () => ({ files, skipped, dirs, truncated })

  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512)
    // end-of-archive: fully zero block
    let allZero = true
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        allZero = false
        break
      }
    }
    if (allZero) break

    const size = pendingSize ?? tarSize(header, 124)
    const typeflag = String.fromCharCode(header[156] || 0x30)
    const dataLen = Math.ceil(size / 512) * 512
    const dataStart = off + 512
    if (dataStart + dataLen > buf.length) break // corrupt tail

    let name = pendingName ?? tarStr(header, 0, 100)
    const prefix = tarStr(header, 345, 155)
    if (!pendingName && prefix && /^ustar/.test(tarStr(header, 257, 6))) {
      name = `${prefix}/${name}`
    }
    pendingName = null
    pendingSize = null

    const data = buf.subarray(dataStart, dataStart + size)

    if (typeflag === 'L') {
      // GNU long name for the next entry
      pendingName = tarStr(data, 0, size)
      off = dataStart + dataLen
      continue
    }
    if (typeflag === 'x' || typeflag === 'X') {
      // pax extended header: "len key=value\n" records
      let paxName = null
      let paxSize = null
      try {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(data)
        for (const m of text.matchAll(/(?:^|\n)(\d+) ([^=]+)=([^\n]*)/g)) {
          const key = m[2]
          const val = m[3]
          if (key === 'path') paxName = val
          else if (key === 'size') paxSize = parseInt(val, 10)
        }
      } catch {}
      if (paxName) pendingName = paxName
      if (paxSize != null && !Number.isNaN(paxSize)) pendingSize = paxSize
      off = dataStart + dataLen
      continue
    }
    if (typeflag === 'g' || typeflag === '5') {
      if (typeflag === '5') dirs++
      off = dataStart + dataLen
      continue
    }
    if (typeflag !== '0' && typeflag !== '\0' && typeflag !== '7') {
      skipped.push({ path: name, reason: 'link_or_special' })
      off = dataStart + dataLen
      continue
    }

    // regular file
    off = dataStart + dataLen

    const safe = safeExtractPath(name)
    if (!safe) {
      skipped.push({ path: name, reason: 'unsafe_path' })
      continue
    }
    if (size > maxFileBytes) {
      skipped.push({ path: safe, reason: 'file_too_large' })
      continue
    }
    if (files.length >= maxFiles) {
      truncated = true
      break
    }
    if (totalBytes + size > maxTotalBytes) {
      truncated = true
      break
    }
    files.push({ path: safe, bytes: new Uint8Array(data) })
    totalBytes += size
  }

  return finish()
}
