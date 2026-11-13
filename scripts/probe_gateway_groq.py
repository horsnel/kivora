#!/usr/bin/env python3
"""Live probe for the Cloudflare AI Gateway → Groq path (v5.30.23).

Run AFTER the gateway exists (dashboard → AI → AI Gateway → 'kivora-groq')
and GROQ_GATEWAY_URL is set on Pages. Expects CF_TOKEN/GROQ_KEY in the
environment (see /tmp/cf_cred.sh pattern — never commit these).

Verifies:
  1. the gateway slug exists and forwards to Groq (chat completion 200)
  2. the exact URL shape the app produces (…/groq/chat/completions)
  3. the plain Groq key passes through (no gateway-side auth)
"""
import json
import os
import subprocess
import sys

ACCT = '9bd9a7308b74fc0440c7e6cd601f6eef'
GW = os.environ.get('GW_SLUG', 'kivora-groq')
KEY = os.environ.get('GROQ_KEY', '')
GW_TOKEN = os.environ.get('GATEWAY_TOKEN', '')  # AI Gateway auth token (dashboard-created)
URL = f'https://gateway.ai.cloudflare.com/v1/{ACCT}/{GW}/groq/chat/completions'

body = json.dumps({
    'model': 'openai/gpt-oss-120b',
    'max_tokens': 20,
    'messages': [{'role': 'user', 'content': 'Reply with exactly: GATEWAY-OK'}],
}).encode()

cmd = [
    'curl', '-s', '-w', '\\n%{http_code}', URL,
    '-H', 'Content-Type: application/json',
    '-H', f'Authorization: Bearer {KEY}',
    '-H', 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    '--data', body.decode(), '--max-time', '60',
]
# Gateways created after ~mid-2025 are always authenticated — the gateway
# token rides cf-aig-authorization next to the Groq Bearer key.
if GW_TOKEN:
    cmd[cmd.index('--data') - 3:cmd.index('--data') - 3] = ['-H', f'cf-aig-authorization: {GW_TOKEN}']

r = subprocess.run(cmd, capture_output=True, text=True)
out = r.stdout.strip().rsplit('\n', 1)
status = out[-1]
payload = out[0]
print('HTTP', status)
try:
    d = json.loads(payload)
    content = (d.get('choices') or [{}])[0].get('message', {}).get('content', '')
    print('REPLY', repr(content)[:80])
    print('PROBE', 'PASS' if status == '200' and content else 'FAIL')
except Exception:
    print('BODY', payload[:200])
    print('PROBE FAIL')
    sys.exit(1)
