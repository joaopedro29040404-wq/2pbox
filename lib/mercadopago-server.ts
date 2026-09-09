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
  else if (['in_process', 'pending', 'authorized'].includes(effectiveStatus)) paymentStatus = effectiveStatus;

  const incomingPaymentId = payment?.id ? String(payment.id) : '';
  const statusDetail = String(payment?.status_detail || payment?.order_status_detail || '').trim() || null;
  const now = new Date().toISOString();

  const { data: current, error: currentError } = await admin
    .from('orders')
    .select('status,payment_status,payment_id')
    .eq('id', orderId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error('Pedido não encontrado.');

  const currentApproved = String(current.payment_status || '').toLowerCase() === 'approved' || String(current.status || '').toLowerCase() === 'confirmed';
  if (currentApproved && paymentStatus !== 'approved') {
    return {
      paymentStatus: 'approved',
      orderStatus: String(current.status || 'confirmed'),
      mpStatus,
      paymentId: String(current.payment_id || incomingPaymentId || ''),
      statusDetail: String(statusDetail || 'accredited'),
    };
  }

  const targetOrderStatus = paymentStatus === 'approved' ? 'confirmed' : String(current.status || 'pending');
  const updatePayload: Record<string, unknown> = {
    payment_id: incomingPaymentId || current.payment_id || null,
    payment_status: paymentStatus,
    payment_status_detail: statusDetail,
    payment_updated_at: now,
    updated_at: now,
  };
  if (paymentStatus === 'approved') updatePayload.status = 'confirmed';

  // One canonical persistence path: every Mercado Pago event, checkout response,
  // webhook and fallback reconciliation ends here. The service-role client is
  // used server-side, so this does not depend on browser RLS policies.
  const { error: updateError } = await admin.from('orders').update(updatePayload).eq('id', orderId);
  if (updateError) throw updateError;

  const { data: persisted, error: persistedError } = await admin
    .from('orders')
    .select('status,payment_status,payment_status_detail,payment_id')
    .eq('id', orderId)
    .maybeSingle();
  if (persistedError) throw persistedError;
  if (!persisted) throw new Error('Pedido não foi encontrado após a sincronização.');

  const persistedPaymentStatus = String(persisted.payment_status || '').toLowerCase();
  const persistedOrderStatus = String(persisted.status || '').toLowerCase();
  if (paymentStatus === 'approved' && (persistedPaymentStatus !== 'approved' || persistedOrderStatus !== 'confirmed')) {
    throw new Error(`Sincronização incompleta: payment_status=${persistedPaymentStatus || 'null'}, status=${persistedOrderStatus || 'null'}.`);
  }

  return {
    paymentStatus: persistedPaymentStatus || paymentStatus,
    orderStatus: persistedOrderStatus || targetOrderStatus,
    mpStatus,
    paymentId: String(persisted.payment_id || incomingPaymentId || ''),
    statusDetail: persisted.payment_status_detail || statusDetail,
  };
}
