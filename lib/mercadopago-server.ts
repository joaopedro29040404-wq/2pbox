import { createClient } from '@supabase/supabase-js';

export function getMercadoPagoAccessToken() {
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    ''
  ).trim();
}

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function syncOrderPayment(orderId: string, payment: any) {
  const admin = getAdminSupabase();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.');

  const externalReference = String(payment?.external_reference || '').trim();
  if (!externalReference || externalReference !== orderId) {
    throw new Error('Pagamento não pertence ao pedido informado.');
  }

  const mpStatus = String(payment?.status || '').toLowerCase();
  let paymentStatus = 'pending';
  let orderStatus = 'pending';

  if (mpStatus === 'approved') {
    paymentStatus = 'approved';
    orderStatus = 'confirmed';
  } else if (['rejected'].includes(mpStatus)) {
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

  // A sincronização definitiva acontece dentro de uma função SQL com lock no
  // pedido. Assim, webhook, polling e submit simultâneos não podem sobrescrever
  // uma aprovação com um evento atrasado nem devolver estoque duas vezes.
  const { data, error } = await admin.rpc('sync_order_payment_state', {
    p_order_id: orderId,
    p_payment_id: incomingPaymentId || null,
    p_payment_status: paymentStatus,
    p_order_status: orderStatus,
    p_status_detail: statusDetail,
  });

  if (error) {
    // Compatibilidade temporária caso a migration ainda não tenha sido executada.
    // O deploy continua funcional, mas a devolução automática de estoque depende
    // da migration 20260906_payment_flow_hardening.sql.
    console.error('Payment state RPC error:', error);
    const { data: currentOrder, error: currentOrderError } = await admin
      .from('orders')
      .select('status,payment_status,payment_id')
      .eq('id', orderId)
      .maybeSingle();
    if (currentOrderError) throw currentOrderError;

    const currentIsApproved = currentOrder?.status === 'confirmed' || currentOrder?.payment_status === 'approved';
    if (currentIsApproved && paymentStatus !== 'approved') {
      return {
        paymentStatus: String(currentOrder?.payment_status || 'approved'),
        orderStatus: String(currentOrder?.status || 'confirmed'),
        mpStatus,
        paymentId: String(currentOrder?.payment_id || incomingPaymentId || ''),
        statusDetail,
      };
    }

    const { error: updateError } = await admin
      .from('orders')
      .update({
        payment_id: incomingPaymentId || currentOrder?.payment_id || null,
        payment_status: paymentStatus,
        status: orderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
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
