import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

const TOKEN = env.MERCADOPAGO_ACCESS_TOKEN;
const PUBLIC_KEY = env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
const API = 'https://api.mercadopago.com';
const FEE_PERCENT = Number(env.PLATFORM_COMMISSION_PERCENT || 6);

let BUYER_EMAIL = '';

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASSA ' : 'FALHA '} ${name.padEnd(46)} ${detail}`);
};

function idempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function mp(path, body, key) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Idempotency-Key': key || idempotencyKey('smoke'),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, data };
}

async function cardToken(cardholder) {
  const response = await fetch(`${API}/v1/card_tokens?public_key=${encodeURIComponent(PUBLIC_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_number: '5031433215406351',
      expiration_month: 11,
      expiration_year: 2030,
      security_code: '123',
      cardholder: { name: cardholder, identification: { type: 'CPF', number: '12345678909' } },
    }),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, id: data?.id || null, data };
}

function paymentBody({ method, amount, token, fee }) {
  const isPix = method === 'pix';
  return {
    transaction_amount: amount,
    description: 'Smoke test 2P Box',
    payment_method_id: isPix ? 'pix' : 'master',
    external_reference: `smoke-${Date.now()}`,
    payer: {
      email: BUYER_EMAIL,
      identification: { type: 'CPF', number: '12345678909' },
      ...(isPix ? { first_name: 'Teste', last_name: 'Smoke' } : {}),
    },
    ...(isPix ? {} : { token, installments: 1 }),
    ...(isPix ? { date_of_expiration: new Date(Date.now() + 35 * 60_000).toISOString() } : {}),
    ...(fee ? { application_fee: fee } : {}),
  };
}

console.log('=== SMOKE TEST MERCADO PAGO (credenciais de teste) ===');
console.log(`token: ${TOKEN.slice(0, 8)}... | public key: ${PUBLIC_KEY.slice(0, 8)}...`);
console.log(`comissao configurada: ${FEE_PERCENT}%\n`);

const me = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const account = await me.json();
record('credenciais validas', me.ok, me.ok ? `conta ${account.id} (${account.site_id})` : account.message);

const methods = await fetch(`${API}/v1/payment_methods`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const list = await methods.json();
const pixEnabled = Array.isArray(list) && list.some((m) => m.id === 'pix');
const cardEnabled = Array.isArray(list) && list.some((m) => m.payment_type_id === 'credit_card');
record('cartao habilitado na conta', cardEnabled, cardEnabled ? 'sim' : 'nao aparece em payment_methods');
record('pix habilitado na conta', pixEnabled, pixEnabled ? 'sim' : 'nao aparece em payment_methods');

BUYER_EMAIL = `smoke.${Date.now()}@example.com`;

const AMOUNT = 10;
const FEE = Math.round(AMOUNT * (FEE_PERCENT / 100) * 100) / 100;

const approved = await cardToken('APRO');
record('tokenizacao do cartao (public key)', approved.ok, approved.ok ? `token ${String(approved.id).slice(0, 10)}...` : JSON.stringify(approved.data).slice(0, 90));

if (approved.ok) {
  const cardPlain = await mp('/v1/payments', paymentBody({ method: 'card', amount: AMOUNT, token: approved.id }));
  record('cartao SEM split', cardPlain.ok, cardPlain.ok ? `id ${cardPlain.data.id} | ${cardPlain.data.status}/${cardPlain.data.status_detail}` : `${cardPlain.status} ${cardPlain.data?.message}`);

  const tokenForSplit = await cardToken('APRO');
  const cardSplit = await mp('/v1/payments', paymentBody({ method: 'card', amount: AMOUNT, token: tokenForSplit.id, fee: FEE }));
  record('cartao COM application_fee', cardSplit.ok, cardSplit.ok
    ? `id ${cardSplit.data.id} | fee aceita | ${cardSplit.data.status}`
    : `${cardSplit.status} ${cardSplit.data?.cause?.[0]?.code || ''} ${cardSplit.data?.message}`);

  const rejected = await cardToken('OTHE');
  if (rejected.ok) {
    const cardRejected = await mp('/v1/payments', paymentBody({ method: 'card', amount: AMOUNT, token: rejected.id }));
    const isRejected = cardRejected.ok && cardRejected.data.status === 'rejected';
    record('cartao recusado (OTHE) devolve rejected', isRejected, cardRejected.ok ? `${cardRejected.data.status}/${cardRejected.data.status_detail}` : `HTTP ${cardRejected.status}`);
  }
}

const pixPlain = await mp('/v1/payments', paymentBody({ method: 'pix', amount: AMOUNT }));
const qr = pixPlain.data?.point_of_interaction?.transaction_data?.qr_code;
record('pix SEM split', pixPlain.ok && Boolean(qr), pixPlain.ok ? `id ${pixPlain.data.id} | QR ${qr ? qr.length + ' chars' : 'ausente'}` : `${pixPlain.status} ${pixPlain.data?.message}`);

const pixSplit = await mp('/v1/payments', paymentBody({ method: 'pix', amount: AMOUNT, fee: FEE }));
record('pix COM application_fee', pixSplit.ok, pixSplit.ok
  ? `id ${pixSplit.data.id} | fee aceita`
  : `${pixSplit.status} ${pixSplit.data?.cause?.[0]?.code || ''} ${pixSplit.data?.message}`);

const key = idempotencyKey('idem');
const first = await mp('/v1/payments', paymentBody({ method: 'pix', amount: AMOUNT }), key);
const second = await mp('/v1/payments', paymentBody({ method: 'pix', amount: AMOUNT }), key);
record('idempotencia do pix', first.data?.id === second.data?.id, `${first.data?.id} vs ${second.data?.id}`);

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} verificacoes passaram`);
const failures = results.filter((r) => !r.ok);
if (failures.length) {
  console.log('\nfalhas:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
}
