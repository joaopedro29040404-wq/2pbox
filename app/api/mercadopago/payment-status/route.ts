import { NextResponse } from 'next/server';
import { getAdminSupabase, getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APPROVED = new Set(['approved', 'processed', 'accredited']);
const statusPriority: Record<string, number> = { processed: 100, approved: 100, accredited: 100, authorized: 80, in_process: 50, pending: 40, failed: 20, rejected: 20, canceled: 10, cancelled: 10, refunded: 5, charged_back: 5 };

function normalizeOrder(order: any, fallbackOrderId: string) {
  const payment = order?.transactions?.payments?.[0];
  if (!payment) return null;
  const orderStatus = String(order?.status || '').toLowerCase();
  const paymentStatus = String(payment?.status || '').toLowerCase();
  const effectiveStatus = APPROVED.has(orderStatus) ? orderStatus : (APPROVED.has(paymentStatus) ? paymentStatus : paymentStatus || orderStatus || 'pending');
  return { ...payment, id: payment?.id || order?.id, external_reference: String(order?.external_reference || fallbackOrderId), status: effectiveStatus, status_detail: payment?.status_detail || order?.status_detail || null, order_status: orderStatus || null, order_status_detail: order?.status_detail || null };
}

async function fetchOrder(accessToken: string, mpOrderId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(mpOrderId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  return { response, order: await response.json().catch(() => null) };
}

async function findOrder(accessToken: string, externalReference: string) {
  const now = new Date();
  const begin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({ begin_date: begin.toISOString(), end_date: now.toISOString(), external_reference: externalReference, type: 'online', page: '1', page_size: '50', sort_by: 'created_date', sort_order: 'desc' });
  const response = await fetch(`https://api.mercadopago.com/v1/orders?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!response.ok) return null;
  const result = await response.json().catch(() => null);
  const orders = Array.isArray(result?.data) ? result.data : [];
  const matching = orders.filter((item: any) => String(item?.external_reference || '').trim() === externalReference);
  matching.sort((a: any, b: any) => {
    const pa = statusPriority[String(a?.status || '').toLowerCase()] || 0;
    const pb = statusPriority[String(b?.status || '').toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(String(b?.last_updated_date || b?.created_date || 0)).getTime() - new Date(String(a?.last_updated_date || a?.created_date || 0)).getTime();
  });
  return matching[0] || null;
}

async function fetchLegacyPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  return { response, payment: await response.json().catch(() => null) };
}

async function findLegacyPayment(accessToken: string, externalReference: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=20`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!response.ok) return null;
  const result = await response.json().catch(() => null);
  const payments = Array.isArray(result?.results) ? result.results : [];
  payments.sort((a: any, b: any) => {
    const pa = statusPriority[String(a?.status || '').toLowerCase()] || 0;
    const pb = statusPriority[String(b?.status || '').toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(String(b?.date_last_updated || b?.date_created || 0)).getTime() - new Date(String(a?.date_last_updated || a?.date_created || 0)).getTime();
  });
  return payments[0] || null;
}

function responseFromSynced(synced: any, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ paymentStatus: synced.paymentStatus, orderStatus: synced.orderStatus, paymentId: synced.paymentId || null, statusDetail: synced.statusDetail || null, ...extra }, { headers: { 'Cache-Control': 'no-store, max-age=0, s-maxage=0' } });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = String(url.searchParams.get('orderId') || '').trim();
    const paymentId = String(url.searchParams.get('paymentId') || '').trim();
    const mpOrderId = String(url.searchParams.get('mpOrderId') || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });

    const admin = getAdminSupabase();
    if (admin) {
      const { data: local, error } = await admin.from('orders').select('status,payment_status,payment_status_detail,payment_id').eq('id', orderId).maybeSingle();
      if (!error && local) {
        const approved = String(local.payment_status || '').toLowerCase() === 'approved' || String(local.status || '').toLowerCase() === 'confirmed';
        if (approved) return responseFromSynced({ paymentStatus: 'approved', orderStatus: 'confirmed', paymentId: String(local.payment_id || paymentId || ''), statusDetail: local.payment_status_detail || 'accredited' }, { source: 'local_order' });
      }
    }

    const accessToken = getMercadoPagoAccessToken();
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

    const reconcile = async (resource: any) => {
      if (!resource) return null;
      const payment = resource.transactions ? normalizeOrder(resource, orderId) : { ...resource, id: resource?.id ? String(resource.id) : paymentId || null, external_reference: String(resource?.external_reference || ''), status: resource?.status || 'pending', status_detail: resource?.status_detail || null };
      if (!payment || String(payment.external_reference || '').trim() !== orderId) return null;
      return syncOrderPayment(orderId, payment);
    };

    if (mpOrderId) {
      try {
        const result = await fetchOrder(accessToken, mpOrderId);
        if (result.response.ok) {
          const synced = await reconcile(result.order);
          if (synced) return responseFromSynced(synced, { orderId: String(result.order?.id || mpOrderId), source: 'mercadopago_order' });
        }
      } catch (error) { console.error('Mercado Pago order lookup error:', error); }
    }

    if (paymentId) {
      try {
        const result = await fetchLegacyPayment(accessToken, paymentId);
        if (result.response.ok) {
          const synced = await reconcile(result.payment);
          if (synced) return responseFromSynced(synced, { source: 'mercadopago_payment' });
        }
      } catch (error) { console.error('Mercado Pago payment lookup error:', error); }
    }

    try {
      const order = await findOrder(accessToken, orderId);
      const synced = await reconcile(order);
      if (synced) return responseFromSynced(synced, { orderId: String(order?.id || ''), source: 'mercadopago_order_search' });
    } catch (error) { console.error('Mercado Pago order search error:', error); }

    try {
      const payment = await findLegacyPayment(accessToken, orderId);
      const synced = await reconcile(payment);
      if (synced) return responseFromSynced(synced, { source: 'mercadopago_payment_search' });
    } catch (error) { console.error('Mercado Pago legacy payment search error:', error); }

    return responseFromSynced({ paymentStatus: 'pending', orderStatus: 'pending', paymentId: paymentId || null, statusDetail: null });
  } catch (error) {
    console.error('Mercado Pago payment status error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o status do pagamento.' }, { status: 500 });
  }
}
