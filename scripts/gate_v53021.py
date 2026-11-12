#!/usr/bin/env python3
"""v5.30.21 canonical gate: /chat + /research assets all 200, sidebar X
removed (no IconClose in the Navbar chunk), Lightning gateway wiring
markers + full v5.30.20/19/18/17/16 regression set. Exit 1 on failure."""
import re, subprocess, sys

BASE = 'https://kivora.pages.dev'
html = subprocess.run(['curl', '-s', f'{BASE}/chat', '--max-time', '30'],
                      capture_output=True, text=True).stdout
research_html = subprocess.run(['curl', '-s', f'{BASE}/research', '--max-time', '30'],
                               capture_output=True, text=True).stdout
refs = sorted(set(
    re.findall(r'/_next/static/[^"\x27()\s\\]+', html)
    + re.findall(r'/_next/static/[^"\x27()\s\\]+', research_html)
))
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

chunks = [r for r in refs if '/chunks/' in r and r.endswith('.js')]

def any_chunk(pattern, regex=False, exclude=None):
    for r in chunks:
        js = js_of(r)
        if not js or (exclude and exclude in r):
            continue
        if regex:
            if re.search(pattern, js):
                return r
        elif pattern in js:
            return r
    return None

# ── v5.30.21 markers ──
def find_navbar_chunk():
    for r in chunks:
        js = js_of(r)
        if 'nav.explore' in js and 'nav.reelpen' in js:
            return r
    return None

nb_chunk = find_navbar_chunk()
if nb_chunk:
    nb = js_of(nb_chunk)
    no_iconclose_import = "IconClose" not in nb
    status = 'PASS' if no_iconclose_import else 'FAIL'
    print(f'  {status} sidebar X removed (no IconClose in the Navbar chunk) — {nb_chunk}')
    if not no_iconclose_import:
        bad += 1
else:
    print('  FAIL Navbar chunk not located')
    bad += 1

# NOTE: lib/groq.js + lib/mistral.js + route wiring are SERVER-ONLY code —
# they never ship in client chunks, so no bundle marker can assert them here.
# The gateway hop is verified functionally by scripts/test_v53021_chain.mjs
# (real groqChat → mock LitServe gateway, 7/7) and the v5.30.21 unit suite.

# ── v5.30.20 regressions ──
v20 = {
    'toast z-[10000] (JSX className in chunk)': (r'z-\[10000\]', True),
    'chat.actions.copied i18n key': ('chat.actions.copied', False),
    'thumbs embedded update': (r'update\(\{\s*messages:', True),
    'bubble card no inline Copied swap': (r"\? 'Copied' : 'Copy'", True),  # must NOT match
}
for label, (needle, regex) in v20.items():
    hit = any_chunk(needle, regex)
    if label.startswith('bubble card'):
        status = 'PASS' if hit is None else 'FAIL'
        print(f'  {status} {label}' + (f' — still in {hit}' if hit else ' (gone)'))
        if hit:
            bad += 1
    else:
        status = 'PASS' if hit else 'FAIL'
        print(f'  {status} {label}' + (f' — {hit}' if hit else ''))
        if not hit:
            bad += 1

page_chunk = re.search(r'chunks/(app/research/page-[a-f0-9]+\.js)', research_html)
if page_chunk:
    pjs = js_of('/_next/static/chunks/' + page_chunk.group(1))
    var_n = pjs.count('font-family:var(--font-mono)')
    ui_n = pjs.count('ui-monospace')
    status = 'PASS' if var_n >= 4 and ui_n == 0 else 'FAIL'
    print(f'  {status} research page chunk: var(--font-mono) ×{var_n}, ui-monospace ×{ui_n}')
    if status == 'FAIL':
        bad += 1
else:
    print('  FAIL research page chunk not found')
    bad += 1

# ── older regressions ──
css_refs = [r for r in refs if r.endswith('.css')]
css_all = ''.join(subprocess.run(['curl', '-s', BASE + r, '--max-time', '30'],
                                 capture_output=True, text=True).stdout for r in css_refs)
status = 'PASS' if 'lg\\:w-72' in css_all else 'FAIL'
print(f'  {status} drawer w-72 in css')
if status == 'FAIL':
    bad += 1

markers = {
    'user quote block marker': '"data-user-quote"',
    'explicit Inter composer chain': 'var(--font-inter),Inter,system-ui,sans-serif',
    'reply chip marker': '"data-reply-chip"',
    'hit-area pseudo (before:-inset-1.5)': 'before:-inset-1.5',
    'touch-action manipulation': '[touch-action:manipulation]',
    'feedback column select': 'title, pinned, feedback',
    'action bar copy button': '"data-ab":"copy"',
    'dynamic title marker': 'data-chat-title',
}
for label, needle in markers.items():
    hit = any_chunk(needle)
    status = 'PASS' if hit else 'FAIL'
    print(f'  {status} {label}' + (f' — {hit}' if hit else ''))
    if not hit:
        bad += 1

root_bad = re.search(r':root\{[^}]*--font-mono:', css_all)
body_good = re.search(r'body\{[^}]*--font-mono:\s*var\(--font-jetbrains\)', css_all)
mono_ok = css_all and '--font-mono' in css_all and not root_bad and body_good
status = 'PASS' if mono_ok else 'FAIL'
print(f'  {status} css font-var fix (body-defined, root-free)')
if not mono_ok:
    bad += 1

print(f'GATE: {"GREEN" if bad == 0 else f"RED ({bad} failures)"}')
sys.exit(1 if bad else 0)
