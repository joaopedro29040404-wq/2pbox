import { NextResponse } from 'next/server';
import { isMercadoPagoConfigured, resolveMercadoPagoPayment, syncOrderPayment } from '@/lib/server/mercadopago';
import { notifyPaymentChange, queryOrders } from '@/lib/server/orders';
import { QUEUES, type PaymentReconcileJob } from '@/lib/server/queues';
import { isQueueConfigured, publishSafe } from '@/lib/server/rabbitmq';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, s-maxage=0' };

type StatusPayload = {
  paymentStatus: string;
  orderStatus: string;
  paymentId: string | null;
  statusDetail: string | null;
  paymentMethod?: string | null;
  paymentType?: string | null;
  installments?: number | null;
  source: string;
};

function respond(payload: StatusPayload) {
  return NextResponse.json(payload, { headers: NO_STORE });
}

async function readLocalOrder(orderId: string) {
  const rows = await queryOrders(new URLSearchParams({ id: `eq.${orderId}`, limit: '1' }));
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = String(url.searchParams.get('orderId') || '').trim();
    const paymentId = String(url.searchParams.get('paymentId') || '').trim();
    const mpOrderId = String(url.searchParams.get('mpOrderId') || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });

    const local = await readLocalOrder(orderId).catch(() => null);
    const localPaymentStatus = String(local?.payment_status || '').toLowerCase();
    const localOrderStatus = String(local?.status || '').toLowerCase();

    if (localPaymentStatus === 'paid') {
      return respond({
        paymentStatus: 'paid',
        orderStatus: localOrderStatus || 'confirmed',
        paymentId: String(local?.payment_id || paymentId || '') || null,
        statusDetail: local?.payment_status_detail || 'accredited',
        paymentMethod: local?.payment_method || null,
        paymentType: local?.payment_type || null,
        installments: local?.payment_installments ?? null,
        source: 'local_order',
      });
    }

    if (!isMercadoPagoConfigured()) {
      return respond({
        paymentStatus: localPaymentStatus || 'pending',
        orderStatus: localOrderStatus || 'pending',
        paymentId: String(local?.payment_id || paymentId || '') || null,
        statusDetail: local?.payment_status_detail || null,
        source: 'local_order',
      });
    }

    const payment = await resolveMercadoPagoPayment(orderId, {
      paymentId: paymentId || String(local?.payment_id || '') || undefined,
      mpOrderId: mpOrderId || undefined,
    });

    if (!payment) {
      const job: PaymentReconcileJob = { kind: 'payment_reconcile', orderId, paymentId: paymentId || null, reason: 'status_lookup' };
      if (isQueueConfigured()) await publishSafe(QUEUES.paymentReconcile, job);
      return respond({
        paymentStatus: localPaymentStatus || 'pending',
        orderStatus: localOrderStatus || 'pending',
        paymentId: paymentId || null,
        statusDetail: local?.payment_status_detail || null,
        source: 'pending_reconciliation',
      });
    }

    const synced = await syncOrderPayment(orderId, payment);
    if (synced.changed) await notifyPaymentChange(orderId, synced).catch((error) => console.error('[payment-status] notificação falhou:', error));

    return respond({
      paymentStatus: synced.paymentStatus,
      orderStatus: synced.orderStatus,
      paymentId: synced.paymentId || null,
      statusDetail: synced.statusDetail,
      paymentMethod: synced.paymentMethod,
      paymentType: synced.paymentType,
      installments: synced.installments,
      source: 'mercadopago',
    });
  } catch (error) {
    console.error('[payment-status] erro:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o status do pagamento.' }, { status: 500 });
  }
}
