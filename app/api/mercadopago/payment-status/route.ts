import { NextResponse } from 'next/server';
import { getAdminSupabase, getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statusPriority: Record<string, number> = {
  processed: 100, approved: 100, accredited: 100, authorized: 80,
  in_process: 50, pending: 40, failed: 20, rejected: 20,
  canceled: 10, cancelled: 10, refunded: 5, charged_back: 5,
};
const terminalOrderStatuses = new Set(['processed', 'approved', 'failed', 'canceled', 'cancelled', 'refunded', 'charged_back']);

function normalizeOrderStatus(orderStatus: unknown, paymentStatus: unknown) {
  const order = String(orderStatus || '').toLowerCase();
  const payment = String(paymentStatus || '').toLowerCase();
  if (terminalOrderStatuses.has(order)) return order;
  return payment || order || 'pending';
}

function normalizeOrder(order: any, fallbackOrderId: string) {
  const payment = order?.transactions?.payments?.[0];
  if (!payment) return null;
  return {
    ...payment,
    id: payment?.id || order?.id,
    external_reference: String(order?.external_reference || fallbackOrderId),
    status: normalizeOrderStatus(order?.status, payment?.status),
    status_detail: payment?.status_detail || order?.status_detail || null,
    order_status: String(order?.status || '').toLowerCase() || null,
    order_status_detail: order?.status_detail || null,
  };
}

async function fetchOrder(accessToken: string, orderId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  });
  return { response, order: await response.json().catch(() => null) };
}

async function findBestOrder(accessToken: string, externalReference: string) {
  // Mercado Pago Orders search is GET /v1/orders, not /v1/orders/search.
  // The API also requires begin_date and end_date and returns the list in `data`.
  const now = new Date();
  const begin = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90);
  const params = new URLSearchParams({
    begin_date: begin.toISOString(),
    end_date: now.toISOString(),
    external_reference: externalReference,
    type: 'online',
    page: '1',
    page_size: '20',
    sort_by: 'created_date',
    sort_order: 'desc',
  });
  const response = await fetch(`https://api.mercadopago.com/v1/orders?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('Mercado Pago order search failed:', { status: response.status, result, externalReference });
    return null;
  }
  const orders = Array.isArray(result?.data) ? result.data : [];
  const matching = orders.filter((order: any) => String(order?.external_reference || '').trim() === externalReference);
  matching.sort((a: any, b: any) => {
    const pa = statusPriority[String(a?.status || '').toLowerCase()] || 0;
    const pb = statusPriority[String(b?.status || '').toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(String(b?.last_updated_date || b?.created_date || 0)).getTime()
      - new Date(String(a?.last_updated_date || a?.created_date || 0)).getTime();
  });
  return matching[0] || null;
}

async function fetchLegacyPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  });
  return { response, payment: await response.json().catch(() => null) };
}

async function findBestLegacyPayment(accessToken: string, externalReference: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=20`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) return null;
  const payments = Array.isArray(result?.results) ? result.results : [];
  const matching = payments.filter((payment: any) => String(payment?.external_reference || '').trim() === externalReference);
  matching.sort((a: any, b: any) => {
    const pa = statusPriority[String(a?.status || '').toLowerCase()] || 0;
    const pb = statusPriority[String(b?.status || '').toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(String(b?.date_last_updated || b?.date_created || 0)).getTime()
      - new Date(String(a?.date_last_updated || a?.date_created || 0)).getTime();
  });
  return matching[0] || null;
}

function responseFromSynced(synced: any, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ...synced, statusDetail: synced?.statusDetail || null, ...extra });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = String(url.searchParams.get('orderId') || '').trim();
    const paymentId = String(url.searchParams.get('paymentId') || '').trim();
    const mpOrderId = String(url.searchParams.get('mpOrderId') || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });

    // The order page and admin page read the same Supabase order. Once that
    // state is confirmed, do not let a stale MP transaction response regress it.
    const admin = getAdminSupabase();
    if (admin) {
      const { data: localOrder, error: localError } = await admin
        .from('orders')
        .select('status,payment_status,payment_status_detail,payment_id')
        .eq('id', orderId)
        .maybeSingle();
      if (!localError && localOrder) {
        const localPayment = String(localOrder.payment_status || '').toLowerCase();
        const localOrderStatus = String(localOrder.status || '').toLowerCase();
        if (localPayment === 'approved' || localOrderStatus === 'confirmed') {
          return responseFromSynced({
            paymentStatus: 'approved',
            orderStatus: 'confirmed',
            mpStatus: 'processed',
            paymentId: String(localOrder.payment_id || paymentId || ''),
            statusDetail: String(localOrder.payment_status_detail || 'accredited'),
          }, { source: 'local_order' });
        }
      }
    }

    const accessToken = getMercadoPagoAccessToken();
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

    if (mpOrderId) {
      try {
        const result = await fetchOrder(accessToken, mpOrderId);
        if (result.response.ok && result.order) {
          const payment = normalizeOrder(result.order, orderId);
          if (payment && payment.external_reference === orderId) {
            const synced = await syncOrderPayment(orderId, payment);
            return responseFromSynced(synced, {
              orderId: String(result.order?.id || mpOrderId),
              mercadoPagoOrderStatus: result.order?.status || null,
              mercadoPagoPaymentStatus: result.order?.transactions?.payments?.[0]?.status || null,
              legacyPaymentsApi: false,
            });
          }
        } else if (result.response.status !== 404) {
          return NextResponse.json({ error: result.order?.message || 'Não foi possível consultar a order.' }, { status: 502 });
        }
      } catch (error) { console.error('Mercado Pago order lookup error:', error); }
    }

    if (paymentId) {
      try {
        const result = await fetchLegacyPayment(accessToken, paymentId);
        if (result.response.ok && result.payment) {
          const payment = {
            ...result.payment,
            id: result.payment?.id ? String(result.payment.id) : paymentId,
            external_reference: String(result.payment?.external_reference || ''),
            status: result.payment?.status || 'pending',
            status_detail: result.payment?.status_detail || null,
          };
          if (payment.external_reference === orderId) {
            const synced = await syncOrderPayment(orderId, payment);
            return responseFromSynced(synced, { orderId: null, legacyPaymentsApi: true });
          }
        }
      } catch (error) { console.error('Mercado Pago legacy payment lookup error:', error); }
    }

    try {
      const legacyPayment = await findBestLegacyPayment(accessToken, orderId);
      if (legacyPayment) {
        const payment = {
          ...legacyPayment,
          id: legacyPayment?.id ? String(legacyPayment.id) : paymentId || null,
          external_reference: String(legacyPayment?.external_reference || ''),
          status: legacyPayment?.status || 'pending',
          status_detail: legacyPayment?.status_detail || null,
        };
        if (payment.external_reference === orderId) {
          const synced = await syncOrderPayment(orderId, payment);
          return responseFromSynced(synced, { orderId: null, legacyPaymentsApi: true });
        }
      }
    } catch (error) { console.error('Mercado Pago legacy payment search error:', error); }

    let mpOrder: any = null;
    try { mpOrder = await findBestOrder(accessToken, orderId); }
    catch (error) { console.error('Mercado Pago order search error:', error); }

    const payment = normalizeOrder(mpOrder, orderId);
    if (payment && payment.external_reference === orderId) {
      const synced = await syncOrderPayment(orderId, payment);
      return responseFromSynced(synced, {
        orderId: String(mpOrder?.id || ''),
        mercadoPagoOrderStatus: mpOrder?.status || null,
        mercadoPagoPaymentStatus: mpOrder?.transactions?.payments?.[0]?.status || null,
        legacyPaymentsApi: false,
      });
    }

    return NextResponse.json({
      paymentStatus: 'pending', orderStatus: 'pending', mpStatus: 'pending',
      paymentId: paymentId || null, orderId: mpOrder?.id ? String(mpOrder.id) : mpOrderId || null,
    });
  } catch (error) {
    console.error('Mercado Pago payment status error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o status do pagamento.' }, { status: 500 });
  }
}
