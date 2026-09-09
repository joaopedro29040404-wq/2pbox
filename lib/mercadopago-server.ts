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

function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

const APPROVED = new Set(['approved', 'processed', 'accredited']);
const REJECTED = new Set(['rejected', 'failed']);
const CANCELLED = new Set(['cancelled', 'canceled', 'refunded', 'charged_back']);

export async function syncOrderPayment(orderId: string, payment: any) {
  const admin = getAdminSupabase();
  const publicClient = getPublicSupabase();
  if (!admin && !publicClient) throw new Error('Supabase backend key não configurada.');

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

  const reader = admin || publicClient;
  const { data: current, error: currentError } = await reader!
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

  let updateError: any = null;
  if (admin) {
    const result = await admin.from('orders').update(updatePayload).eq('id', orderId);
    updateError = result.error;
  }

  // The database already exposes a SECURITY DEFINER reconciliation function.
  // Use it as a deterministic fallback when the Vercel service-role key is
  // missing or a direct service-role update is unavailable.
  if (updateError || !admin) {
    const rpcClient = publicClient || admin;
    if (!rpcClient) throw updateError || new Error('Cliente Supabase indisponível.');
    const { error: rpcError } = await rpcClient.rpc('sync_order_payment_state', {
      p_order_id: orderId,
      p_payment_id: incomingPaymentId || current.payment_id || null,
      p_payment_status: paymentStatus,
      p_order_status: paymentStatus === 'approved' ? 'confirmed' : targetOrderStatus,
      p_status_detail: statusDetail,
    });
    if (rpcError) throw updateError || rpcError;
  }

  const { data: persisted, error: persistedError } = await (admin || publicClient)!
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
