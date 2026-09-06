import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no servidor.' }, { status: 500 });

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const total = Number(body.total);
    const orderId = String(body.orderId || '');
    const email = String(body.email || '');

    if (!items.length || !orderId || !Number.isFinite(total) || total <= 0 || !email) {
      return NextResponse.json({ error: 'Dados inválidos para iniciar o pagamento.' }, { status: 400 });
    }

    const preference = {
      items: items.map((item: { id?: string; name: string; price: number; quantity: number }) => ({
        id: item.id,
        title: String(item.name).slice(0, 250),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Number(item.price),
        currency_id: 'BRL',
      })),
      external_reference: orderId,
      payer: { email },
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
      return NextResponse.json({ error: 'O Mercado Pago recusou a criação da preferência.' }, { status: 502 });
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
    const brickUrl = `${origin}/checkout/pagamento?orderId=${encodeURIComponent(orderId)}&total=${encodeURIComponent(total)}&email=${encodeURIComponent(email)}&preferenceId=${encodeURIComponent(result.id)}`;

    return NextResponse.json({ id: result.id, brickUrl });
  } catch (error) {
    console.error('Mercado Pago API error:', error);
    return NextResponse.json({ error: 'Não foi possível iniciar o pagamento.' }, { status: 500 });
  }
}
