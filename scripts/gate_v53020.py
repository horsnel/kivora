#!/usr/bin/env python3
"""v5.30.20 canonical gate: /chat assets all 200 + toast/z-index, zero-DDL
thumbs, global mono markers + full v5.30.19/18/17/16 regression set.
Functional targets: probe_v53020_unify.mjs, probe_v53019_titlewidth.mjs,
probe_v53018_typography.mjs against this base. Exit 1 on failure."""
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

def any_chunk(pattern, regex=False):
    for r in chunks:
        js = js_of(r)
        if not js:
            continue
        if regex:
            if re.search(pattern, js):
                return r
        elif pattern in js:
            return r
    return None

# ── v5.30.20 markers ──
v20 = {
    'toast z-[10000] (JSX className in chunk)': (r'z-\[10000\]', True),
    'chat.actions.copied i18n key': ('chat.actions.copied', False),
    'chat copy execCommand fallback (minified dquotes)': ('execCommand("copy")', False),
    'md renderer copy toast (minified obj)': ('variant:"toast",message:"Copied to clipboard"', False),
    'thumbs embedded update (update({ messages: …))': (r'update\(\{\s*messages:', True),
    'bubble card no inline Copied swap': (r"\? 'Copied' : 'Copy'", True),  # regex → must NOT match
}
for label, (needle, regex) in v20.items():
    hit = any_chunk(needle, regex)
    if label.startswith('bubble card no inline'):
        status = 'PASS' if hit is None else 'FAIL'
        print(f'  {status} {label}' + (f' — still present in {hit}' if hit else ' (gone)'))
        if hit:
            bad += 1
    else:
        status = 'PASS' if hit else 'FAIL'
        print(f'  {status} {label}' + (f' — {hit}' if hit else ''))
        if not hit:
            bad += 1

# chat-chunk-targeted: the copy() fallback must live in the SAME chunk as
# the action bar (not just anywhere — OutputMenu ships its own execCommand)
chat_chunk = any_chunk('"data-ab":"copy"')
if chat_chunk and 'execCommand("copy")' in js_of(chat_chunk):
    print(f'  PASS chat copy() fallback inside the chat chunk — {chat_chunk}')
else:
    print(f'  FAIL chat copy() fallback missing from chat chunk ({chat_chunk})')
    bad += 1

# research/CPC mono rules render client-side — the research PAGE chunk is
# referenced from the research HTML build manifest; the minifier strips the
# space after the colon, so count the spaceless form
page_chunk = re.search(r'chunks/(app/research/page-[a-f0-9]+\.js)', research_html)
if page_chunk:
    pjs = js_of('/_next/static/chunks/' + page_chunk.group(1))
    var_n = pjs.count('font-family:var(--font-mono)')
    ui_n = pjs.count('ui-monospace')
    status = 'PASS' if var_n >= 4 and ui_n == 0 else 'FAIL'
    print(f'  {status} research page chunk: var(--font-mono) ×{var_n}, ui-monospace ×{ui_n} — {page_chunk.group(1)}')
    if status == 'FAIL':
        bad += 1
else:
    print('  FAIL research page chunk not found in research HTML manifest')
    bad += 1
comment_total = sum(js_of(r).count('font-family:var(--font-mono)') for r in chunks if js_of(r))
status = 'PASS' if comment_total >= 8 else 'FAIL'
print(f'  {status} normalized mono rules shipped across chunks ({comment_total}, expect ≥8: research 4 + CodePreviewCard 4)')
if status == 'FAIL':
    bad += 1

# i18n locales carry the new key (4 langs ship in the bundle)
copied_hits = len(re.findall(r'"chat\.actions\.copied"', js_of(next((r for r in chunks if '235-' in r), '')) or ''))
status = 'PASS' if copied_hits >= 3 else 'FAIL'
print(f'  {status} chat.actions.copied in shipped locales ({copied_hits} langs)')
if status == 'FAIL':
    bad += 1

# ── v5.30.19 regressions ──
css_refs = [r for r in refs if r.endswith('.css')]
css_all = ''.join(subprocess.run(['curl', '-s', BASE + r, '--max-time', '30'],
                                 capture_output=True, text=True).stdout for r in css_refs)
for label, needle in [('drawer w-72 in css', 'lg\\:w-72')]:
    status = 'PASS' if needle in css_all else 'FAIL'
    print(f'  {status} {label}')
    if status == 'FAIL':
        bad += 1

# ── v5.30.18/17/16 regressions ──
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

# css font-var fix (body-defined, root-free)
root_bad = re.search(r':root\{[^}]*--font-mono:', css_all)
body_good = re.search(r'body\{[^}]*--font-mono:\s*var\(--font-jetbrains\)', css_all)
mono_ok = css_all and '--font-mono' in css_all and not root_bad and body_good
status = 'PASS' if mono_ok else 'FAIL'
print(f'  {status} css font-var fix (body-defined, root-free)')
if not mono_ok:
    bad += 1

print(f'GATE: {"GREEN" if bad == 0 else f"RED ({bad} failures)"}')
sys.exit(1 if bad else 0)
