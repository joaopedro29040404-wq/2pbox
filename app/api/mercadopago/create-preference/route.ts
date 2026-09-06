import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, getAdminSupabase } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
}

export async function POST(request: Request) {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no servidor.' }, { status: 500 });

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const total = Number(body.total);
    const orderId = String(body.orderId || '');
    const email = String(body.email || '').trim().toLowerCase();
    if (!items.length || !orderId || !Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: 'Dados inválidos para iniciar o pagamento.' }, { status: 400 });
    }

    // A preferência é criada depois do pedido. Recuperamos os dados já
    // registrados no pedido para que o Payment Brick receba o comprador
    // completo desde a primeira renderização, evitando autofill do navegador
    // aparecer visualmente sem fazer parte do estado interno do Brick.
    let payer: Record<string, unknown> = email ? { email } : {};
    try {
      const admin = getAdminSupabase();
      if (admin) {
        const { data: order } = await admin
          .from('orders')
          .select('customer_name,customer_email')
          .eq('id', orderId)
          .maybeSingle();
        const customerName = String(order?.customer_name || '').trim();
        const customerEmail = String(order?.customer_email || email).trim().toLowerCase();
        const { firstName, lastName } = splitName(customerName);
        payer = {
          ...(customerEmail ? { email: customerEmail } : {}),
          ...(firstName ? { name: firstName } : {}),
          ...(lastName ? { surname: lastName } : {}),
        };
      }
    } catch (error) {
      console.warn('Não foi possível carregar os dados do comprador para a preferência:', error);
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://2pbox.vercel.app';
    const guestParam = email ? `&email=${encodeURIComponent(email)}` : '';
    const webhookUrl = `${origin}/api/mercadopago/webhook`;
    const preference = {
      items: items.map((item: { id?: string; name: string; price: number; quantity: number }) => ({
        id: item.id,
        title: String(item.name).slice(0, 250),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Number(item.price),
        currency_id: 'BRL',
      })),
      external_reference: orderId,
      ...(Object.keys(payer).length ? { payer } : {}),
      notification_url: webhookUrl,
      back_urls: {
        success: `${origin}/pagamento/${encodeURIComponent(orderId)}?payment=approved${guestParam}`,
        pending: `${origin}/pagamento/${encodeURIComponent(orderId)}?payment=pending${guestParam}`,
        failure: `${origin}/pagamento/${encodeURIComponent(orderId)}?payment=failure${guestParam}`,
      },
      auto_return: 'approved',
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference),
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) {
      console.error('Mercado Pago preference error:', result);
      return NextResponse.json({ error: result?.message || 'O Mercado Pago recusou a criação da preferência.' }, { status: 502 });
    }
    return NextResponse.json({ id: result.id });
  } catch (error) {
    console.error('Mercado Pago API error:', error);
    return NextResponse.json({ error: 'Não foi possível iniciar o pagamento.' }, { status: 500 });
  }
}