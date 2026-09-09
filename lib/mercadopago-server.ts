import { createClient } from '@supabase/supabase-js';

export function getMercadoPagoAccessToken() {
  return (process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '').trim();
}

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase now also supports project secret keys (sb_secret_...). Keep the
  // legacy service-role variable for compatibility with existing deployments.
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function syncOrderPayment(orderId: string, payment: any) {
  const admin = getAdminSupabase();
  if (!admin) throw new Error('Supabase backend key não configurada. Adicione SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) na Vercel.');

  const externalReference = String(payment?.external_reference || '').trim();
  if (!externalReference || externalReference !== orderId) throw new Error('Pagamento não pertence ao pedido informado.');

  const mpStatus = String(payment?.status || '').toLowerCase();
  const mpDetail = String(payment?.status_detail || '').toLowerCase();
  let paymentStatus = 'pending';
  let orderStatus = 'pending';

  // Orders API can return the order/transaction as processed with an
  // accredited detail. In the 2P Box domain this is the same terminal state
  // as the legacy Payments API's approved/accredited response.
  if (mpStatus === 'approved' || mpStatus === 'processed' || mpDetail === 'accredited') {
    paymentStatus = 'approved';
    orderStatus = 'confirmed';
  } else if (mpStatus === 'rejected' || mpStatus === 'failed') {
    paymentStatus = 'rejected';
    orderStatus = 'cancelled';
  } else if (['cancelled', 'refunded', 'charged_back'].includes(mpStatus)) {
    paymentStatus = 'cancelled';
    orderStatus = 'cancelled';
  } else if (['in_process', 'pending', 'authorized'].includes(mpStatus)) {
    paymentStatus = mpStatus;
    orderStatus = 'pending';
  }

  const incomingPaymentId = payment?.id ? String(payment.id) : '';
  const statusDetail = String(payment?.status_detail || '').trim() || null;

  const { data, error } = await admin.rpc('sync_order_payment_state', {
    p_order_id: orderId,
    p_payment_id: incomingPaymentId || null,
    p_payment_status: paymentStatus,
    p_order_status: orderStatus,
    p_status_detail: statusDetail,
  });

  if (error) {
    console.error('Payment state RPC error:', error);
    const { data: currentOrder, error: currentOrderError } = await admin.from('orders').select('status,payment_status,payment_id').eq('id', orderId).maybeSingle();
    if (currentOrderError) throw currentOrderError;

    const currentIsApproved = currentOrder?.status === 'confirmed' || currentOrder?.payment_status === 'approved';
    if (currentIsApproved && paymentStatus !== 'approved') {
      return { paymentStatus: String(currentOrder?.payment_status || 'approved'), orderStatus: String(currentOrder?.status || 'confirmed'), mpStatus, paymentId: String(currentOrder?.payment_id || incomingPaymentId || ''), statusDetail };
    }

    const { error: updateError } = await admin.from('orders').update({ payment_id: incomingPaymentId || currentOrder?.payment_id || null, payment_status: paymentStatus, payment_status_detail: statusDetail, payment_updated_at: new Date().toISOString(), status: orderStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
    if (updateError) throw updateError;
  }

  const synced = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return {
    paymentStatus: String(synced.payment_status || paymentStatus),
    orderStatus: String(synced.order_status || orderStatus),
    mpStatus,
    paymentId: String(synced.payment_id || incomingPaymentId || ''),
    statusDetail,
  };
}
