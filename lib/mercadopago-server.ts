import { createClient } from '@supabase/supabase-js';

export function getMercadoPagoAccessToken() {
  return (process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '').trim();
}

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

const APPROVED = new Set(['approved', 'processed', 'accredited']);
const REJECTED = new Set(['rejected', 'failed']);
const CANCELLED = new Set(['cancelled', 'canceled', 'refunded', 'charged_back']);
const IN_PROGRESS = new Set(['pending', 'in_process', 'authorized']);

function normalizePaymentStatus(payment: any) {
  const mpStatus = String(payment?.status || '').toLowerCase();
  const mpOrderStatus = String(payment?.order_status || '').toLowerCase();
  const mpDetail = String(payment?.status_detail || payment?.order_status_detail || '').toLowerCase();
  const effective = mpOrderStatus || mpStatus;
  if (APPROVED.has(effective) || APPROVED.has(mpStatus) || mpDetail === 'accredited') return 'approved';
  if (REJECTED.has(effective) || REJECTED.has(mpStatus)) return 'rejected';
  if (CANCELLED.has(effective) || CANCELLED.has(mpStatus)) return 'cancelled';
  if (IN_PROGRESS.has(effective)) return effective;
  return 'pending';
}

/**
 * Single payment reconciliation path used by checkout, webhook and fallback APIs.
 * Mercado Pago is authoritative for the incoming payment; orders is authoritative
 * for the state returned to the application after the reconciliation is persisted.
 */
export async function syncOrderPayment(orderId: string, payment: any) {
  const admin = getAdminSupabase();
  if (!admin) throw new Error('Supabase backend key não configurada.');

  const externalReference = String(payment?.external_reference || '').trim();
  if (!externalReference || externalReference !== orderId) throw new Error('Pagamento não pertence ao pedido informado.');

  const paymentStatus = normalizePaymentStatus(payment);
  const paymentId = payment?.id ? String(payment.id) : '';
  const statusDetail = String(payment?.status_detail || payment?.order_status_detail || '').trim() || null;

  // The database RPC is deliberately the only write path. It locks the order and
  // prevents an older pending/rejected/cancelled response from overwriting a newer
  // terminal state.
  const { data: rpcResult, error: rpcError } = await admin.rpc('sync_order_payment_state', {
    p_order_id: orderId,
    p_payment_id: paymentId || null,
    p_payment_status: paymentStatus,
    p_order_status: paymentStatus === 'approved' ? 'confirmed' : 'pending',
    p_status_detail: statusDetail,
  });
  if (rpcError) throw rpcError;

  const { data: persisted, error: persistedError } = await admin
    .from('orders')
    .select('status,payment_status,payment_status_detail,payment_id,payment_updated_at,updated_at')
    .eq('id', orderId)
    .maybeSingle();
  if (persistedError) throw persistedError;
  if (!persisted) throw new Error('Pedido não foi encontrado após a sincronização.');

  const persistedPaymentStatus = String(persisted.payment_status || 'pending').toLowerCase();
  const persistedOrderStatus = String(persisted.status || 'pending').toLowerCase();

  if (paymentStatus === 'approved' && (persistedPaymentStatus !== 'approved' || persistedOrderStatus !== 'confirmed')) {
    throw new Error(`Sincronização incompleta: payment_status=${persistedPaymentStatus}, status=${persistedOrderStatus}.`);
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
