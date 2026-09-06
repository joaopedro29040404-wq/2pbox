import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const terminalStatuses = new Set(['approved', 'rejected', 'cancelled', 'refunded', 'charged_back']);
const statusPriority: Record<string, number> = {
  approved: 100,
  authorized: 80,
  in_process: 50,
  pending: 40,
  rejected: 20,
  cancelled: 10,
  refunded: 5,
  charged_back: 5,
};

async function fetchPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const payment = await response.json().catch(() => null);
  return { response, payment };
}

async function findBestPayment(accessToken: string, orderId: string, currentPayment: any) {
  const currentStatus = String(currentPayment?.status || '').toLowerCase();
  if (terminalStatuses.has(currentStatus) || currentStatus === 'authorized') return currentPayment;

  const searchResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=20`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
  );
  const searchResult = await searchResponse.json().catch(() => null);
  if (!searchResponse.ok) return currentPayment;

  const candidates = Array.isArray(searchResult?.results) ? searchResult.results : [];
  const matching = candidates.filter((payment: any) => String(payment?.external_reference || '').trim() === orderId);
  if (!matching.length) return currentPayment;

  matching.sort((a: any, b: any) => {
    const priority = (statusPriority[String(b?.status || '').toLowerCase()] || 0) - (statusPriority[String(a?.status || '').toLowerCase()] || 0);
    if (priority) return priority;
    return new Date(String(b?.date_created || 0)).getTime() - new Date(String(a?.date_created || 0)).getTime();
  });

  return matching[0] || currentPayment;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = String(url.searchParams.get('orderId') || '').trim();
    let paymentId = String(url.searchParams.get('paymentId') || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });

    const accessToken = getMercadoPagoAccessToken();
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

    let payment: any = null;

    if (paymentId) {
      const result = await fetchPayment(accessToken, paymentId);
      if (result.response.ok) payment = result.payment;
      else if (result.response.status !== 404) return NextResponse.json({ error: result.payment?.message || 'Não foi possível consultar o pagamento.' }, { status: 502 });
    }

    if (!payment) {
      const searchResponse = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const searchResult = await searchResponse.json().catch(() => null);
      if (!searchResponse.ok) return NextResponse.json({ error: 'Não foi possível localizar o pagamento.' }, { status: 502 });
      const candidates = Array.isArray(searchResult?.results) ? searchResult.results : [];
      const matching = candidates.filter((item: any) => String(item?.external_reference || '').trim() === orderId);
      matching.sort((a: any, b: any) => {
        const priority = (statusPriority[String(b?.status || '').toLowerCase()] || 0) - (statusPriority[String(a?.status || '').toLowerCase()] || 0);
        if (priority) return priority;
        return new Date(String(b?.date_created || 0)).getTime() - new Date(String(a?.date_created || 0)).getTime();
      });
      payment = matching[0] || null;
      paymentId = payment?.id ? String(payment.id) : '';
    } else {
      payment = await findBestPayment(accessToken, orderId, payment);
      paymentId = payment?.id ? String(payment.id) : paymentId;
    }

    if (!payment) return NextResponse.json({ paymentStatus: 'pending', orderStatus: 'pending', mpStatus: 'pending', paymentId: null });

    const synced = await syncOrderPayment(orderId, payment);
    return NextResponse.json({ ...synced, statusDetail: payment?.status_detail || null });
  } catch (error) {
    console.error('Mercado Pago payment status error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o status do pagamento.' }, { status: 500 });
  }
}
