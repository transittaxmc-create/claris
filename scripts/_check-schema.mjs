import fs from 'fs';

const content = fs.readFileSync('.env.test', 'utf8');
const env = {};
for (const line of content.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > -1) {
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[k] = v;
  }
}

const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

// 1) Lectura de esquema vía PostgREST (mismo método que usó v0)
const res = await fetch(`${supabaseUrl}/rest/v1/`, { headers });
const doc = await res.json();
const tables = Object.keys(doc.definitions || {});
console.log('1) GET /rest/v1/ status:', res.status, '-> tablas expuestas:', tables.length ? tables.join(', ') : '(ninguna)');

// 2) Esquema crudo: ¿existe alguna tabla nuestra en la base?
const sql = `select table_schema||'.'||table_name as t from information_schema.tables where table_schema not in ('pg_catalog','information_schema') order by 1`;
const res2 = await fetch(`${supabaseUrl}/rest/v1/rpc/`, { headers });
console.log('2) RPC endpoint status:', res2.status, '(lista de funciones)');

// 3) Intento directo de SELECT como service_role sobre una tabla pública hipotética
const res3 = await fetch(`${supabaseUrl}/rest/v1/sync_docs?select=*&limit=1`, { headers });
console.log('3) SELECT sync_docs ->', res3.status, (await res3.text()).slice(0, 160));
