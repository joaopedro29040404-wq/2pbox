import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const type = String(body?.type || body?.topic || '');
    const paymentId = String(body?.data?.id || body?.id || '').trim();

    if (type && type !== 'payment') return NextResponse.json({ ok: true });
    if (!paymentId) return NextResponse.json({ ok: true });

    const accessToken = getMercadoPagoAccessToken();
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const payment = await response.json();
    if (!response.ok) return NextResponse.json({ error: 'Não foi possível consultar o pagamento.' }, { status: 502 });

    const orderId = String(payment?.external_reference || '').trim();
    if (orderId) await syncOrderPayment(orderId, payment);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Mercado Pago webhook error:', error);
    return NextResponse.json({ error: 'Webhook processado com erro.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: '2P Box Mercado Pago webhook' });
}
