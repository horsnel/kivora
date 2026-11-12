#!/usr/bin/env python3
"""v5.30.17 canonical gate: /chat assets all 200 + shipped markers for the
v5.30.17 features — tap isolation, error-notice bar suppression, reply chip,
feedback persistence, fence self-heal — plus the v5.30.16 regressions.
Byte-level needles use forms that survive minification; the fence self-heal
is verified FUNCTIONALLY by scripts/probe_v53017.mjs against this base
(its E-tests run the real page with mocked SSE on dev AND production).
Exit 1 on failure."""
import re, subprocess, sys

BASE = 'https://kivora.pages.dev'
html = subprocess.run(['curl', '-s', f'{BASE}/chat', '--max-time', '30'],
                      capture_output=True, text=True).stdout
refs = sorted(set(re.findall(r'/_next/static/[^"\x27()\s\\]+', html)))
print(f'self-referenced assets: {len(refs)}')
bad = 0
for r in refs:
    code = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                           BASE + r, '--max-time', '20'],
                          capture_output=True, text=True).stdout.strip()
    if code != '200':
        bad += 1
        print(f'  FAIL {code} {r}')
print(f'asset gate: {len(refs) - bad}/{len(refs)} OK, {bad} bad')

_js_cache = {}
def js_of(ref):
    if ref not in _js_cache:
        _js_cache[ref] = subprocess.run(['curl', '-s', BASE + ref, '--max-time', '30'],
                                        capture_output=True, text=True).stdout
    return _js_cache[ref]

chunks = [r for r in refs if re.search(r'/chunks/', r) and r.endswith('.js')]

# Substring markers (minifier-proof byte forms — quoted keys survive,
# bare identifiers get renamed away).
markers = {
    # v5.30.17 features
    'tap isolation on bar (pointerdown stopprop)': 'onPointerDown',
    'hit-area pseudo (before:-inset-1.5)': 'before:-inset-1.5',
    'touch-action manipulation': '[touch-action:manipulation]',
    'reply chip marker': '"data-reply-chip"',
    'reply mention i18n key': 'chat.reply.mention',
    'reply cancel i18n key': 'chat.reply.cancel',
    'feedback column select': 'title, pinned, feedback',
    # v5.30.16 regressions
    'action bar copy button': '"data-ab":"copy"',
    'action bar rerun button': '"data-ab":"rerun"',
    'dynamic title marker': 'data-chat-title',
    'v5.30.15 action card (regression)': 'chat.action.badge',
}
found = {}
for r in chunks:
    js = js_of(r)
    if not js:
        continue
    for label, needle in markers.items():
        if label not in found and needle in js:
            found[label] = r
for label in markers:
    status = 'PASS' if label in found else 'FAIL'
    extra = f' — {found[label]}' if label in found else ''
    print(f'  {status} {label}{extra}')
    if label not in found:
        bad += 1

# Regex markers: identifiers are minified, so persistence ships as
# `{ feedback: <shortIdent> }` inside the persistSessionMeta call.
regex_markers = {
    'feedback persistence patch (minified)': r'feedback:[A-Za-z_$]{1,4}\}',
    'fence self-heal literal (closed-fence emit)': r'\\n```',
}
for label, pattern in regex_markers.items():
    hit = None
    for r in chunks:
        js = js_of(r)
        if js and re.search(pattern, js):
            hit = r
            break
    print(f'  {"PASS" if hit else "FAIL"} {label}' + (f' — {hit}' if hit else ''))
    if not hit:
        bad += 1

# css marker: font-var fix stays intact (v5.30.16 regression)
css_ok = None
for r in refs:
    if r.endswith('.css'):
        css = subprocess.run(['curl', '-s', BASE + r, '--max-time', '30'],
                             capture_output=True, text=True).stdout
        if '--font-mono' in css:
            root_bad = re.search(r':root\{[^}]*--font-mono:', css)
            body_good = re.search(r'body\{[^}]*--font-mono:var\(--font-jetbrains\)', css) or \
                        re.search(r'body\{[^}]*--font-mono:\s*var\(--font-jetbrains\)', css)
            css_ok = (not root_bad) and body_good
            print(f'  {"PASS" if css_ok else "FAIL"} css font-var fix (body-defined, root-free) — {r}')
            break
if css_ok is None:
    print('  FAIL no css asset with --font-mono found')
    bad += 1
elif not css_ok:
    bad += 1

# i18n markers ship in the locale chunks
for needle, label in [('Replying to', 'i18n en mention copy'), ('Dismiss reply', 'i18n en cancel copy')]:
    hit = None
    for r in chunks:
        if needle in js_of(r):
            hit = r
            break
    if hit:
        print(f'  PASS {label} — {hit}')
    else:
        print(f'  FAIL {label}')
        bad += 1

print(f'GATE: {"GREEN" if bad == 0 else f"RED ({bad} failures)"}')
sys.exit(1 if bad else 0)
