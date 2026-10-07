// RLS security audit — run from repo root with PGPASSWORD set.
// Reports every public table: rowsecurity status, existing policies,
// and an estimate of exposure for the anon/public roles.
const { Client } = require('pg')

const REF = 'asfzdbpfakwpiawhhrby'
const HOST = 'aws-0-eu-west-1.pooler.supabase.com'
const USER = `postgres.${REF}`
const DB = 'postgres'
const PASSWORD = process.env.PGPASSWORD
if (!PASSWORD) { console.error('PGPASSWORD required'); process.exit(1) }

async function tryConnect(port, label) {
  const client = new Client({
    host: HOST, port, user: USER, database: DB, password: PASSWORD,
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
  })
  try { await client.connect(); console.log(`connected via ${label} (${port})`); return client }
  catch (e) { console.error(`fail ${label}: ${e.message}`); try { await client.end() } catch {}; return null }
}

;(async () => {
  let c = await tryConnect(5432, 'session pooler')
  if (!c) c = await tryConnect(6543, 'transaction pooler')
  if (!c) process.exit(2)
  try {
    const tables = await c.query(`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`)
    const policies = await c.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`)
    const grants = await c.query(`
      SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'public')
      GROUP BY table_name, grantee ORDER BY table_name`)

    const polByTable = {}
    for (const p of policies.rows) (polByTable[p.tablename] ||= []).push(p)
    const grantByTable = {}
    for (const g of grants.rows) (grantByTable[g.table_name] ||= []).push(g)

    console.log('\n=== TABLES ===')
    for (const t of tables.rows) {
      const pols = polByTable[t.table_name] || []
      const gr = grantByTable[t.table_name] || []
      console.log(`\n[${t.table_name}] rls=${t.rls_enabled ? 'ON' : 'OFF'}${t.rls_forced ? ' (FORCED)' : ''}`)
      if (gr.length) for (const g of gr) console.log(`  grant ${g.grantee}: ${g.privs}`)
      if (pols.length === 0) {
        console.log(t.rls_enabled ? '  ⚠ RLS ON but ZERO policies → anon+authenticated fully DENIED' : '  🚨 RLS OFF → anon key has FULL access (per grants above)')
      }
      for (const p of pols) {
        const roles = Array.isArray(p.roles) ? p.roles.join(',') : String(p.roles)
        console.log(`  policy ${p.policyname} [${p.cmd} ${p.permissive === 'PERMISSIVE' ? 'permissive' : 'restrictive'} roles=${roles}]`)
        if (p.qual) console.log(`    USING: ${String(p.qual).slice(0, 160)}`)
        if (p.with_check) console.log(`    WITH CHECK: ${String(p.with_check).slice(0, 160)}`)
      }
    }
  } finally { await c.end().catch(() => {}) }
})()
