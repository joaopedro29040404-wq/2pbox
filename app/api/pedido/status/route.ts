import { NextResponse } from 'next/server';
import { getAdminSupabase, getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = String(url.searchParams.get('orderId') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();

    if (!orderId || !email) return NextResponse.json({ error: 'Pedido e e-mail são obrigatórios.' }, { status: 400 });

    const admin = getAdminSupabase();
    if (!admin) return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });

    const { data: currentOrder, error: currentOrderError } = await admin
      .from('orders')
      .select('id,customer_email,payment_id')
      .eq('id', orderId)
      .ilike('customer_email', email)
      .maybeSingle();

    if (currentOrderError) {
      console.error('Public order lookup error:', currentOrderError);
      return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
    }
    if (!currentOrder) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    // O webhook é a fonte oficial, mas a página de acompanhamento precisa
    // conseguir reconciliar o pagamento mesmo se o webhook ainda estiver a
    // caminho ou se o payment_id ainda não tiver sido gravado no pedido.
    const accessToken = getMercadoPagoAccessToken();
    if (accessToken) {
      try {
        let paymentId = String(currentOrder.payment_id || '').trim();
        let payment: any = null;

        if (paymentId) {
          const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          });
          if (paymentResponse.ok) payment = await paymentResponse.json();
        }

        // Fallback importante: localizar o pagamento pela external_reference
        // (orderId). Isso cobre o intervalo entre a criação do pagamento e a
        // persistência do payment_id, além de webhook atrasado.
        if (!payment) {
          const searchResponse = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=10`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          });
          if (searchResponse.ok) {
            const searchResult = await searchResponse.json();
            payment = searchResult?.results?.[0] || null;
          }
        }

        if (payment) await syncOrderPayment(orderId, payment);
      } catch (syncError) {
        console.error('Public order Mercado Pago reconciliation error:', syncError);
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
      { order: data, items: items || [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('Public order status route error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
  }
}
