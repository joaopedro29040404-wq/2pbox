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
  } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(mpStatus)) {
    paymentStatus = mpStatus === 'rejected' ? 'rejected' : 'cancelled';
    orderStatus = 'cancelled';
  } else if (['in_process', 'pending', 'authorized'].includes(mpStatus)) {
    paymentStatus = mpStatus;
    orderStatus = 'pending';
  }

  const { data: currentOrder, error: currentOrderError } = await admin
    .from('orders')
    .select('status,payment_status,payment_id')
    .eq('id', orderId)
    .maybeSingle();
  if (currentOrderError) throw currentOrderError;

  // Uma consulta atrasada nunca deve desfazer uma aprovação já confirmada.
  const currentIsApproved = currentOrder?.status === 'confirmed' || currentOrder?.payment_status === 'approved';
  const currentPaymentId = currentOrder?.payment_id ? String(currentOrder.payment_id) : '';
  const incomingPaymentId = payment?.id ? String(payment.id) : '';
  const isDifferentPayment = Boolean(currentPaymentId && incomingPaymentId && currentPaymentId !== incomingPaymentId);

  if (currentIsApproved && isDifferentPayment && paymentStatus !== 'approved' && paymentStatus !== 'cancelled') {
    return {
      paymentStatus: String(currentOrder.payment_status || 'approved'),
      orderStatus: String(currentOrder.status || 'confirmed'),
      mpStatus,
      paymentId: currentPaymentId,
    };
  }

  const { error } = await admin
    .from('orders')
    .update({
      payment_id: incomingPaymentId || currentPaymentId || null,
      payment_status: paymentStatus,
      status: orderStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) throw error;
  return { paymentStatus, orderStatus, mpStatus, paymentId: incomingPaymentId || currentPaymentId || null };
}
