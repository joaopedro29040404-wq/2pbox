import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

const ids = JSON.parse(fs.readFileSync('scripts/produtos-reativar.json', 'utf8'));
console.log(`reativando ${ids.length} produtos que estavam ativos antes da desativacao em massa`);

let done = 0;
for (let i = 0; i < ids.length; i += 200) {
  const batch = ids.slice(i, i + 200);
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/products?id=in.(${batch.join(',')})`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active: true, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) {
    console.error('falhou no lote', i, response.status, await response.text());
    process.exit(1);
  }
  done += batch.length;
  process.stdout.write(`\r${done}/${ids.length}`);
}
console.log('\nconcluido');
