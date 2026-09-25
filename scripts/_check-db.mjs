import fs from 'fs';

const content = fs.readFileSync('.env.test', 'utf8');
const lines = content.split('\n');
const env = {};
for (const line of lines) {
  const idx = line.indexOf('=');
  if (idx > -1) {
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[k] = v;
  }
}

console.log('SUPABASE_URL:', env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Has SERVICE_ROLE_KEY:', !!env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Has POSTGRES_URL:', !!env.POSTGRES_URL);

if (env.POSTGRES_URL) {
  try {
    const u = new URL(env.POSTGRES_URL);
    console.log('Host:', u.host, 'User:', u.username, 'DB:', u.pathname);
  } catch (err) {
    console.error('Error parsing POSTGRES_URL:', err.message);
  }
}

const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && serviceKey) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      }
    });
    console.log('Supabase REST status:', res.status);
    const data = await res.text();
    console.log('Supabase REST body (first 300 chars):', data.slice(0, 300));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}
