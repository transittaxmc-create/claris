import fs from 'fs'
import pg from 'pg'

// Crea la tabla de sync en Supabase (Postgres) con RLS activo.
// Ejecutar una sola vez: node scripts/_create-sync-table.mjs
const content = fs.readFileSync('.env.test', 'utf8')
const env = {}
for (const line of content.split('\n')) {
  const idx = line.indexOf('=')
  if (idx > -1) {
    const k = line.slice(0, idx).trim()
    let v = line.slice(idx + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    env[k] = v
  }
}

const connectionString = env.POSTGRES_URL
if (!connectionString) {
  console.error('Falta POSTGRES_URL en .env.test')
  process.exit(1)
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(`
    create table if not exists public.sync_docs (
      key text primary key,
      payload text not null,
      updated_at timestamptz not null default now()
    )
  `)
  await client.query(`alter table public.sync_docs enable row level security`)
  // Sin políticas para anon/authenticated: nadie desde el cliente puede leer ni escribir.
  // El servidor usa la service_role (bypass RLS) o la conexión directa de Postgres.
  await client.query(`revoke all on public.sync_docs from anon, authenticated`)
  const check = await client.query(
    `select column_name, data_type from information_schema.columns
     where table_schema='public' and table_name='sync_docs' order by ordinal_position`
  )
  console.log('Tabla public.sync_docs creada/verificada:')
  for (const row of check.rows) console.log(' -', row.column_name, row.data_type)
} finally {
  await client.end()
}
