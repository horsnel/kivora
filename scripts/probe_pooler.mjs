#!/usr/bin/env node
// Probe Supabase session-pooler regions (sandbox lacks IPv6; direct db host has no A record)
import pg from 'pg'
import dns from 'node:dns'
import { promisify } from 'node:util'
const resolve4 = promisify(dns.resolve4)
const REF = 'asfzdbpfakwpiawhhrby'
const REGIONS = ['us-east-1','us-east-2','us-west-1','us-west-2','ca-central-1','eu-west-1','eu-west-2','eu-west-3','eu-central-1','eu-central-2','ap-south-1','ap-southeast-1','ap-southeast-2','ap-northeast-1','ap-northeast-2','sa-east-1']
for (const r of REGIONS) {
  const host = `aws-0-${r}.pooler.supabase.com`
  let ip
  try { ip = (await resolve4(host))[0] } catch { continue }
  const client = new pg.Client({
    host: ip, port: 5432, user: `postgres.${REF}`, password: 'G1m@s2neeef',
    database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000,
  })
  try {
    await client.connect()
    const { rows } = await client.query('select current_user, inet_server_addr()::text as srv')
    console.log(`CONNECTED region=${r} user=${rows[0].current_user} srv=${rows[0].srv}`)
    await client.end()
    process.exit(0)
  } catch (e) {
    try { await client.end() } catch {}
    console.log(`fail ${r}: ${String(e.message).slice(0, 90)}`)
  }
}
console.log('no region reachable')
process.exit(1)
