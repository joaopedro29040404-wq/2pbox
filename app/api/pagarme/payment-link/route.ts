import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = process.env.PAGARME_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: 'Pagar.me ainda não configurado.' }, { status: 503 });
  const baseUrl = process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5';
  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    const payload = {
      type: 'order',
      name: `2P Box - Pedido ${String(body.orderId || '').slice(0, 32)}`,
      order_code: String(body.orderId || '').slice(0, 52),
      payment_settings: { accepted_payment_methods: ['credit_card', 'pix', 'boleto'] },
      customer_settings: { enabled: true },
      cart_settings: {
        items: items.map((item: {name:string;price:number;quantity:number}) => ({
          name: item.name,
          description: item.name,
          amount: Math.round(Number(item.price) * 100),
          default_quantity: Math.max(1, Number(item.quantity) || 1),
        })),
      },
    };
    const auth = Buffer.from(`${secret}:`).toString('base64');
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/paymentlinks`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': '2pbox/1.0',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || 'Pagar.me recusou a criação do checkout.', details: data }, { status: response.status });
    return NextResponse.json({ id: data.id, url: data.url, status: data.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao conectar ao Pagar.me.' }, { status: 500 });
  }
}
