#!/usr/bin/env python3
"""v5.30.16 canonical gate: /chat assets all 200 + shipped markers for the
three features — action bar, dynamic title, font-var fix. Exit 1 on failure."""
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

def fetch(url):
    return subprocess.run(['curl', '-s', url, '--max-time', '30'],
                          capture_output=True, text=True).stdout

# chat-client markers (scan chunk assets)
markers = {
    'action bar copy button': '"data-ab":"copy"',
    'action bar quote button': '"data-ab":"quote"',
    'action bar save button': '"data-ab":"save"',
    'action bar rerun button': '"data-ab":"rerun"',
    'dynamic title marker': 'data-chat-title',
    'workspace save path': 'notes/',
    'quote reply title attr': 'Quote reply',
    'v5.30.15 action card (regression)': 'chat.action.badge',
}
found = {}
for r in refs:
    if not re.search(r'/chunks/', r) or not r.endswith('.js'):
        continue
    js = fetch(BASE + r)
    if not js:
        continue
    for label, needle in list(markers.items()):
        if needle in js:
            found[label] = r
for label in markers:
    status = 'PASS' if label in found else 'FAIL'
    extra = f' — {found[label]}' if label in found else ''
    print(f'  {status} {label}{extra}')
    if label not in found:
        bad += 1

# css marker: font vars defined on body, not :root (the v5.30.16 fix)
css_ok = None
for r in refs:
    if r.endswith('.css'):
        css = fetch(BASE + r)
        if '--font-mono' in css:
            root_bad = re.search(r':root\{[^}]*--font-mono:', css)
            body_good = re.search(r'body\{[^}]*--font-mono:var\(--font-jetbrains\)', css) or \
                        re.search(r'body\{[^}]*--font-mono:\s*var\(--font-jetbrains\)', css)
            css_ok = (not root_bad) and body_good
            print(f'  {"PASS" if css_ok else "FAIL"} css font-var fix (body-defined, root-free) — {r}')
            if not css_ok:
                print(f'    root_bad={bool(root_bad)} body_good={bool(body_good)}')
            break
if css_ok is None:
    print('  FAIL no css asset with --font-mono found')
    bad += 1
elif not css_ok:
    bad += 1

sys.exit(1 if bad else 0)
