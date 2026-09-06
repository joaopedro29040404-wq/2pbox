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

    // Reconciliação imediata: o webhook é a fonte oficial, mas a própria tela
    // também consegue buscar o estado atual durante os testes ou se houver atraso.
    const accessToken = getMercadoPagoAccessToken();
    if (accessToken && currentOrder.payment_id) {
      try {
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(currentOrder.payment_id))}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (paymentResponse.ok) {
          const payment = await paymentResponse.json();
          await syncOrderPayment(orderId, payment);
        }
      } catch (syncError) {
        console.error('Public order Mercado Pago reconciliation error:', syncError);
      }
    }

    const { data, error } = await admin
      .from('orders')
      .select('id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,status,payment_status,payment_status_detail,payment_updated_at,total,created_at,updated_at,payment_id')
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
