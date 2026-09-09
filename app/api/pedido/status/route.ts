import { NextResponse } from 'next/server';
import { getAdminSupabase, getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrderId = String(url.searchParams.get('orderId') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 });
    }

    const admin = getAdminSupabase();
    if (!admin) return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });

    // O acompanhamento público é feito pelo e-mail usado na compra.
    // Se um ID vier da página interna de pedido, ele continua sendo validado junto ao e-mail.
    let orderQuery = admin
      .from('orders')
      .select('id,customer_email,payment_id')
      .ilike('customer_email', email);

    if (requestedOrderId) {
      orderQuery = orderQuery.eq('id', requestedOrderId);
    } else {
      orderQuery = orderQuery.order('created_at', { ascending: false }).limit(1);
    }

    const { data: currentOrder, error: currentOrderError } = await orderQuery.maybeSingle();

    if (currentOrderError) {
      console.error('Public order lookup error:', currentOrderError);
      return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
    }
    if (!currentOrder) return NextResponse.json({ error: 'Nenhum pedido encontrado para este e-mail.' }, { status: 404 });

    const orderId = String(currentOrder.id);
    const accessToken = getMercadoPagoAccessToken();
    let latestPayment: any = null;

    if (accessToken) {
      try {
        let paymentId = String(currentOrder.payment_id || '').trim();

        if (paymentId) {
          const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          });
          if (paymentResponse.ok) latestPayment = await paymentResponse.json();
        }

        if (!latestPayment) {
          const searchResponse = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=10`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          });
          if (searchResponse.ok) {
            const searchResult = await searchResponse.json();
            latestPayment = searchResult?.results?.[0] || null;
          }
        }

        if (latestPayment) {
          try {
            await syncOrderPayment(orderId, latestPayment);
          } catch (syncError) {
            console.error('Public order Mercado Pago reconciliation error:', syncError);
          }
        }
      } catch (syncError) {
        console.error('Public order Mercado Pago lookup error:', syncError);
      }
    }

    const { data, error } = await admin
      .from('orders')
      .select('id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,status,payment_status,total,created_at,payment_id')
      .eq('id', orderId)
      .ilike('customer_email', email)
      .maybeSingle();

    if (error) {
      console.error('Public order status error:', error);
      return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    const mpStatus = String(latestPayment?.status || '').toLowerCase();
    const validPaymentStatuses = new Set(['pending', 'in_process', 'authorized', 'approved', 'rejected', 'cancelled']);
    const responseOrder = { ...data } as any;
    if (validPaymentStatuses.has(mpStatus)) {
      responseOrder.payment_status = mpStatus;
      responseOrder.payment_id = String(latestPayment?.id || responseOrder.payment_id || '');
      if (mpStatus === 'approved') responseOrder.status = 'confirmed';
      else if (['rejected', 'cancelled'].includes(mpStatus)) responseOrder.status = 'cancelled';
    }

    const { data: items, error: itemsError } = await admin
      .from('order_items')
      .select('product_id,product_name,quantity,unit_price')
      .eq('order_id', orderId)
      .order('product_name');

    if (itemsError) {
      console.error('Public order items error:', itemsError);
      return NextResponse.json({ error: 'Não foi possível carregar os itens do pedido.' }, { status: 500 });
    }

    return NextResponse.json(
      { order: responseOrder, items: items || [], payment: latestPayment ? { id: String(latestPayment.id || ''), status: mpStatus, statusDetail: latestPayment.status_detail || null } : null },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('Public order status route error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
  }
}