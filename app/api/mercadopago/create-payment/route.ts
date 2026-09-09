import { NextResponse } from 'next/server';
import { getMercadoPagoAccessToken, syncOrderPayment } from '@/lib/mercadopago-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeCause(cause: unknown) {
  if (!Array.isArray(cause)) return cause ?? null;
  return cause.map((item: any) => ({ code: item?.code ?? null, description: item?.description ?? null, data: item?.data ?? null }));
}

export async function POST(request: Request) {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no servidor. Verifique o Access Token na Vercel.' }, { status: 500 });

  try {
    const body = await request.json();
    const { formData, orderId, total, deviceId, additionalData } = body;
    const amount = Number(total);
    if (!formData || !orderId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Dados inválidos para criar o pagamento.' }, { status: 400 });

    const paymentMethodId = String(formData.payment_method_id || '').trim();
    const token = String(formData.token || '').trim();
    if (!paymentMethodId) return NextResponse.json({ error: 'Método de pagamento não identificado.' }, { status: 400 });
    if (!token) return NextResponse.json({ error: 'Token do cartão não foi gerado pelo Card Payment Brick.' }, { status: 400 });

    const rawPayerEmail = String(formData.payer?.email || formData.email || formData.cardholderEmail || '').trim().toLowerCase();
    const isLegacyTestToken = /^TEST-/i.test(accessToken);
    const payerEmail = isLegacyTestToken && /@testuser\.com$/i.test(rawPayerEmail) ? 'test_payer@example.com' : rawPayerEmail;
    if (!payerEmail) return NextResponse.json({ error: 'Informe um e-mail válido para o pagamento.' }, { status: 400 });

    const identificationType = String(formData.cardholderIdentificationType || formData.identificationType || formData.payer?.identification?.type || '').trim();
    const identificationNumber = String(formData.cardholderIdentificationNumber || formData.identificationNumber || formData.payer?.identification?.number || '').replace(/\D/g, '');
    const identification = identificationType && identificationNumber ? { type: identificationType, number: identificationNumber } : undefined;
    const receivedIssuerId = formData.issuer_id != null && Number.isFinite(Number(formData.issuer_id)) && Number(formData.issuer_id) > 0 ? Number(formData.issuer_id) : undefined;
    const issuerId = isLegacyTestToken ? undefined : receivedIssuerId;
    const installments = Number(formData.installments || 1);
    const cardholderName = String(formData.cardholderName || formData.card_holder_name || additionalData?.cardholderName || '').trim();
    const nameParts = cardholderName ? cardholderName.split(/\s+/).filter(Boolean) : [];
    const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://2pbox.vercel.app').replace(/\/$/, '');
    const idempotencyKey = crypto.randomUUID();
    const normalizedDeviceId = String(deviceId || '').trim();

    const commonHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    };
    if (normalizedDeviceId) commonHeaders['X-meli-session-id'] = normalizedDeviceId;

    if (isLegacyTestToken) {
      const paymentBody = {
        transaction_amount: amount,
        token,
        description: `Pedido 2P Box ${String(orderId).slice(0, 50)}`,
        installments,
        payment_method_id: paymentMethodId,
        external_reference: String(orderId).slice(0, 64),
        notification_url: `${siteUrl}/api/mercadopago/webhook`,
        payer: { email: payerEmail, ...(identification ? { identification } : {}) },
      };
      const response = await fetch('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: commonHeaders, body: JSON.stringify(paymentBody), cache: 'no-store' });
      const result = await response.json().catch(() => null);
      const mpRequestId = response.headers.get('x-request-id') || response.headers.get('x-correlation-id') || null;
      if (!response.ok) {
        const cause = Array.isArray(result?.cause) ? result.cause[0] : null;
        const detail = result?.status_detail || cause?.code || cause?.description || result?.message || `HTTP ${response.status}`;
        return NextResponse.json({ id: result?.id || null, status: result?.status || 'rejected', statusDetail: detail, paymentMethodId, error: detail, details: result, mpRequestId }, { status: response.status });
      }
      const normalizedResult = { ...result, id: result?.id ? String(result.id) : null, status: result?.status || 'pending', status_detail: result?.status_detail || null, payment_method_id: result?.payment_method_id || paymentMethodId, external_reference: String(result?.external_reference || orderId) };
      let synced;
      try {
        synced = await syncOrderPayment(String(orderId), normalizedResult);
      } catch (syncError) {
        console.error('Legacy payment persistence error:', syncError);
        return NextResponse.json({ id: normalizedResult.id, status: 'pending', statusDetail: 'Pagamento recebido. Estamos confirmando o pedido.', paymentMethodId: normalizedResult.payment_method_id, synchronizationPending: true, error: 'Pagamento recebido, mas a confirmação do pedido ainda está sendo sincronizada.' }, { status: 202 });
      }
      return NextResponse.json({ id: normalizedResult.id, orderId: null, status: synced.paymentStatus, statusDetail: synced.statusDetail, paymentStatus: synced.paymentStatus, orderStatus: synced.orderStatus, paymentMethodId: normalizedResult.payment_method_id, legacyPaymentsApi: true, pix: null });
    }

    const orderBody = {
      type: 'online', processing_mode: 'automatic', total_amount: amount.toFixed(2), external_reference: String(orderId).slice(0, 64), notification_url: `${siteUrl}/api/mercadopago/webhook`,
      payer: { email: payerEmail, ...(identification ? { identification } : {}), ...(formData.payer?.first_name || nameParts[0] ? { first_name: formData.payer?.first_name || nameParts[0] } : {}), ...(formData.payer?.last_name || nameParts.length > 1 ? { last_name: formData.payer?.last_name || nameParts.slice(1).join(' ') } : {}) },
      transactions: { payments: [{ amount: amount.toFixed(2), payment_method: { id: paymentMethodId, type: String(additionalData?.paymentTypeId || formData.payment_type_id || 'credit_card'), token, installments } }] },
    };
    const response = await fetch('https://api.mercadopago.com/v1/orders', { method: 'POST', headers: commonHeaders, body: JSON.stringify(orderBody), cache: 'no-store' });
    const result = await response.json().catch(() => null);
    const diagnostics = {
      mercadoPagoOrderId: result?.id || null,
      mercadoPagoPaymentId: result?.transactions?.payments?.[0]?.id || result?.transactions?.payments?.[0]?.reference_id || null,
      orderStatus: result?.status || null,
      orderStatusDetail: result?.status_detail || null,
      paymentStatus: result?.transactions?.payments?.[0]?.status || null,
      paymentStatusDetail: result?.transactions?.payments?.[0]?.status_detail || null,
      cause: safeCause(result?.cause),
      message: result?.message || null,
      mpRequestId: response.headers.get('x-request-id') || response.headers.get('x-correlation-id') || null,
    };
    if (!response.ok) {
      const cause = Array.isArray(result?.cause) ? result.cause[0] : null;
      const detail = result?.status_detail || cause?.code || cause?.description || result?.message || `HTTP ${response.status}`;
      return NextResponse.json({ id: null, ...diagnostics, status: 'rejected', statusDetail: detail, paymentMethodId, error: detail, details: result }, { status: response.status });
    }

    const payment = result?.transactions?.payments?.[0];
    const mercadoPagoOrderId = result?.id ? String(result.id) : null;
    const mercadoPagoPaymentId = payment?.id ? String(payment.id) : payment?.reference_id ? String(payment.reference_id) : null;
    const paymentStatus = String(payment?.status || '').toLowerCase() || null;
    const paymentStatusDetail = payment?.status_detail || null;
    const orderStatus = String(result?.status || '').toLowerCase() || null;
    const orderStatusDetail = result?.status_detail || null;
    const effectiveStatus = ['processed', 'approved', 'accredited', 'failed', 'rejected', 'canceled', 'cancelled', 'refunded', 'charged_back'].includes(orderStatus || '') ? orderStatus : paymentStatus || orderStatus || 'pending';
    const statusDetail = paymentStatusDetail || orderStatusDetail || null;
    const normalizedResult = { ...result, id: mercadoPagoPaymentId || mercadoPagoOrderId, status: effectiveStatus, status_detail: statusDetail, payment_method_id: payment?.payment_method?.id || paymentMethodId, order_id: mercadoPagoOrderId, order_status: orderStatus, order_status_detail: orderStatusDetail, external_reference: String(result?.external_reference || orderId) };

    let synced;
    try {
      synced = await syncOrderPayment(String(orderId), normalizedResult);
    } catch (syncError) {
      console.error('Order payment persistence error:', syncError);
      return NextResponse.json({ id: mercadoPagoPaymentId || mercadoPagoOrderId, orderId: mercadoPagoOrderId, ...diagnostics, status: 'pending', statusDetail: 'Pagamento recebido. Estamos confirmando o pedido.', paymentStatus: 'pending', orderStatus: 'pending', paymentMethodId: payment?.payment_method?.id || paymentMethodId, synchronizationPending: true, error: 'Pagamento recebido, mas a confirmação do pedido ainda está sendo sincronizada.', pix: null }, { status: 202 });
    }

    const transactionData = payment?.point_of_interaction?.transaction_data || result?.point_of_interaction?.transaction_data || {};
    const isPix = paymentMethodId === 'pix';
    return NextResponse.json({ id: mercadoPagoPaymentId || mercadoPagoOrderId, orderId: mercadoPagoOrderId, ...diagnostics, status: synced.paymentStatus, statusDetail: synced.statusDetail, paymentStatus: synced.paymentStatus, orderStatus: synced.orderStatus, paymentMethodId: payment?.payment_method?.id || paymentMethodId, pix: isPix ? { qrCode: transactionData.qr_code || null, qrCodeBase64: transactionData.qr_code_base64 || null, ticketUrl: transactionData.ticket_url || null } : null });
  } catch (error) {
    console.error('Mercado Pago payment creation error:', error);
    return NextResponse.json({ error: 'Não foi possível processar o pagamento.', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
