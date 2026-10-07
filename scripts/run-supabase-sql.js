// One-shot runner for community-attachments-migration.sql
// Uses DISCRETE connection params (never a URI) so passwords containing
// special chars like @ never break parsing. Tries session pooler first,
// then transaction pooler. Idempotent SQL — safe to re-run.
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const REF = 'asfzdbpfakwpiawhhrby'
const HOST = 'aws-0-eu-west-1.pooler.supabase.com'
const USER = `postgres.${REF}`
const DB = 'postgres'
const PASSWORD = process.env.PGPASSWORD
if (!PASSWORD) {
  console.error('PGPASSWORD env var required')
  process.exit(1)
}

const SQL_FILE = path.join(__dirname, '..', 'community-attachments-migration.sql')

async function tryConnect(port, label) {
  const client = new Client({
    host: HOST,
    port,
    user: USER,
    database: DB,
    password: PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  })
  try {
    await client.connect()
    console.log(`OK connected via ${label} (port ${port})`)
    return client
  } catch (e) {
    console.error(`FAIL ${label} (port ${port}): ${e.message}`)
    try { await client.end() } catch {}
    return null
  }
}

function executableStatements(sql) {
  return sql
    .split(';')
    .map(chunk => chunk
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim())
    .filter(Boolean)
}

;(async () => {
  let client = await tryConnect(5432, 'session pooler')
  if (!client) client = await tryConnect(6543, 'transaction pooler')
  if (!client) process.exit(2)

  try {
    const sql = fs.readFileSync(SQL_FILE, 'utf8')
    const statements = executableStatements(sql)
    console.log(`executing ${statements.length} statement(s)`)
    for (const stmt of statements) {
      await client.query(stmt)
      console.log('OK  ' + stmt.split('\n')[0].slice(0, 80) + '…')
    }

    const verify = await client.query(`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE column_name = 'attachments'
        AND table_name IN ('forum_posts', 'forum_replies')
      ORDER BY table_name
    `)
    console.log('verification:')
    for (const row of verify.rows) {
      console.log(`  ${row.table_name}.${row.column_name} ${row.data_type} default ${row.column_default}`)
    }
    if (verify.rows.length < 2) {
      console.error('EXPECTED 2 rows (forum_posts + forum_replies) — got ' + verify.rows.length)
      process.exit(3)
    }
    console.log('MIGRATION COMPLETE')
  } finally {
    await client.end().catch(() => {})
  }
})()
