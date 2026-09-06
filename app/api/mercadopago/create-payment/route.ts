import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from '@mercadopago/sdk-node';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no servidor.' }, { status: 500 });

  try {
    const body = await request.json();
    const { formData, orderId, total } = body;
    if (!formData || !orderId || !Number.isFinite(Number(total)) || Number(total) <= 0) {
      return NextResponse.json({ error: 'Dados inválidos para criar o pagamento.' }, { status: 400 });
    }

    const mp = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(mp);
    const idempotencyKey = crypto.randomUUID();
    const result = await payment.create({
      body: {
        transaction_amount: Number(total),
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
        external_reference: orderId,
      },
      requestOptions: { idempotencyKey },
    });

    return NextResponse.json({ id: result.id, status: result.status, statusDetail: result.status_detail });
  } catch (error) {
    console.error('Mercado Pago Payment Brick error:', error);
    return NextResponse.json({ error: 'Não foi possível processar o pagamento.' }, { status: 502 });
  }
}
