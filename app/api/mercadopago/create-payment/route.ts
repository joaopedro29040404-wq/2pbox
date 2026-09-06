import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no servidor. Verifique o Access Token na Vercel.' }, { status: 500 });

  try {
    const body = await request.json();
    const { formData, orderId, total } = body;
    const amount = Number(total);
    if (!formData || !orderId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Dados inválidos para criar o pagamento.' }, { status: 400 });

    const paymentMethodId = String(formData.payment_method_id || '').trim();
    const payerEmail = String(formData.payer?.email || formData.cardholderEmail || '').trim();
    if (!payerEmail) return NextResponse.json({ error: 'Informe um e-mail válido para o pagamento.' }, { status: 400 });

    const identification = formData.payer?.identification || (
      formData.identificationType && formData.identificationNumber
        ? { type: formData.identificationType, number: String(formData.identificationNumber).replace(/\D/g, '') }
        : undefined
    );
    // O Payment Brick entrega o nome do titular no additionalData; o frontend
    // normaliza para cardholderName/card_holder_name antes de chegar aqui.
    const cardholderName = String(formData.cardholderName || formData.card_holder_name || '').trim();
    const nameParts = cardholderName ? cardholderName.split(/\s+/).filter(Boolean) : [];

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://2pbox.vercel.app';
    const paymentBody = {
      transaction_amount: amount,
      token: formData.token || undefined,
      description: `Pedido 2P Box ${orderId}`,
      installments: Number(formData.installments || 1),
      payment_method_id: paymentMethodId,
      issuer_id: formData.issuer_id ? Number(formData.issuer_id) : undefined,
      payer: {
        email: payerEmail,
        identification,
        first_name: formData.payer?.first_name || nameParts[0] || undefined,
        last_name: formData.payer?.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined),
      },
      external_reference: String(orderId),
      notification_url: `${origin}/api/mercadopago/webhook`,
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(paymentBody),
      cache: 'no-store',
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Mercado Pago Payment Brick error:', result);
      if (result?.id && result?.status) {
        try { await syncOrderPayment(String(orderId), result); } catch (syncError) { console.error('Rejected payment sync error:', syncError); }
      }
      return NextResponse.json({ id: result?.id || null, status: result?.status || 'rejected', statusDetail: result?.status_detail || result?.message || null, paymentMethodId: result?.payment_method_id || paymentMethodId || null, error: result?.message || 'O Mercado Pago recusou o pagamento.' }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    try { await syncOrderPayment(String(orderId), result); } catch (syncError) { console.error('Order payment sync error:', syncError); }
    const transactionData = result?.point_of_interaction?.transaction_data || {};
    const isPix = paymentMethodId === 'pix' || result?.payment_method_id === 'pix';

    return NextResponse.json({
      id: result.id,
      status: result.status,
      statusDetail: result.status_detail,
      paymentMethodId: result.payment_method_id,
      pix: isPix ? { qrCode: transactionData.qr_code || null, qrCodeBase64: transactionData.qr_code_base64 || null, ticketUrl: transactionData.ticket_url || null } : null,
    });
  } catch (error) {
    console.error('Mercado Pago Payment Brick error:', error);
    return NextResponse.json({ error: 'Não foi possível processar o pagamento.' }, { status: 502 });
  }
}
