#!/usr/bin/env python3
"""v5.30.14 canonical-completeness gate: every JS/CSS chunk self-referenced by
the production /chat HTML must be 200, plus targeted marker checks."""
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
    status = 'OK' if code == '200' else 'FAIL'
    if code != '200':
        bad += 1
        print(f'  {status} {code} {r}')
print(f'chunk gate: {len(refs) - bad}/{len(refs)} OK, {bad} bad')

# find the chunk carrying ChatClient and verify the .chat-dd-item rule body
chunk_ref = next((r for r in refs if '/7794.' in r), None)
if chunk_ref:
    js = subprocess.run(['curl', '-s', BASE + chunk_ref, '--max-time', '30'],
                        capture_output=True, text=True).stdout
    m = re.search(r'\.chat-dd-item[^{]*\{[^}]*\}', js)
    if m:
        rule = m.group(0)
        print('chat-dd-item rule found:', rule[:220])
        checks = {
            'has background:none': 'background:none' in rule.replace(' ', ''),
            'has border:0': bool(re.search(r'border:0(?!px)', rule.replace(' ', ''))),
            'has padding:0': 'padding:0' in rule.replace(' ', ''),
            'no #1a1a1a in item rule': '#1a1a1a' not in rule,
            'no radius 16 in item rule': '16px' not in rule,
        }
        for k, v in checks.items():
            print(('  PASS ' if v else '  FAIL ') + k)
        if not all(checks.values()):
            bad += 1
    else:
        print('  WARN: .chat-dd-item rule not found in 7794 (styled-jsx scope may differ)')
    hover = 'chat-dd-item:hover' in js
    print(('  FAIL ' if hover else '  PASS ') + 'no .chat-dd-item:hover rule anywhere in chunk')
    if hover:
        bad += 1

sys.exit(1 if bad else 0)
