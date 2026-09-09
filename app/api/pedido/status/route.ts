import { NextResponse } from 'next/server';
import { getAdminSupabase, getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const terminalPayment = new Set(['approved','rejected','cancelled']);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedOrderId = String(url.searchParams.get('orderId') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 });

    const admin = getAdminSupabase();
    if (!admin) return NextResponse.json({ error: 'Servidor não configurado.' }, { status: 500 });

    let orderQuery = admin.from('orders').select('id,customer_email,payment_id,status,payment_status,payment_status_detail').ilike('customer_email', email);
    if (requestedOrderId) orderQuery = orderQuery.eq('id', requestedOrderId);
    else orderQuery = orderQuery.order('created_at', { ascending: false }).limit(1);
    const { data: currentOrder, error: currentOrderError } = await orderQuery.maybeSingle();
    if (currentOrderError) return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
    if (!currentOrder) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    const orderId = String(currentOrder.id);
    const localStatus = String(currentOrder.status || '').toLowerCase();
    const localPaymentStatus = String(currentOrder.payment_status || '').toLowerCase();

    // Neste sistema, confirmed só é alcançado quando o pagamento foi confirmado.
    // Portanto, se a tabela já diz confirmed, nunca devolvemos pending para a UI.
    if (localStatus === 'confirmed' || localPaymentStatus === 'approved') {
      const { data: confirmedOrder, error } = await admin.from('orders')
        .select('id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,status,payment_status,total,created_at,payment_id,payment_status_detail,payment_updated_at')
        .eq('id', orderId).ilike('customer_email', email).maybeSingle();
      if (error || !confirmedOrder) return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
      const { data: items } = await admin.from('order_items').select('product_id,product_name,quantity,unit_price').eq('order_id', orderId).order('product_name');
      return NextResponse.json({
        order: { ...confirmedOrder, status: localStatus === 'confirmed' ? 'confirmed' : confirmedOrder.status, payment_status: 'approved' },
        items: items || [],
        payment: confirmedOrder.payment_id ? { id: String(confirmedOrder.payment_id), status: 'approved', statusDetail: confirmedOrder.payment_status_detail || 'accredited' } : null,
      }, { headers: { 'Cache-Control': 'no-store, max-age=0, s-maxage=0' } });
    }

    const accessToken = getMercadoPagoAccessToken();
    let latestPayment: any = null;
    if (accessToken) {
      try {
        const paymentId = String(currentOrder.payment_id || '').trim();
        if (paymentId) {
          const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
          if (response.ok) latestPayment = await response.json();
        }
        if (!latestPayment) {
          const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=10`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
          if (response.ok) {
            const result = await response.json();
            const payments = Array.isArray(result?.results) ? result.results : [];
            payments.sort((a:any,b:any) => {
              const rank=(s:any)=>({approved:100,authorized:80,in_process:60,pending:40,rejected:20,cancelled:10}[String(s||'').toLowerCase()]||0);
              return rank(b?.status)-rank(a?.status) || new Date(String(b?.date_last_updated||b?.date_created||0)).getTime()-new Date(String(a?.date_last_updated||a?.date_created||0)).getTime();
            });
            latestPayment = payments[0] || null;
          }
        }
        if (latestPayment) {
          try { await syncOrderPayment(orderId, latestPayment); } catch (error) { console.error('Public payment reconciliation error:', error); }
        }
      } catch (error) { console.error('Public payment lookup error:', error); }
    }

    const { data, error } = await admin.from('orders')
      .select('id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,status,payment_status,total,created_at,payment_id,payment_status_detail,payment_updated_at')
      .eq('id', orderId).ilike('customer_email', email).maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: error ? 500 : 404 });

    const canonicalPaymentStatus = String(data.payment_status || 'pending').toLowerCase();
    const canonicalOrderStatus = String(data.status || 'pending').toLowerCase();
    const paymentPayload = latestPayment ? { id: String(latestPayment.id || data.payment_id || ''), status: String(latestPayment.status || canonicalPaymentStatus).toLowerCase(), statusDetail: latestPayment.status_detail || data.payment_status_detail || null } : data.payment_id ? { id: String(data.payment_id), status: canonicalPaymentStatus, statusDetail: data.payment_status_detail || null } : null;

    const { data: items, error: itemsError } = await admin.from('order_items').select('product_id,product_name,quantity,unit_price').eq('order_id', orderId).order('product_name');
    if (itemsError) return NextResponse.json({ error: 'Não foi possível carregar os itens do pedido.' }, { status: 500 });

    return NextResponse.json({ order: { ...data, payment_status: canonicalPaymentStatus, status: canonicalOrderStatus }, items: items || [], payment: paymentPayload }, { headers: { 'Cache-Control': 'no-store, max-age=0, s-maxage=0' } });
  } catch (error) {
    console.error('Public order status route error:', error);
    return NextResponse.json({ error: 'Não foi possível consultar o pedido.' }, { status: 500 });
  }
}
