import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statusPriority: Record<string, number> = { processed: 100, approved: 100, accredited: 100, authorized: 80, in_process: 50, pending: 40, rejected: 20, cancelled: 10, refunded: 5, charged_back: 5, failed: 1 };

function normalizeOrder(order: any, fallbackOrderId: string) {
  const payment = order?.transactions?.payments?.[0];
  if (!payment) return null;
  return {
    ...payment,
    id: payment?.id || order?.id,
    external_reference: String(order?.external_reference || fallbackOrderId),
    status: payment?.status || order?.status || 'pending',
    status_detail: payment?.status_detail || order?.status_detail || null,
  };
}

async function fetchOrder(accessToken: string, orderId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const order = await response.json().catch(() => null);
  return { response, order };
}

async function findBestOrder(accessToken: string, externalReference: string) {
  const searchResponse = await fetch(`https://api.mercadopago.com/v1/orders/search?external_reference=${encodeURIComponent(externalReference)}&limit=20`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const searchResult = await searchResponse.json().catch(() => null);
  if (!searchResponse.ok) return null;
  const orders = Array.isArray(searchResult?.results) ? searchResult.results : [];
  const matching = orders.filter((order: any) => String(order?.external_reference || '').trim() === externalReference);
  matching.sort((a: any, b: any) => {
    const pa = statusPriority[String(a?.status || '').toLowerCase()] || 0;
    const pb = statusPriority[String(b?.status || '').toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    return new Date(String(b?.last_updated_date || b?.created_date || 0)).getTime() - new Date(String(a?.last_updated_date || a?.created_date || 0)).getTime();
  });
  return matching[0] || null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = String(url.searchParams.get('orderId') || '').trim();
    let mpOrderId = String(url.searchParams.get('mpOrderId') || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });

    const accessToken = getMercadoPagoAccessToken();
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

    let mpOrder: any = null;
    if (mpOrderId) {
      const result = await fetchOrder(accessToken, mpOrderId);
      if (result.response.ok) mpOrder = result.order;
      else if (result.response.status !== 404) return NextResponse.json({ error: result.order?.message || 'Não foi possível consultar a order.' }, { status: 502 });
    }

    if (!mpOrder) mpOrder = await findBestOrder(accessToken, orderId);
    if (mpOrder) mpOrderId = String(mpOrder.id || mpOrderId);

    const payment = normalizeOrder(mpOrder, orderId);
    if (!payment) return NextResponse.json({ paymentStatus: 'pending', orderStatus: 'pending', mpStatus: 'pending', paymentId: null, orderId: mpOrderId || null });

    const synced = await syncOrderPayment(orderId, payment);
    return NextResponse.json({ ...synced, statusDetail: payment.status_detail || null, orderId: mpOrderId || null });
  } catch (error) {
    console.error('Mercado Pago order status error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o status do pagamento.' }, { status: 500 });
  }
}
