import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMercadoPagoWebhookSecret } from '@/lib/server/env';
import {
  fetchMercadoPagoResource,
  isMercadoPagoConfigured,
  normalizeOrderResource,
  syncOrderPayment,
} from '@/lib/server/mercadopago';
import { notifyPaymentChange } from '@/lib/server/orders';
import { QUEUES, type PaymentWebhookJob } from '@/lib/server/queues';
import { isQueueConfigured, publishSafe } from '@/lib/server/rabbitmq';
import { markProcessed } from '@/lib/server/redis';
import { supabaseRest } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function validateSignature(request: Request, dataId: string) {
  const secret = getMercadoPagoWebhookSecret();
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

async function recordEvent(job: PaymentWebhookJob, payload: unknown, status: string) {
  try {
    await supabaseRest('webhook_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        provider: 'mercadopago',
        resource_type: job.resourceType,
        resource_id: job.resourceId,
        action: job.action || null,
        payload,
        status,
      }),
    });
  } catch (error) {
    console.error('[webhook] não foi possível registrar o evento:', error);
  }
}

async function processInline(job: PaymentWebhookJob) {
  if (!isMercadoPagoConfigured()) throw new Error('Mercado Pago não configurado.');

  const result = await fetchMercadoPagoResource(job.resourceType, job.resourceId);
  if (result.status === 404) return { handled: false, reason: 'not_found' };
  if (!result.ok) throw new Error(`Mercado Pago respondeu HTTP ${result.status}.`);

  const resource = result.resource;
  const isOrder = job.resourceType === 'order' || resource?.type === 'online';
  const orderId = String(resource?.external_reference || '').trim();
  if (!orderId) return { handled: false, reason: 'no_external_reference' };

  const payment = isOrder ? normalizeOrderResource(resource, orderId) : resource;
  if (!payment) return { handled: false, reason: 'no_payment' };

  const synced = await syncOrderPayment(orderId, { ...payment, external_reference: orderId });
  if (synced.changed) await notifyPaymentChange(orderId, synced);
  return { handled: true, orderId, paymentStatus: synced.paymentStatus };
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

    if (!validateSignature(request, resourceId)) {
      console.error('[webhook] assinatura inválida', { type, action, resourceId });
      return NextResponse.json({ error: 'Assinatura do webhook inválida.' }, { status: 401 });
    }

    const job: PaymentWebhookJob = {
      kind: 'payment_webhook',
      resourceId,
      resourceType: type === 'order' ? 'order' : 'payment',
      action,
      receivedAt: new Date().toISOString(),
    };

    const fresh = await markProcessed(`webhook:${job.resourceType}:${resourceId}:${action}`, 60);
    if (!fresh) return NextResponse.json({ ok: true, deduplicated: true });

    if (isQueueConfigured()) {
      const published = await publishSafe(QUEUES.paymentWebhook, job, { messageId: `${job.resourceType}:${resourceId}` });
      if (published) {
        await recordEvent(job, body, 'queued');
        return NextResponse.json({ ok: true, queued: true });
      }
    }

    await recordEvent(job, body, 'inline');
    const result = await processInline(job);
    return NextResponse.json({ ok: true, queued: false, ...result });
  } catch (error) {
    console.error('[webhook] erro ao processar:', error);
    return NextResponse.json({ error: 'Webhook processado com erro.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: '2P Box Mercado Pago webhook',
    queue: isQueueConfigured() ? 'rabbitmq' : 'inline',
  });
}
