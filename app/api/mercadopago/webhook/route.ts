import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SyncedPayment = {
  paymentStatus?: string | null;
  orderStatus?: string | null;
  paymentId?: string | null;
  statusDetail?: string | null;
};

function validateWebhookSignature(request: Request, dataId: string) {
  const secret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET || '').trim();
  if (!secret) return true;

  const xSignature = request.headers.get('x-signature') || '';
  const xRequestId = request.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(
    xSignature
      .split(',')
      .map((part) => part.split('=').map((value) => value.trim()))
      .filter(([key, value]) => key && value),
  ) as Record<string, string>;
  const ts = String(parts.ts || '');
  const v1 = String(parts.v1 || '');
  if (!v1 || !ts) return false;

  const manifest = `${dataId ? `id:${dataId};` : ''}${xRequestId ? `request-id:${xRequestId};` : ''}ts:${ts};`;
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
    const url = new URL(request.url);
    const type = String(body?.type || body?.topic || url.searchParams.get('type') || '').toLowerCase();
    const action = String(body?.action || '').toLowerCase();
    const resourceId = String(body?.data?.id || body?.id || url.searchParams.get('data.id') || '').trim();

    if (!resourceId) return NextResponse.json({ ok: true, acknowledged: true });
    if (type && !['payment', 'order'].includes(type)) return NextResponse.json({ ok: true, ignored: true });
    if (!validateWebhookSignature(request, resourceId)) {
      console.error('Mercado Pago webhook rejected: invalid signature', { type, action, resourceId });
      return NextResponse.json({ error: 'Assinatura do webhook inválida.' }, { status: 401 });
    }

    const accessToken = getMercadoPagoAccessToken();
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

    const endpoint = type === 'order'
      ? `/v1/orders/${encodeURIComponent(resourceId)}`
      : `/v1/payments/${encodeURIComponent(resourceId)}`;

    const response = await fetch(`https://api.mercadopago.com${endpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const resource = await response.json().catch(() => null);

    if (response.status === 404) return NextResponse.json({ ok: true, acknowledged: true, resourceFound: false });
    if (!response.ok) return NextResponse.json({ error: 'Não foi possível consultar o recurso no Mercado Pago.' }, { status: 502 });

    let synced: SyncedPayment | null = null;
    if (type === 'order' || resource?.type === 'online') {
      const orderId = String(resource?.external_reference || '').trim();
      const payment = resource?.transactions?.payments?.[0];
      if (orderId && payment) {
        synced = await syncOrderPayment(orderId, {
          ...payment,
          id: payment?.id || resource?.id,
          external_reference: orderId,
          order_status: resource?.status || null,
          order_status_detail: resource?.status_detail || null,
        });
      }
    } else {
      const orderId = String(resource?.external_reference || '').trim();
      if (orderId) synced = await syncOrderPayment(orderId, resource);
    }

    console.info('Mercado Pago webhook synced', {
      type,
      action,
      resourceId,
      orderStatus: synced?.orderStatus || null,
      paymentStatus: synced?.paymentStatus || null,
      paymentId: synced?.paymentId || null,
    });

    return NextResponse.json({ ok: true, acknowledged: true, resourceFound: true, synced: Boolean(synced) });
  } catch (error) {
    console.error('Mercado Pago webhook error:', error);
    return NextResponse.json({ error: 'Webhook processado com erro.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: '2P Box Mercado Pago webhook' });
}
