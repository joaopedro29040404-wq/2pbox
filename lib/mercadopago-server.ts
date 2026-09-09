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

const APPROVED = new Set(['approved','processed','accredited']);
const REJECTED = new Set(['rejected','failed']);
const CANCELLED = new Set(['cancelled','canceled','refunded','charged_back']);

export async function syncOrderPayment(orderId: string, payment: any) {
  const admin = getAdminSupabase();
  if (!admin) throw new Error('Supabase backend key não configurada.');
  const externalReference = String(payment?.external_reference || '').trim();
  if (!externalReference || externalReference !== orderId) throw new Error('Pagamento não pertence ao pedido informado.');

  const mpStatus = String(payment?.status || '').toLowerCase();
  const mpOrderStatus = String(payment?.order_status || '').toLowerCase();
  const mpDetail = String(payment?.status_detail || payment?.order_status_detail || '').toLowerCase();
  const effectiveStatus = mpOrderStatus || mpStatus;

  let paymentStatus = 'pending';
  if (APPROVED.has(effectiveStatus) || APPROVED.has(mpStatus) || mpDetail === 'accredited') paymentStatus = 'approved';
  else if (REJECTED.has(effectiveStatus) || REJECTED.has(mpStatus)) paymentStatus = 'rejected';
  else if (CANCELLED.has(effectiveStatus) || CANCELLED.has(mpStatus)) paymentStatus = 'cancelled';
  else if (['in_process','pending','authorized'].includes(effectiveStatus)) paymentStatus = effectiveStatus;

  const incomingPaymentId = payment?.id ? String(payment.id) : '';
  const statusDetail = String(payment?.status_detail || payment?.order_status_detail || '').trim() || null;

  const { data: current, error: currentError } = await admin.from('orders').select('status,payment_status,payment_id').eq('id', orderId).maybeSingle();
  if (currentError) throw currentError;
  const currentApproved = String(current?.payment_status || '').toLowerCase() === 'approved' || String(current?.status || '').toLowerCase() === 'confirmed';
  if (currentApproved && paymentStatus !== 'approved') {
    return { paymentStatus: 'approved', orderStatus: String(current?.status || 'confirmed'), mpStatus, paymentId: String(current?.payment_id || incomingPaymentId || ''), statusDetail: String(statusDetail || 'accredited') };
  }

  // IMPORTANT: payment reconciliation may automatically advance an order to
  // confirmed only when Mercado Pago approves it. Pending/analysis/authorized
  // states must NEVER overwrite the order workflow status. After approval, the
  // Admin is the only actor allowed to move the order to another workflow state.
  const targetOrderStatus = paymentStatus === 'approved'
    ? 'confirmed'
    : String(current?.status || 'pending');

  const { data, error } = await admin.rpc('sync_order_payment_state', {
    p_order_id: orderId,
    p_payment_id: incomingPaymentId || null,
    p_payment_status: paymentStatus,
    p_order_status: targetOrderStatus,
    p_status_detail: statusDetail,
  });

  if (error) {
    console.error('Payment state RPC error:', error);
    const { data: latest } = await admin.from('orders').select('status,payment_status,payment_id').eq('id', orderId).maybeSingle();
    const latestApproved = String(latest?.payment_status || '').toLowerCase() === 'approved' || String(latest?.status || '').toLowerCase() === 'confirmed';
    if (latestApproved && paymentStatus !== 'approved') return { paymentStatus: 'approved', orderStatus: String(latest?.status || 'confirmed'), mpStatus, paymentId: String(latest?.payment_id || incomingPaymentId || ''), statusDetail };
    const { error: updateError } = await admin.from('orders').update({
      payment_id: incomingPaymentId || latest?.payment_id || null,
      payment_status: paymentStatus,
      payment_status_detail: statusDetail,
      payment_updated_at: new Date().toISOString(),
      ...(paymentStatus === 'approved' ? { status: 'confirmed' } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
    if (updateError) throw updateError;
  }

  const synced = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return { paymentStatus: String(synced.payment_status || paymentStatus), orderStatus: String(synced.order_status || targetOrderStatus), mpStatus, paymentId: String(synced.payment_id || incomingPaymentId || ''), statusDetail };
}
