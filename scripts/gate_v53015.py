#!/usr/bin/env python3
"""v5.30.15 canonical gate: /chat assets all 200 + action-card markers in the
shipped chat chunk. Exit 1 on any failure."""
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

# largest chunks likely carry the chat client — scan them for markers
def fetch(url):
    return subprocess.run(['curl', '-s', url, '--max-time', '30'],
                          capture_output=True, text=True).stdout

markers = {
    'chat.action.badge key (client t call)': 'chat.action.badge',
    'chat.action.footer_unparsed key': 'chat.action.footer_unparsed',
    'parseActionSegments import marker (ACTION_TAG_NAMES in bundle)': 'tool_call',
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

sys.exit(1 if bad else 0)
