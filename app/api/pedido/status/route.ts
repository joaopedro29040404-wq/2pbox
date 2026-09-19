import { NextResponse } from 'next/server';
import { fetchPaymentBilling, isMercadoPagoConfigured, resolveMercadoPagoPayment, syncOrderPayment } from '@/lib/server/mercadopago';
import { notifyPaymentChange, queryOrders, readOrderHistory, readOrderItems } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, s-maxage=0' };

async function findOrder(email: string, orderId: string) {
  const params = new URLSearchParams({ limit: '1' });
  params.set('customer_email', `ilike.${email}`);
  if (orderId) params.set('id', `eq.${orderId}`);
  else params.set('order', 'created_at.desc');
  const rows = await queryOrders(params);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrderId = String(url.searchParams.get('orderId') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 });

    let order = await findOrder(email, requestedOrderId);
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    const orderId = String(order.id);
    const paymentStatus = String(order.payment_status || '').toLowerCase();
    const orderStatus = String(order.status || '').toLowerCase();
    const settled = paymentStatus === 'paid' || orderStatus === 'cancelled';

    if (!settled && isMercadoPagoConfigured()) {
      try {
        const payment = await resolveMercadoPagoPayment(orderId, { paymentId: String(order.payment_id || '') || undefined });
        if (payment) {
          const synced = await syncOrderPayment(orderId, payment);
          if (synced.changed) await notifyPaymentChange(orderId, synced).catch(() => undefined);
          order = (await findOrder(email, orderId)) || order;
        }
      } catch (error) {
        console.error('[pedido/status] reconciliação falhou:', error);
      }
    }

    if (order.payment_id && (!order.payment_method || !order.paid_at)) {
      const billing = await fetchPaymentBilling(String(order.payment_id)).catch(() => null);
      if (billing) {
        order = {
          ...order,
          payment_method: order.payment_method || billing.paymentMethod,
          payment_type: order.payment_type || billing.paymentType,
          payment_installments: order.payment_installments ?? billing.installments,
          payment_amount: order.payment_amount ?? billing.paymentAmount,
          paid_at: order.paid_at || billing.paidAt,
        };
      }
    }

    const [items, history] = await Promise.all([
      readOrderItems(orderId).catch(() => []),
      readOrderHistory(orderId).catch(() => []),
    ]);

    return NextResponse.json(
      {
        order: {
          ...order,
          status: String(order.status || 'pending').toLowerCase(),
          payment_status: String(order.payment_status || 'pending').toLowerCase(),
        },
        items,
        history,
        payment: order.payment_id
          ? {
              id: String(order.payment_id),
              status: String(order.payment_status || 'pending').toLowerCase(),
              statusDetail: order.payment_status_detail || null,
              method: order.payment_method || null,
              type: order.payment_type || null,
              installments: order.payment_installments ?? null,
              amount: order.payment_amount ?? null,
              paidAt: order.paid_at || null,
            }
          : null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error('[pedido/status] erro:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
  }
}
