import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no servidor.' }, { status: 500 });

  try {
    const body = await request.json();
    const { formData, orderId, total } = body;
    const amount = Number(total);

    if (!formData || !orderId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Dados inválidos para criar o pagamento.' }, { status: 400 });
    }

    const paymentBody = {
      transaction_amount: amount,
      token: formData.token,
      description: `Pedido 2P Box ${orderId}`,
      installments: Number(formData.installments || 1),
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id ? Number(formData.issuer_id) : undefined,
      payer: {
        email: formData.payer?.email || formData.cardholderEmail,
        identification: formData.payer?.identification || (formData.identificationType && formData.identificationNumber ? { type: formData.identificationType, number: formData.identificationNumber } : undefined),
        first_name: formData.payer?.first_name || formData.cardholderName,
      },
      external_reference: String(orderId),
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(paymentBody),
      cache: 'no-store',
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Mercado Pago Payment Brick error:', result);
      return NextResponse.json({ error: result.message || 'O Mercado Pago recusou o pagamento.' }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    return NextResponse.json({ id: result.id, status: result.status, statusDetail: result.status_detail });
  } catch (error) {
    console.error('Mercado Pago Payment Brick error:', error);
    return NextResponse.json({ error: 'Não foi possível processar o pagamento.' }, { status: 502 });
  }
}
