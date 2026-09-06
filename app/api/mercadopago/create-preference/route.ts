import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAccessToken() {
  // Mantém o nome oficial usado pela aplicação e aceita os nomes alternativos
  // mais comuns para evitar falha quando a variável foi cadastrada com underscore.
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    ''
  ).trim();
}

export async function POST(request: Request) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Mercado Pago não configurado no servidor. Verifique a variável de Access Token no ambiente Production da Vercel e faça um novo deploy.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const total = Number(body.total);
    const orderId = String(body.orderId || '');
    const email = String(body.email || '');

    if (!items.length || !orderId || !Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: 'Dados inválidos para iniciar o pagamento.' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://2pbox.vercel.app';
    const preference = {
      items: items.map((item: { id?: string; name: string; price: number; quantity: number }) => ({
        id: item.id,
        title: String(item.name).slice(0, 250),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Number(item.price),
        currency_id: 'BRL',
      })),
      external_reference: orderId,
      ...(email ? { payer: { email } } : {}),
      back_urls: {
        success: `${origin}/pedido/${encodeURIComponent(orderId)}?payment=approved`,
        pending: `${origin}/pedido/${encodeURIComponent(orderId)}?payment=pending`,
        failure: `${origin}/pedido/${encodeURIComponent(orderId)}?payment=failure`,
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
