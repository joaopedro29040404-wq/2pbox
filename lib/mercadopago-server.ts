import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
}

function getSupabaseSecretKey() {
  const direct = String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    '',
  ).trim();
  if (direct) return direct;

  // Supabase's current API-key system exposes named secret keys as JSON.
  // Accepting it here keeps the backend compatible with both the current
  // sb_secret_* keys and the legacy service_role key.
  try {
    const named = String(process.env.SUPABASE_SECRET_KEYS || '').trim();
    if (named) {
      const parsed = JSON.parse(named);
      const defaultKey = String(parsed?.default || '').trim();
      if (defaultKey) return defaultKey;
    }
  } catch {}

  return '';
}

export function getMercadoPagoAccessToken() {
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    ''
  ).trim();
}

export function getAdminSupabase() {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseSecretKey();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function callSupabaseRpc(name: string, body: Record<string, unknown>) {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  if (!url || !key) throw new Error('Credencial backend do Supabase não configurada na Vercel.');

  // Use the Data API directly for the critical reconciliation write. This sends
  // the secret/service key as an API key and avoids depending on how a particular
  // supabase-js release represents the newer sb_secret_* keys.
  const response = await fetch(`${url}/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message || payload?.hint || payload?.details || `HTTP ${response.status}`;
    throw new Error(`Supabase RPC ${name} falhou: ${String(detail)}`);
  }
  return payload;
}

async function readPersistedOrder(orderId: string) {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  if (!url || !key) throw new Error('Credencial backend do Supabase não configurada na Vercel.');

  const query = new URLSearchParams({
    select: 'status,payment_status,payment_status_detail,payment_id,payment_updated_at,updated_at',
    id: `eq.${orderId}`,
    limit: '1',
  });
  const response = await fetch(`${url}/rest/v1/orders?${query.toString()}`, {
    headers: { apikey: key, Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message || payload?.hint || payload?.details || `HTTP ${response.status}`;
    throw new Error(`Supabase leitura do pedido falhou: ${String(detail)}`);
  }
  const persisted = Array.isArray(payload) ? payload[0] : null;
  if (!persisted) throw new Error('Pedido não foi encontrado após a sincronização.');
  return persisted;
}

const APPROVED = new Set(['approved', 'processed', 'accredited']);
const REJECTED = new Set(['rejected', 'failed']);
const CANCELLED = new Set(['cancelled', 'canceled', 'refunded', 'charged_back']);
const IN_PROGRESS = new Set(['pending', 'in_process', 'authorized', 'processing', 'action_required', 'created']);

function normalizePaymentStatus(payment: any) {
  const mpStatus = String(payment?.status || '').toLowerCase();
  const mpOrderStatus = String(payment?.order_status || '').toLowerCase();
  const mpDetail = String(payment?.status_detail || payment?.order_status_detail || '').toLowerCase();
  const effective = mpOrderStatus || mpStatus;

  if (APPROVED.has(effective) || APPROVED.has(mpStatus) || mpDetail === 'accredited') return 'approved';
  if (REJECTED.has(effective) || REJECTED.has(mpStatus)) return 'rejected';
  if (CANCELLED.has(effective) || CANCELLED.has(mpStatus)) return 'cancelled';
  if (IN_PROGRESS.has(effective)) {
    if (effective === 'processing' || effective === 'action_required' || effective === 'created') return 'pending';
    return effective;
  }
  return 'pending';
}

/**
 * Single payment reconciliation path used by checkout, webhook and fallback APIs.
 * Mercado Pago is authoritative for the incoming payment; orders is authoritative
 * for the state returned to the application after the reconciliation is persisted.
 */
export async function syncOrderPayment(orderId: string, payment: any) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) throw new Error('Pedido é obrigatório.');

  const externalReference = String(payment?.external_reference || '').trim();
  if (!externalReference || externalReference !== normalizedOrderId) {
    throw new Error('Pagamento não pertence ao pedido informado.');
  }

  const paymentStatus = normalizePaymentStatus(payment);
  const paymentId = payment?.id ? String(payment.id) : '';
  const statusDetail = String(payment?.status_detail || payment?.order_status_detail || '').trim() || null;

  const rpcResult = await callSupabaseRpc('sync_order_payment_state', {
    p_order_id: normalizedOrderId,
    p_payment_id: paymentId || null,
    p_payment_status: paymentStatus,
    p_order_status: paymentStatus === 'approved' ? 'confirmed' : 'pending',
    p_status_detail: statusDetail,
  });

  const persisted = await readPersistedOrder(normalizedOrderId);
  const persistedPaymentStatus = String(persisted.payment_status || 'pending').toLowerCase();
  const persistedOrderStatus = String(persisted.status || 'pending').toLowerCase();

  // A successful Mercado Pago result is not considered synchronized until the
  // exact persisted order state can be read back from Supabase.
  if (paymentStatus === 'approved' && (persistedPaymentStatus !== 'approved' || persistedOrderStatus !== 'confirmed')) {
    throw new Error(
      `Sincronização incompleta: payment_status=${persistedPaymentStatus}, status=${persistedOrderStatus}.`,
    );
  }

  return {
    paymentStatus: persistedPaymentStatus,
    orderStatus: persistedOrderStatus,
    mpStatus: String(payment?.status || '').toLowerCase(),
    paymentId: String(persisted.payment_id || paymentId || ''),
    statusDetail: persisted.payment_status_detail || statusDetail,
    paymentUpdatedAt: persisted.payment_updated_at || null,
    updatedAt: persisted.updated_at || null,
    rpcResult,
  };
}
