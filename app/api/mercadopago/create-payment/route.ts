import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no servidor. Verifique o Access Token na Vercel.' }, { status: 500 });

  try {
    const body = await request.json();
    const { formData, orderId, total, deviceId, additionalData } = body;
    const amount = Number(total);
    if (!formData || !orderId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Dados inválidos para criar o pagamento.' }, { status: 400 });

    const paymentMethodId = String(formData.payment_method_id || '').trim();
    if (!paymentMethodId) return NextResponse.json({ error: 'Método de pagamento não identificado.' }, { status: 400 });
    if (!formData.token) return NextResponse.json({ error: 'Token do cartão não foi gerado pelo Payment Brick.' }, { status: 400 });

    const payerEmail = String(formData.payer?.email || formData.email || formData.cardholderEmail || '').trim().toLowerCase();
    if (!payerEmail) return NextResponse.json({ error: 'Informe um e-mail válido para o pagamento.' }, { status: 400 });

    const identificationType = String(formData.cardholderIdentificationType || formData.identificationType || formData.payer?.identification?.type || '').trim();
    const identificationNumber = String(formData.cardholderIdentificationNumber || formData.identificationNumber || formData.payer?.identification?.number || '').replace(/\D/g, '');
    const identification = identificationType && identificationNumber ? { type: identificationType, number: identificationNumber } : undefined;

    const cardholderName = String(formData.cardholderName || formData.card_holder_name || '').trim();
    const nameParts = cardholderName ? cardholderName.split(/\s+/).filter(Boolean) : [];
    const paymentTypeId = String(additionalData?.paymentTypeId || formData.payment_type_id || '').trim();
    const paymentMethodType = paymentTypeId === 'debit_card' ? 'debit_card' : 'credit_card';
    const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://2pbox.vercel.app').replace(/\/$/, '');

    const orderBody = {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: amount.toFixed(2),
      external_reference: String(orderId).slice(0, 64),
      notification_url: `${siteUrl}/api/mercadopago/webhook`,
      payer: {
        email: payerEmail,
        ...(identification ? { identification } : {}),
        ...(formData.payer?.first_name || nameParts[0] ? { first_name: formData.payer?.first_name || nameParts[0] } : {}),
        ...(formData.payer?.last_name || nameParts.length > 1 ? { last_name: formData.payer?.last_name || nameParts.slice(1).join(' ') } : {}),
      },
      transactions: {
        payments: [{
          amount: amount.toFixed(2),
          payment_method: {
            id: paymentMethodId,
            type: paymentMethodType,
            token: String(formData.token),
            installments: Number(formData.installments || 1),
          },
        }],
      },
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    };
    const normalizedDeviceId = String(deviceId || '').trim();
    if (normalizedDeviceId) headers['X-meli-session-id'] = normalizedDeviceId;

    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(orderBody),
      cache: 'no-store',
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Mercado Pago Orders API error:', { status: response.status, result, orderId });
      const cause = Array.isArray(result?.cause) ? result.cause[0] : null;
      return NextResponse.json({
        id: null,
        status: 'rejected',
        statusDetail: result?.status_detail || cause?.code || cause?.description || result?.message || null,
        paymentMethodId,
        error: result?.status_detail || cause?.description || result?.message || 'O Mercado Pago recusou a order.',
        details: result,
      }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    const payment = result?.transactions?.payments?.[0];
    const paymentId = payment?.id ? String(payment.id) : payment?.reference_id ? String(payment.reference_id) : null;
    const status = payment?.status || result?.status || 'pending';
    const statusDetail = payment?.status_detail || result?.status_detail || null;
    const normalizedResult = {
      ...result,
      id: paymentId || result?.id,
      status,
      status_detail: statusDetail,
      payment_method_id: payment?.payment_method?.id || paymentMethodId,
      order_id: result?.id || null,
    };

    try { await syncOrderPayment(String(orderId), normalizedResult); } catch (syncError) { console.error('Order payment sync error:', syncError); }

    const transactionData = payment?.point_of_interaction?.transaction_data || result?.point_of_interaction?.transaction_data || {};
    const isPix = paymentMethodId === 'pix';

    return NextResponse.json({
      id: paymentId || result?.id,
      orderId: result?.id || null,
      status,
      statusDetail,
      orderStatus: result?.status || null,
      orderStatusDetail: result?.status_detail || null,
      paymentMethodId: payment?.payment_method?.id || paymentMethodId,
      pix: isPix ? {
        qrCode: transactionData.qr_code || null,
        qrCodeBase64: transactionData.qr_code_base64 || null,
        ticketUrl: transactionData.ticket_url || null,
      } : null,
    });
  } catch (error) {
    console.error('Mercado Pago Orders API error:', error);
    return NextResponse.json({ error: 'Não foi possível processar o pagamento.' }, { status: 502 });
  }
}
