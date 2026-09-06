import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = String(url.searchParams.get('orderId') || '').trim();
    let paymentId = String(url.searchParams.get('paymentId') || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });

    const accessToken = getMercadoPagoAccessToken();
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

    if (!paymentId) {
      const searchResponse = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=10`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const searchResult = await searchResponse.json();
      if (!searchResponse.ok) return NextResponse.json({ error: 'Não foi possível localizar o pagamento.' }, { status: 502 });
      paymentId = String(searchResult?.results?.[0]?.id || '').trim();
    }

    if (!paymentId) return NextResponse.json({ paymentStatus: 'pending', orderStatus: 'pending', mpStatus: 'pending', paymentId: null });

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const payment = await response.json();
    if (!response.ok) return NextResponse.json({ error: payment?.message || 'Não foi possível consultar o pagamento.' }, { status: 502 });

    const synced = await syncOrderPayment(orderId, payment);
    return NextResponse.json({ ...synced, statusDetail: payment?.status_detail || null });
  } catch (error) {
    console.error('Mercado Pago payment status error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o status do pagamento.' }, { status: 500 });
  }
}
