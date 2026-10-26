#!/usr/bin/env node
// fetch_cf_env.mjs — pull plaintext env vars from the CF Pages project (v5.24.6)
// Only non-secret (plaintext) values come back from the API since CF started
// masking secret_text — that's exactly what the next-on-pages build needs
// (NEXT_PUBLIC_* are baked at build time; runtime secrets live on the Pages
// project itself and are injected by the worker at request time).
import { writeFileSync } from 'node:fs'

const TOKEN = process.env.CF_API_TOKEN
const ACCOUNT = process.env.CF_ACCOUNT_ID
if (!TOKEN || !ACCOUNT) {
  console.error('CF_API_TOKEN / CF_ACCOUNT_ID required')
  process.exit(1)
}

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/kivora`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
})
const body = await res.json()
if (!res.ok || !body.success) {
  console.error('CF API error:', JSON.stringify(body.errors || body).slice(0, 400))
  process.exit(1)
}
const r = body.result || {}
const vars =
  r.deployment_configs?.production?.env_vars || r.production_env_vars || r.env_vars || {}
const lines = []
for (const [k, v] of Object.entries(vars)) {
  const val = typeof v === 'string' ? v : v?.value
  if (val == null || val === '') continue // secret_text values are redacted
  lines.push(`${k}=${val}`)
}
writeFileSync(new URL('../.cf_env', import.meta.url), lines.join('\n') + '\n')
console.log('vars seen:', Object.keys(vars).join(', '))
console.log('exported (plaintext):', lines.map((l) => l.split('=')[0]).join(', '))
