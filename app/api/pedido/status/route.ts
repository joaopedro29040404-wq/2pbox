import { NextResponse } from 'next/server';
import { getAdminSupabase, getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statusPriority: Record<string, number> = {
  processed: 100, approved: 100, accredited: 100, authorized: 80,
  in_process: 60, pending: 40, failed: 20, rejected: 20,
  canceled: 10, cancelled: 10, refunded: 5, charged_back: 5,
};

function normalizePaymentFromOrder(order: any, fallbackOrderId: string) {
  const payment = order?.transactions?.payments?.[0];
  if (!payment) return null;
  const orderStatus = String(order?.status || '').toLowerCase();
  const paymentStatus = String(payment?.status || '').toLowerCase();
  const effectiveStatus = statusPriority[orderStatus] ? orderStatus : (paymentStatus || orderStatus || 'pending');
  return {
    ...payment,
    id: payment?.id || payment?.reference_id || order?.id,
    external_reference: String(order?.external_reference || fallbackOrderId),
    status: effectiveStatus,
    status_detail: payment?.status_detail || order?.status_detail || null,
    order_status: orderStatus || null,
    order_status_detail: order?.status_detail || null,
  };
}

async function findCurrentMpOrder(accessToken: string, externalReference: string) {
  const now = new Date();
  const begin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    begin_date: begin.toISOString(),
    end_date: now.toISOString(),
    external_reference: externalReference,
    type: 'online',
    page: '1',
    page_size: '50',
    sort_by: 'created_date',
    sort_order: 'desc',
  });
  const response = await fetch(`https://api.mercadopago.com/v1/orders?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const result = await response.json().catch(() => null);
  const orders = Array.isArray(result?.data) ? result.data : [];
  const matching = orders.filter((item: any) => String(item?.external_reference || '').trim() === externalReference);
  matching.sort((a: any, b: any) => {
    const pa = statusPriority[String(a?.status || '').toLowerCase()] || 0;
    const pb = statusPriority[String(b?.status || '').toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(String(b?.last_updated_date || b?.created_date || 0)).getTime()
      - new Date(String(a?.last_updated_date || a?.created_date || 0)).getTime();
  });
  return matching[0] || null;
}

async function findCurrentLegacyPayment(accessToken: string, externalReference: string, paymentId: string) {
  if (paymentId) {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
    });
    if (response.ok) return response.json().catch(() => null);
  }
  const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=20`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  });
  if (!response.ok) return null;
  const result = await response.json().catch(() => null);
  const payments = Array.isArray(result?.results) ? result.results : [];
  payments.sort((a: any, b: any) => {
    const pa = statusPriority[String(a?.status || '').toLowerCase()] || 0;
    const pb = statusPriority[String(b?.status || '').toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(String(b?.date_last_updated || b?.date_created || 0)).getTime()
      - new Date(String(a?.date_last_updated || a?.date_created || 0)).getTime();
  });
  return payments[0] || null;
}

async function readOrder(admin: any, orderId: string, email: string) {
  const { data, error } = await admin.from('orders')
    .select('id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,status,payment_status,total,created_at,payment_id,payment_status_detail,payment_updated_at')
    .eq('id', orderId).ilike('customer_email', email).maybeSingle();
  if (error || !data) return null;
  const { data: items, error: itemsError } = await admin.from('order_items')
    .select('product_id,product_name,quantity,unit_price').eq('order_id', orderId).order('product_name');
  if (itemsError) return null;
  return { order: data, items: items || [] };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrderId = String(url.searchParams.get('orderId') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 });

    const admin = getAdminSupabase();
    if (!admin) return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });

    let orderQuery = admin.from('orders').select('id,customer_email,payment_id,status,payment_status,payment_status_detail,created_at').ilike('customer_email', email);
    if (requestedOrderId) orderQuery = orderQuery.eq('id', requestedOrderId);
    else orderQuery = orderQuery.order('created_at', { ascending: false }).limit(1);
    const { data: currentOrder, error: currentOrderError } = await orderQuery.maybeSingle();
    if (currentOrderError) return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
    if (!currentOrder) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    const orderId = String(currentOrder.id);
    const localStatus = String(currentOrder.status || '').toLowerCase();
    const localPaymentStatus = String(currentOrder.payment_status || '').toLowerCase();

    // Supabase is the canonical state. Never downgrade a confirmed order because
    // an asynchronous Mercado Pago response is stale or temporarily unavailable.
    if (localStatus === 'confirmed' || localPaymentStatus === 'approved') {
      const result = await readOrder(admin, orderId, email);
      if (!result) return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
      return NextResponse.json({
        order: { ...result.order, status: localStatus === 'confirmed' ? 'confirmed' : result.order.status, payment_status: 'approved' },
        items: result.items,
        payment: result.order.payment_id ? { id: String(result.order.payment_id), status: 'approved', statusDetail: result.order.payment_status_detail || 'accredited' } : null,
        source: 'supabase',
      }, { headers: { 'Cache-Control': 'no-store, max-age=0, s-maxage=0' } });
    }

    const accessToken = getMercadoPagoAccessToken();
    if (accessToken) {
      try {
        // Current integration: Mercado Pago Orders API is the first source to reconcile.
        const mpOrder = await findCurrentMpOrder(accessToken, orderId);
        const mpPayment = normalizePaymentFromOrder(mpOrder, orderId);
        if (mpPayment && mpPayment.external_reference === orderId) {
          try { await syncOrderPayment(orderId, mpPayment); } catch (error) { console.error('Public Orders API reconciliation error:', error); }
        } else {
          // Compatibility for older orders created with /v1/payments.
          const legacyPayment = await findCurrentLegacyPayment(accessToken, orderId, String(currentOrder.payment_id || '').trim());
          if (legacyPayment && String(legacyPayment.external_reference || '').trim() === orderId) {
            try { await syncOrderPayment(orderId, legacyPayment); } catch (error) { console.error('Public legacy payment reconciliation error:', error); }
          }
        }
      } catch (error) {
        console.error('Public Mercado Pago reconciliation error:', error);
      }
    }

    const result = await readOrder(admin, orderId, email);
    if (!result) return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });

    const canonicalPaymentStatus = String(result.order.payment_status || 'pending').toLowerCase();
    const canonicalOrderStatus = String(result.order.status || 'pending').toLowerCase();
    const paymentPayload = result.order.payment_id
      ? { id: String(result.order.payment_id), status: canonicalPaymentStatus, statusDetail: result.order.payment_status_detail || null }
      : null;

    return NextResponse.json({
      order: { ...result.order, payment_status: canonicalPaymentStatus, status: canonicalOrderStatus },
      items: result.items,
      payment: paymentPayload,
      source: accessToken ? 'supabase+mercadopago' : 'supabase',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0, s-maxage=0' } });
  } catch (error) {
    console.error('Public order status route error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
  }
}
