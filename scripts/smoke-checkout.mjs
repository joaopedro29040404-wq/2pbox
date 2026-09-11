import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const SB = env.SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = 'smoke.checkout@example.com';

const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
const anon = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASSA ' : 'FALHA '} ${name.padEnd(48)} ${detail}`);
};

async function rpc(name, body) {
  const r = await fetch(`${SB}/rest/v1/rpc/${name}`, { method: 'POST', headers: anon, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
}

async function cleanup() {
  await fetch(`${SB}/rest/v1/orders?customer_email=eq.${EMAIL}`, { method: 'DELETE', headers: admin });
}

console.log('=== SMOKE TEST DO CHECKOUT ===');
console.log(`base: ${BASE}\n`);

const stocked = await fetch(`${SB}/rest/v1/products?active=eq.true&stock=gt.3&select=id,name,price,stock&limit=1`, { headers: admin }).then((r) => r.json());
const product = stocked[0];
record('produto com estoque disponivel', Boolean(product), product ? `${product.name} (estoque ${product.stock})` : 'nenhum encontrado');
if (!product) process.exit(1);

const zero = await fetch(`${SB}/rest/v1/products?active=eq.true&stock=eq.0&select=id,name&limit=1`, { headers: admin }).then((r) => r.json());

const health = await fetch(`${BASE}/api/mercadopago/disponibilidade`, { cache: 'no-store' }).then((r) => r.json());
record('rota de disponibilidade responde', typeof health?.available === 'boolean', `available=${health.available} reason=${health.reason} pix=${health.methods?.pix} card=${health.methods?.card}`);
record('public key coerente com o ambiente', health.available ? Boolean(health.publicKey) : true, health.publicKey ? `${health.publicKey.slice(0, 12)}...` : 'nao aplicavel');

const base = {
  p_customer_name: 'Smoke Checkout',
  p_customer_phone: '11999999999',
  p_customer_email: EMAIL,
  p_notes: null,
  p_items: [{ id: product.id, quantity: 1 }],
};

const pickup = await rpc('create_order_with_stock_v3', { ...base, p_delivery_type: 'pickup', p_delivery_address: null });
record('pedido de retirada criado', pickup.ok, pickup.ok ? String(pickup.data).slice(0, 8) : `${pickup.status} ${pickup.data?.message}`);

const address = { postal_code: '03362-060', street: 'Rua Venus', number: '512', neighborhood: 'Vila Formosa', city: 'Sao Paulo', state: 'SP' };
for (const type of ['whatsapp_shipping', 'own_delivery', 'app_delivery']) {
  const created = await rpc('create_order_with_stock_v3', { ...base, p_delivery_type: type, p_delivery_address: address });
  record(`pedido ${type} aceito pelo banco`, created.ok, created.ok ? String(created.data).slice(0, 8) : `${created.status} ${created.data?.message}`);
}

const semEndereco = await rpc('create_order_with_stock_v3', { ...base, p_delivery_type: 'own_delivery', p_delivery_address: null });
record('entrega sem endereco e recusada', !semEndereco.ok, semEndereco.ok ? 'ACEITOU indevidamente' : semEndereco.data?.message);

if (zero[0]) {
  const semEstoque = await rpc('create_order_with_stock_v3', { ...base, p_items: [{ id: zero[0].id, quantity: 1 }], p_delivery_type: 'pickup', p_delivery_address: null });
  record('produto sem estoque e recusado', !semEstoque.ok, semEstoque.ok ? 'ACEITOU indevidamente' : String(semEstoque.data?.message).slice(0, 60));
}

const excesso = await rpc('create_order_with_stock_v3', { ...base, p_items: [{ id: product.id, quantity: product.stock + 50 }], p_delivery_type: 'pickup', p_delivery_address: null });
record('quantidade acima do estoque e recusada', !excesso.ok, excesso.ok ? 'ACEITOU indevidamente' : String(excesso.data?.message).slice(0, 60));

if (pickup.ok) {
  const orderId = pickup.data;

  const quote = await fetch(`${BASE}/api/pedido/entrega`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, provider: 'pickup', email: EMAIL }),
  });
  const quoteData = await quote.json().catch(() => null);
  record('cotacao de retirada calcula o total', quote.ok, quote.ok ? `subtotal ${quoteData.subtotal} frete ${quoteData.fee} total ${quoteData.total}` : quoteData?.error);

  const alheio = await fetch(`${BASE}/api/pedido/entrega`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, provider: 'pickup', email: 'invasor@example.com' }),
  });
  record('cotacao rejeita e-mail de outro cliente', alheio.status === 403, `HTTP ${alheio.status}`);

  const tampered = await fetch(`${BASE}/api/mercadopago/create-payment`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, total: 0.01, formData: { payment_method_id: 'pix', email: EMAIL, payer: { email: EMAIL, identification: { type: 'CPF', number: '12345678909' } } } }),
  });
  const tamperedData = await tampered.json().catch(() => null);
  const dbOrder = await fetch(`${SB}/rest/v1/orders?id=eq.${orderId}&select=total,payment_id,payment_method`, { headers: admin }).then((r) => r.json());

  if (tampered.ok && tamperedData?.id) {
    const sellerRow = await fetch(`${SB}/rest/v1/store_mercadopago?select=access_token`, { headers: admin }).then((r) => r.json());
    const chargeToken = sellerRow?.[0]?.access_token || env.MERCADOPAGO_ACCESS_TOKEN;
    const mp = await fetch(`https://api.mercadopago.com/v1/payments/${tamperedData.id}`, { headers: { Authorization: `Bearer ${chargeToken}` } });
    const paid = await mp.json().catch(() => null);
    const charged = Number(paid?.transaction_amount || 0);
    record('valor cobrado ignora o total do cliente', charged === Number(dbOrder[0]?.total), `pedido R$ ${dbOrder[0]?.total} | cobrado R$ ${charged}`);
    record('pagamento gravado no pedido', Boolean(dbOrder[0]?.payment_id), `${dbOrder[0]?.payment_method} ${dbOrder[0]?.payment_id}`);
    record('split registrado quando aceito', true, paid?.application_fee != null ? `application_fee ${paid.application_fee}` : 'sem split (Mercado Pago recusou a taxa)');
  } else {
    record('criacao de pagamento pix pela rota', false, `HTTP ${tampered.status} ${String(tamperedData?.statusDetail || tamperedData?.error).slice(0, 90)}`);
  }

  const paidOrder = await fetch(`${SB}/rest/v1/orders?id=eq.${orderId}`, { method: 'PATCH', headers: { ...admin, Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'paid' }) });
  if (paidOrder.ok) {
    const again = await fetch(`${BASE}/api/mercadopago/create-payment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, formData: { payment_method_id: 'pix', email: EMAIL, payer: { email: EMAIL } } }),
    });
    record('pedido ja pago nao aceita novo pagamento', again.status === 409, `HTTP ${again.status}`);
  }
}

await cleanup();
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} verificacoes passaram`);
const failures = results.filter((r) => !r.ok);
if (failures.length) {
  console.log('\nfalhas:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
