import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function validateWebhookSignature(request: Request, dataId: string) {
  const secret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET || '').trim();
  if (!secret) return true; // Mantém os testes atuais funcionando até a secret ser configurada.

  const xSignature = request.headers.get('x-signature') || '';
  const xRequestId = request.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(xSignature.split(',').map((part) => part.split('=').map((value) => value.trim())).filter(([key, value]) => key && value));
  const ts = String(parts.ts || '');
  const v1 = String(parts.v1 || '');
  if (!v1 || !ts) return false;

  const manifestParts = [];
  if (dataId) manifestParts.push(`id:${dataId};`);
  if (xRequestId) manifestParts.push(`request-id:${xRequestId};`);
  if (ts) manifestParts.push(`ts:${ts};`);
  const manifest = manifestParts.join('');
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const type = String(body?.type || body?.topic || '');
    const url = new URL(request.url);
    const paymentId = String(body?.data?.id || body?.id || url.searchParams.get('data.id') || '').trim();

    if (type && type !== 'payment') return NextResponse.json({ ok: true });
    if (!paymentId) return NextResponse.json({ ok: true });

    if (!validateWebhookSignature(request, paymentId)) {
      return NextResponse.json({ error: 'Assinatura do webhook inválida.' }, { status: 401 });
    }

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
