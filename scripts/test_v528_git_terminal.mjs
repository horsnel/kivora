#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v528_git_terminal.mjs — sandbox_git workspace clone + terminal
// workspace listing:
//   1. parseRepoInput / tarballUrls  (URL forms, hosts, fallbacks)
//   2. gunzip                        (real gzip + byte-cap trip)
//   3. parseTar                      (ustar, pax path/size, GNU 'L',
//                                     prefix field, traversal wall,
//                                     symlink skip, caps → truncated)
//   4. REAL archive from the tar CLI (pax-format, unicode + long paths,
//                                     binary content) — full pipeline
//                                     gunzip → parseTar → stripCommonRoot
//   5. REAL GitHub tarball           (octocat/Hello-World via codeload;
//                                     + 404 branch fallback order)
//   6. registry integration          (handler ctx, caps, quota batch,
//                                     anon boundary, description/instructions)
//   7. UI wiring                     (TerminalWorkspace + ChatClient)
//   8. i18n                          (4×1027 parity, new keys)
// ════════════════════════════════════════════════════════════════════
import { readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

let pass = 0, fail = 0
const failures = []
const ok = (c, name) => { if (c) { pass++ } else { fail++; failures.push(name); console.error('  ✗', name) } }
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)?.slice(0, 120)})`)

const gt = await import('../lib/gitTarball.js')
const { parseRepoInput, tarballUrls, gitlabProjectApi, parseTar, gunzip, stripCommonRoot, asciiSafePath, safeExtractPath, repoUrlError, CLONE_UA, CLONE_LIMITS } = gt

// ── 1. parseRepoInput ───────────────────────────────────────────────
console.log('1. parseRepoInput / tarballUrls')
{
  const g = parseRepoInput('https://github.com/octocat/Hello-World')
  ok(g.ok && g.kind === 'github' && g.owner === 'octocat' && g.repo === 'Hello-World' && g.ref === null && g.subpath === null, 'github https basic')
  eq(g.repoName, 'Hello-World', 'github repoName')

  const g2 = parseRepoInput('https://github.com/octocat/Hello-World.git')
  ok(g2.ok && g2.repo === 'Hello-World', 'github .git suffix stripped')

  const g3 = parseRepoInput('github.com/octocat/Hello-World')
  ok(g3.ok && g3.repo === 'Hello-World', 'github scheme-less accepted')

  const g4 = parseRepoInput('https://github.com/o/r/tree/main/packages/foo')
  ok(g4.ok && g4.ref === 'main' && g4.subpath === 'packages/foo', 'github tree ref + subpath')

  const g5 = parseRepoInput('https://github.com/o/r/blob/main/README.md')
  ok(!g5.ok && g5.reason === 'blob_url_not_repo', 'github blob URL rejected with hint')

  const g6 = parseRepoInput('git@github.com:octocat/Hello-World.git')
  ok(g6.ok && g6.kind === 'github' && g6.owner === 'octocat' && g6.repo === 'Hello-World', 'git@ scp form')

  const g7 = parseRepoInput('octocat/Hello-World')
  ok(g7.ok && g7.kind === 'github' && g7.owner === 'octocat', 'short owner/repo form → github')

  const l = parseRepoInput('https://gitlab.com/gnome-team/at-spi2-core')
  ok(l.ok && l.kind === 'gitlab' && l.owner === 'gnome-team' && l.repo === 'at-spi2-core' && l.ref === null, 'gitlab basic (no ref)')

  const l2 = parseRepoInput('https://gitlab.com/gitlab-org/gitlab/-/tree/master/qa')
  ok(l2.ok && l2.owner === 'gitlab-org' && l2.repo === 'gitlab' && l2.ref === 'master', 'gitlab tree ref')

  const l3 = parseRepoInput('https://gitlab.com/a/b/c/d')
  ok(l3.ok && l3.owner === 'a/b/c' && l3.repo === 'd', 'gitlab subgroups fold into owner path')

  ok(!parseRepoInput('https://bitbucket.org/o/r').ok && parseRepoInput('https://bitbucket.org/o/r').reason === 'unsupported_host', 'unsupported host rejected')
  ok(!parseRepoInput('').ok, 'empty rejected')
  ok(!parseRepoInput('ftp://github.com/o/r').ok && parseRepoInput('ftp://github.com/o/r').reason === 'unsupported_protocol', 'non-http protocol rejected')
  ok(!parseRepoInput('https://github.com/onlyowner').ok, 'github owner-only rejected')

  ok(repoUrlError({ reason: 'unsupported_host' }).includes('github.com'), 'repoUrlError humanizes unsupported_host')
  ok(repoUrlError({ reason: 'blob_url_not_repo', detail: 'custom' }) === 'custom', 'repoUrlError prefers detail')

  // tarballUrls fallback order
  eq(tarballUrls({ kind: 'github', owner: 'o', repo: 'r', ref: null }), ['https://codeload.github.com/o/r/tar.gz/refs/heads/main', 'https://codeload.github.com/o/r/tar.gz/refs/heads/master', 'https://codeload.github.com/o/r/tar.gz'], 'github no ref → main → master → bare (bare form 404s for many repos now)')
  const withRef = tarballUrls({ kind: 'github', owner: 'o', repo: 'r', ref: null }, 'v1.2')
  ok(withRef.length === 3 && withRef[0].endsWith('/tar.gz/refs/heads/v1.2') && withRef[1].endsWith('/tar.gz/v1.2') && withRef[2].endsWith('/tar.gz'), 'github ref → heads → raw → default order')
  eq(tarballUrls({ kind: 'gitlab', owner: 'g', repo: 'p', ref: null }, 'main'), ['https://gitlab.com/api/v4/projects/g%2Fp/repository/archive.tar.gz?sha=main'], 'gitlab archive URL encodes project path')
  ok(gitlabProjectApi({ owner: 'g o', repo: 'p' }).includes(encodeURIComponent('g o/p')), 'gitlab project API encodes spaces')
  ok(CLONE_UA.startsWith('Kivora/'), 'clone UA identifies Kivora')
}

// ── 2. gunzip ───────────────────────────────────────────────────────
console.log('2. gunzip')
{
  const payload = Buffer.from('hello workspace ' + 'x'.repeat(5000))
  const gz = gzipSync(payload)
  const bytes = await gunzip(new Response(new Uint8Array(gz)).body)
  ok(Buffer.from(bytes).equals(payload), 'gunzip round-trips real gzip bytes')

  let threw = ''
  try { await gunzip(new Response(new Uint8Array(gz)).body, 100) } catch (e) { threw = e.message }
  eq(threw, 'decompressed_too_large', 'byte cap trips with decompressed_too_large')
}

// ── 3. parseTar handcrafted cases ───────────────────────────────────
console.log('3. parseTar (handcrafted ustar / pax / GNU)')
{
  const enc = (s, off, len, h) => { const b = Buffer.from(s, 'utf8'); b.copy(h, off, 0, Math.min(len, b.length)) }
  const header = ({ name, size, typeflag = '0', prefix = '' }) => {
    const h = Buffer.alloc(512)
    enc(name, 0, 100, h)
    enc('0000644\0', 100, 8, h)
    enc('0000000\0', 108, 8, h)
    enc('0000000\0', 116, 8, h)
    enc(size.toString(8).padStart(11, '0') + '\0', 124, 12, h)
    enc('17000000000 ', 136, 12, h)
    h.write('        ', 148)
    h.write(typeflag, 156)
    h.write('ustar\0', 257)
    h.write('00', 263)
    enc(prefix, 345, 155, h)
    let sum = 0
    for (let i = 0; i < 512; i++) sum += h[i]
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148)
    return h
  }
  const dataBlock = (buf) => { const p = Buffer.alloc((512 - (buf.length % 512)) % 512); return Buffer.concat([buf, p]) }
  const paxHeader = (pairs) => {
    let body = ''
    for (const [k, v] of pairs) {
      let n = `${k}=${v}\n`.length + 2
      let rec
      for (;;) { rec = `${n} ${k}=${v}\n`; if (rec.length === n) break; n = rec.length }
      body += rec
    }
    const b = Buffer.from(body, 'utf8')
    return [header({ name: 'pax', size: b.length, typeflag: 'x' }), dataBlock(b)]
  }

  // A: simple files + dir
  {
    const a = Buffer.from('alpha content')
    const b = Buffer.from('beta')
    const tar = Buffer.concat([
      header({ name: 'dir', size: 0, typeflag: '5' }),
      header({ name: 'dir/a.txt', size: a.length }), dataBlock(a),
      header({ name: 'dir/b.txt', size: b.length }), dataBlock(b),
      Buffer.alloc(1024),
    ])
    const r = parseTar(tar)
    eq(r.files.map((f) => f.path), ['dir/a.txt', 'dir/b.txt'], 'A: file paths')
    eq(r.dirs, 1, 'A: dir counted')
    ok(Buffer.from(r.files[0].bytes).equals(a), 'A: bytes intact')
    ok(!r.truncated, 'A: not truncated')
  }

  // B: pax path override (long name > 100, ≤40 segments)
  {
    const long = 'aaaa/'.repeat(19) + 'deep-file.txt' // 20 segments, 108 chars
    ok(long.length > 100 && long.split('/').length <= 40, 'B: name >100 chars, ≤40 segments')
    const c = Buffer.from('pax body')
    const tar = Buffer.concat([
      ...paxHeader([['path', long]]),
      header({ name: 'ignored-short', size: c.length }), dataBlock(c),
      Buffer.alloc(1024),
    ])
    const r = parseTar(tar)
    ok(r.files.length === 1 && r.files[0].path === long, `B: pax path overrides name (got ${JSON.stringify(r.files.map((f) => f.path))})`)
    if (r.files[0]) ok(Buffer.from(r.files[0].bytes).equals(c), 'B: bytes intact')
  }

  // B3: absurd depth (>40 segments) rejected as unsafe
  {
    const absurd = 'x/'.repeat(45) + 'deep.txt' // 46 segments
    const c = Buffer.from('deep')
    const tar = Buffer.concat([
      ...paxHeader([['path', absurd]]),
      header({ name: 'deep.txt', size: c.length }), dataBlock(c),
      Buffer.alloc(1024),
    ])
    const r = parseTar(tar)
    eq(r.files.length, 0, 'B3: >40-segment path rejected')
    ok(r.skipped.some((s) => s.reason === 'unsafe_path'), 'B3: reported unsafe_path')
  }

  // B2: pax size override
  {
    const c = Buffer.from('sized')
    const tar = Buffer.concat([
      ...paxHeader([['path', 'sized.txt'], ['size', String(c.length)]]),
      header({ name: 'sized.txt', size: 0 }), // header says 0, pax says 5
      dataBlock(c), // real archives always carry the bytes
      Buffer.alloc(1024),
    ])
    const r = parseTar(tar)
    ok(r.files.length === 1 && Buffer.from(r.files[0].bytes).equals(c), 'B2: pax size override wins')
  }

  // C: GNU long name ('L') — >100 chars, ≤40 segments
  {
    const long = 'aaaa/'.repeat(19) + 'gnu-long.txt' // 108 chars, 20 segments
    const nameBuf = Buffer.from(long + '\0')
    const c = Buffer.from('gnu body')
    const tar = Buffer.concat([
      header({ name: '././@LongLink', size: nameBuf.length, typeflag: 'L' }), dataBlock(nameBuf),
      header({ name: 'gnu-long.txt', size: c.length }), dataBlock(c),
      Buffer.alloc(1024),
    ])
    const r = parseTar(tar)
    ok(r.files.length === 1 && r.files[0].path === long, `C: GNU L long name restored (got ${JSON.stringify(r.files.map((f) => f.path))})`)
    if (r.files[0]) ok(Buffer.from(r.files[0].bytes).equals(c), 'C: bytes intact')
  }

  // D: ustar prefix field
  {
    const c = Buffer.from('prefixed')
    const tar = Buffer.concat([
      header({ name: 'tail.txt', size: c.length, prefix: 'very/long/prefix/path/that/would/not/fit/in/name/field/easily/ok' }), dataBlock(c),
      Buffer.alloc(1024),
    ])
    const r = parseTar(tar)
    eq(r.files.map((f) => f.path), ['very/long/prefix/path/that/would/not/fit/in/name/field/easily/ok/tail.txt'], 'D: prefix joined with /')
  }

  // E: traversal + absolute paths never pass
  {
    const c = Buffer.from('evil')
    const tar = Buffer.concat([
      header({ name: '../evil.txt', size: c.length }), dataBlock(c),
      header({ name: '/etc/passwd', size: c.length }), dataBlock(c),
      header({ name: 'ok/deep/../../../up.txt', size: c.length }), dataBlock(c),
      header({ name: 'good.txt', size: c.length }), dataBlock(c),
      Buffer.alloc(1024),
    ])
    const r = parseTar(tar)
    eq(r.files.map((f) => f.path), ['good.txt'], 'E: traversal/absolute rejected, good file kept')
    ok(r.skipped.length === 3 && r.skipped.every((s) => s.reason === 'unsafe_path'), 'E: 3 unsafe skips')
  }
  {
    ok(safeExtractPath('C:/windows/system32') === null, 'E2: windows drive letter rejected')
    ok(safeExtractPath('a\\..\\b') === null, 'E2: backslash-traversal normalized then rejected')
    ok(safeExtractPath('a/b/c.txt') === 'a/b/c.txt', 'E2: normal path passes')
    ok(safeExtractPath('a/'.repeat(41) + 'f.txt') === null, 'E2: 42-segment depth rejected at the security wall')
  }

  // F: caps → truncated
  {
    const c = Buffer.from('z')
    const blocks = []
    for (let i = 0; i < 5; i++) blocks.push(header({ name: `f${i}.txt`, size: c.length }), dataBlock(c))
    const tar = Buffer.concat([...blocks, Buffer.alloc(1024)])
    const r = parseTar(tar, { maxFiles: 2, maxTotalBytes: 1e9, maxFileBytes: 1e6 })
    eq(r.files.length, 2, 'F: maxFiles cap honored')
    ok(r.truncated, 'F: truncated flagged')
    const r2 = parseTar(tar, { maxFiles: 100, maxTotalBytes: 3, maxFileBytes: 1e6 })
    ok(r2.truncated && r2.files.length === 3, 'F2: total-bytes cap trips (inclusive ≤: 3 one-byte files fit under 3)')
    const r3 = parseTar(tar, { maxFiles: 100, maxTotalBytes: 1e9, maxFileBytes: 0 })
    ok(r3.files.length === 0 && r3.skipped.length === 5 && r3.skipped[0].reason === 'file_too_large', 'F3: per-file cap skips with reason')
  }

  // G: symlink + hardlink skipped, global pax ignored
  {
    const c = Buffer.from('real')
    const tar = Buffer.concat([
      header({ name: 'real.txt', size: c.length }), dataBlock(c),
      header({ name: 'link.txt', size: 0, typeflag: '2' }),
      header({ name: 'hard.txt', size: 0, typeflag: '1' }),
      header({ name: 'global', size: 0, typeflag: 'g' }),
      Buffer.alloc(1024),
    ])
    const r = parseTar(tar)
    eq(r.files.map((f) => f.path), ['real.txt'], 'G: only regular file kept')
    eq(r.skipped.map((s) => s.reason), ['link_or_special', 'link_or_special'], 'G: link + hardlink skipped, global pax not counted')
  }
}

// ── 4. REAL tar CLI archive → full pipeline ─────────────────────────
console.log('4. real tar CLI archive → gunzip → parseTar → stripCommonRoot')
{
  const dir = mkdtempSync(join(tmpdir(), 'kvclone-'))
  try {
    const root = join(dir, 'hello-main')
    mkdirSync(join(root, 'src', 'nested'), { recursive: true })
    writeFileSync(join(root, 'README.md'), '# Hello\n\nsome markdown\n')
    writeFileSync(join(root, 'src', 'main.py'), 'print("hi")\n')
    writeFileSync(join(root, 'src', 'nested', 'data.bin'), Buffer.from([0, 1, 2, 255, 254, 0x41]))
    writeFileSync(join(root, 'café.txt'), 'unicode name\n') // illegal for VFS charset → rename
    writeFileSync(join(root, 'a+b.txt'), 'plus name\n') // illegal → rename
    try { symlinkSync('README.md', join(root, 'link.md')) } catch {}
    execSync(`tar -czf ${join(dir, 'repo.tgz')} -C ${dir} hello-main`)
    const tgz = readFileSync(join(dir, 'repo.tgz'))

    const bytes = await gunzip(new Response(new Uint8Array(tgz)).body)
    const parsed = parseTar(bytes)
    const { files, root: rootName } = stripCommonRoot(parsed.files)
    eq(rootName, 'hello-main', 'common root detected and stripped')
    const byPath = Object.fromEntries(files.map((f) => [f.path, f]))
    ok(byPath['README.md'] && Buffer.from(byPath['README.md'].bytes).equals(Buffer.from('# Hello\n\nsome markdown\n')), 'README bytes exact')
    ok(byPath['src/main.py'] && Buffer.from(byPath['src/main.py'].bytes).toString().includes('print("hi")'), 'nested file present')
    ok(byPath['src/nested/data.bin'] && Buffer.from(byPath['src/nested/data.bin'].bytes).equals(Buffer.from([0, 1, 2, 255, 254, 0x41])), 'binary bytes exact')
    ok(!byPath['link.md'], 'symlink not materialized as file')
    ok(parsed.skipped.some((s) => s.path.endsWith('link.md') && s.reason === 'link_or_special'), 'symlink reported skipped')

    // the handler's sanitize step: unicode/plus names get renamed
    const safe1 = asciiSafePath('café.txt')
    ok(safe1.renamed && /^[A-Za-z0-9._ -]+$/.test(safe1.path), `unicode renamed (${safe1.path})`)
    const safe2 = asciiSafePath('a+b.txt')
    ok(safe2.renamed && safe2.path === 'a_b.txt', `plus renamed (${safe2.path})`)
    const safe3 = asciiSafePath('src/main.py')
    ok(!safe3.renamed && safe3.path === 'src/main.py', 'clean path untouched')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ── 5. REAL GitHub tarball ──────────────────────────────────────────
console.log('5. real GitHub tarball (octocat/Hello-World)')
{
  const info = parseRepoInput('https://github.com/octocat/Hello-World')
  // mirror the handler: probe the default branch first (codeload's bare
  // /tar.gz form 404s for many repos), then walk the candidate list
  let ref = info.ref
  if (!ref) {
    try {
      const pr = await fetch(`https://api.github.com/repos/${info.owner}/${info.repo}`, { headers: { 'user-agent': CLONE_UA, accept: 'application/vnd.github+json' } })
      if (pr.ok) ref = (await pr.json())?.default_branch || null
    } catch {}
  }
  if (ref) ok(true, `default branch probed (${ref})`)
  else console.log('  (probe unavailable — api.github.com rate-limits datacenter egress; main/master candidates cover)')
  let got = null
  let last = 0
  for (const u of tarballUrls(info, ref)) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': CLONE_UA } })
      if (r.ok && r.body) { got = r; break }
      last = r.status
      try { await r.body?.cancel() } catch {}
    } catch { last = -1 }
  }
  ok(!!got, `codeload reachable (ref=${ref}, last status ${last})`)
  if (got) {
    const bytes = await gunzip(got.body, CLONE_LIMITS.MAX_GZIP_BYTES)
    const parsed = parseTar(bytes)
    const { files, root } = stripCommonRoot(parsed.files)
    ok(files.length > 0, `parsed ${files.length} file(s), root=${root || '(none)'}`)
    ok(files.some((f) => f.path.endsWith('README') || f.path.endsWith('README.md')), 'README present in snapshot')
    ok(files.every((f) => !f.path.startsWith('/')), 'no absolute paths leak from real archive')
  }

  // 404 branch → every candidate fails → handler's clone_failed path
  const bad = tarballUrls({ ...info }, 'no-such-branch-xyz')
  ok(bad.length === 3, 'bad branch → 3 candidates tried')
  let st = 0
  for (const u of bad) {
    const r = await fetch(u, { headers: { 'user-agent': CLONE_UA } })
    if (!r.ok) st = r.status
    try { await r.body?.cancel() } catch {}
  }
  eq(st, 404, 'nonexistent branch ends in 404')
}

// ── 6. registry integration ─────────────────────────────────────────
console.log('6. toolRegistry integration')
{
  const reg = readFileSync('lib/toolRegistry.js', 'utf8')
  const vfs = readFileSync('lib/vfs.js', 'utf8')

  // handler signature + tier ordering
  ok(/async sandbox_git\(args, ctx\)/.test(reg), 'sandbox_git takes ctx')
  const gitBody = reg.slice(reg.indexOf('async sandbox_git'), reg.indexOf('async generate_downloadable'))
  const cfIdx = gitBody.indexOf('isCloudflareSandboxAvailable()')
  const wsIdx = gitBody.indexOf("ctx?.supabaseAdmin && ctx?.userId")
  ok(cfIdx !== -1 && wsIdx !== -1 && wsIdx < cfIdx, 'v5.29: workspace tier comes FIRST (before sandbox providers — prod CF Sandbox git clone failed with Permission denied and intercepted the VFS clone)')
  ok(/No sandbox provider configured\. Set DAYTONA_API_KEY/.test(gitBody) === false, 'old dead-end error message gone')
  ok(/sign_in_required: true/.test(gitBody), 'anon boundary preserved')
  ok(/workspace_unavailable/.test(gitBody), 'anon boundary uses workspace_unavailable')

  // clone mechanics
  ok(/parseRepoInput\(repoUrl\)/.test(gitBody), 'URL parsed before clone')
  ok(/repoUrlError\(info\)/.test(gitBody), 'human URL error')
  ok(/tarballUrls\(info, ref\)/.test(gitBody), 'candidate list walked')
  ok(/CLONE_UA/.test(gitBody), 'polite UA sent upstream')
  ok(/gunzip\(res\.body, CLONE_LIMITS\.MAX_GZIP_BYTES\)/.test(gitBody), 'gunzip with cap')
  ok(/parseTar\(gz\)/.test(gitBody), 'tar parsed')
  ok(/stripCommonRoot\(parsed\.files\)/.test(gitBody), 'common root stripped')
  ok(/info\.subpath/.test(gitBody) && /subpath_not_found/.test(gitBody), 'sub-directory clone supported')
  ok(/asciiSafePath/.test(gitBody) && /renamed_note/.test(gitBody), 'charset sanitizer + rename note')
  ok(/~/ .test(gitBody) || /stem\}~\$\{k\}/.test(gitBody) || /`~\$\{k\}`/.test(gitBody), 'collision suffix present')
  ok(/fileCount: used/.test(gitBody) && /used\+\+/.test(gitBody), 'quota batch: count once, increment locally')
  ok(/bytesToB64\(f\.bytes\)/.test(gitBody) && /isBase64: true/.test(gitBody), 'binary-safe VFS writes')
  ok(/executor: 'kivora-workspace'/.test(gitBody), 'executor identified')
  ok(/files_saved: saved\.length/.test(gitBody) && /tree: saved\.slice/.test(gitBody), 'result reports files_saved + tree preview')
  ok(/truncated_note/.test(gitBody) && /staging_note/.test(gitBody), 'truncation + staging notes')
  ok(/archive_too_large/.test(gitBody) && /clone_failed/.test(gitBody), 'error taxonomy (too_large vs clone_failed)')
  ok(/nothing_saved/.test(gitBody), 'empty-result taxonomy')

  // vfs batch quota opt
  ok(/opts\.fileCount != null/.test(vfs), 'vfsWrite supports batch fileCount')
  ok(vfs.includes('bytesToB64'), 'bytesToB64 exported for the handler')

  // description + instructions
  ok(/tarball snapshot/.test(reg) && /PERSISTENT workspace/.test(reg.split("name: 'sandbox_git'")[1]?.split('parameters:')[0] || ''), 'sandbox_git description mentions persistent workspace snapshot')
  ok(/GIT CLONES: sandbox_git works even without a sandbox provider/.test(reg), 'TOOL_INSTRUCTIONS gained GIT CLONES block')
  ok(/sandbox_file ls on the clone/.test(reg), 'instructions tell the model how to walk a clone')

  // imports
  ok(/from '@\/lib\/gitTarball'/.test(reg) && /parseRepoInput, tarballUrls, gitlabProjectApi, parseTar, gunzip, stripCommonRoot, asciiSafePath, repoUrlError, CLONE_UA, CLONE_LIMITS/.test(reg), 'gitTarball imports complete')
  ok(/bytesToB64 } from '@\/lib\/vfs'/.test(reg), 'bytesToB64 imported from vfs')

  // guards untouched (regression)
  ok(readFileSync('lib/gitTarball.js', 'utf8').includes('github_needs_owner_repo'), 'gitTarball reasons stable')
}

// ── 7. UI wiring ────────────────────────────────────────────────────
console.log('7. UI wiring (TerminalWorkspace + ChatClient)')
{
  const tw = readFileSync('components/chat/TerminalWorkspace.jsx', 'utf8')
  const cc = readFileSync('app/chat/ChatClient.jsx', 'utf8')

  ok(/export default function TerminalWorkspace\(\{ visible, getToken, t, refreshKey = 0 \}\)/.test(tw), 'props: visible/getToken/t/refreshKey')
  ok(/\[visible, refreshKey, load\]/.test(tw), 're-fetches on visible + refreshKey')
  ok(/fetch\('\/api\/vfs'/.test(tw), 'lists via /api/vfs')
  ok(/res\.status === 401/.test(tw) && /setSignedOut\(true\)/.test(tw), '401 → signed-out strip')
  ok(/download=1/.test(tw) && /method: 'DELETE'/.test(tw), 'download + delete wired')
  ok(/href="\/auth"/.test(tw), 'sign-in CTA links /auth')
  ok(/t\('vfs\.count', \{ n: files\.length, size: fmtSize\(totalBytes\) \}\)/.test(tw), 'count line interpolated')
  ok(/t\('vfs\.refresh'\)/.test(tw), 'refresh button labeled')
  ok(/if \(!visible\) return null/.test(tw), 'unmounts when hidden')
  ok(/aria-label=\{t\('vfs\.download'\)\}/.test(tw) && /aria-label=\{t\('vfs\.delete'\)\}/.test(tw), 'a11y labels localized')

  ok(/dynamic\(\(\) => import\('@\/components\/chat\/TerminalWorkspace'\), \{ ssr: false \}\)/.test(cc), 'client-only dynamic import')
  ok(/const \[termWsOpen, setTermWsOpen\] = useState\(false\)/.test(cc), 'termWsOpen state')
  ok(/const \[termWsKey, setTermWsKey\] = useState\(0\)/.test(cc) && /const bumpTermWs = \(\) => setTermWsKey\(\(k\) => k \+ 1\)/.test(cc), 'refresh key + bumper')
  eq((cc.match(/bumpTermWs\(\)/g) || []).length, 3, 'bump called at exactly 3 call sites (sandbox path, judge0 path, finishTerminalExec)')
  ok(/visible=\{terminalMode && termWsOpen\}/.test(cc), 'panel visible only inside terminal mode')
  ok(/aria-pressed=\{termWsOpen\}/.test(cc), 'toggle button exposes pressed state')
  ok(/title=\{t\('vfs\.title'\)\}/.test(cc), 'toggle labeled with workspace title')
  ok(/getToken=\{async \(\) => user \? \(await supabasePublic\?\.auth\?\.getSession\(\)\)\?\.data\?\.session\?\.access_token \|\| '' : ''\}/.test(cc), 'same auth pattern as WorkspacePanel')
  ok(/refreshKey=\{termWsKey\}/.test(cc), 'refreshKey threaded')
}

// ── 8. i18n ─────────────────────────────────────────────────────────
console.log('8. i18n parity')
{
  const en = JSON.parse(readFileSync('lib/i18n/en.json', 'utf8'))
  const fr = JSON.parse(readFileSync('lib/i18n/fr.json', 'utf8'))
  const sw = JSON.parse(readFileSync('lib/i18n/sw.json', 'utf8'))
  const yo = JSON.parse(readFileSync('lib/i18n/yo.json', 'utf8'))
  for (const [name, d] of Object.entries({ en, fr, sw, yo })) {
    ok(Object.keys(d).length === 1027, `${name} has 1027 keys (${Object.keys(d).length})`)
    ok(typeof d['vfs.refresh'] === 'string' && d['vfs.refresh'].length > 0, `${name} vfs.refresh present`)
    ok(typeof d['vfs.count'] === 'string' && d['vfs.count'].includes('{n}') && d['vfs.count'].includes('{size}'), `${name} vfs.count keeps {n}/{size}`)
  }
  ok(!en['vfs.count'].includes('undefined'), 'en count clean')
  // original v5.27 vfs keys untouched
  ok(en['vfs.title'] === 'Workspace files' && !!yo['vfs.title'], 'v5.27 vfs keys intact')
}

console.log(`\n══════════ v5.28: ${pass} passed, ${fail} failed ══════════`)
if (fail) { console.error('FAILED:', failures.join(' | ')); process.exit(1) }
