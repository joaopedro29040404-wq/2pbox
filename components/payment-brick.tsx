'use client';

import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import { useEffect, useRef, useState } from 'react';
import { InlineLoader } from '@/components/ui/loader';

type PaymentResult = { id?: string | number; status?: string; statusDetail?: string; paymentMethodId?: string; mercadoPagoOrderId?: string | null; mercadoPagoPaymentId?: string | null; orderStatus?: string | null; orderStatusDetail?: string | null; paymentStatus?: string | null; paymentStatusDetail?: string | null; message?: string | null; cause?: unknown; httpStatus?: number | null };
type Props = { amount: number; orderId: string; email: string; cpf?: string; publicKey: string; onResult: (result: PaymentResult) => void; onError: (message: string) => void };
declare global { interface Window { MP_DEVICE_SESSION_ID?: string } }

let initialized = '';

export default function PaymentBrick({ amount, orderId, email, cpf, publicKey, onResult, onError }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  useEffect(() => {
    const key = String(publicKey || '').trim();
    if (!key) {
      errorHandler.current('A chave pública do Mercado Pago ainda não foi configurada nesta loja.');
      setReady(false);
      return;
    }
    if (initialized !== key) {
      initMercadoPago(key, { locale: 'pt-BR' });
      initialized = key;
    }
    setReady(true);
  }, [publicKey]);

  const payerEmail = email.trim().toLowerCase();
  const payerCpf = (cpf || '').replace(/\D/g, '');
  const payer = {
    ...(payerEmail ? { email: payerEmail } : {}),
    ...(payerCpf.length === 11 ? { identification: { type: 'CPF', number: payerCpf } } : {}),
  };
  const hasPayer = Object.keys(payer).length > 0;

  const redirectToResult = (paymentResult: PaymentResult) => {
    const query = new URLSearchParams({ payment: paymentResult.status || 'pending', statusDetail: paymentResult.statusDetail || 'Não informado pelo Mercado Pago' });
    if (paymentResult.id) query.set('paymentId', String(paymentResult.id));
    if (paymentResult.mercadoPagoOrderId) query.set('mpOrderId', String(paymentResult.mercadoPagoOrderId));
    if (paymentResult.mercadoPagoPaymentId) query.set('mpPaymentId', String(paymentResult.mercadoPagoPaymentId));
    if (paymentResult.paymentStatus) query.set('paymentStatus', String(paymentResult.paymentStatus));
    if (paymentResult.orderStatus) query.set('orderStatus', String(paymentResult.orderStatus));
    window.location.replace(`/pagamento/${encodeURIComponent(orderId)}?${query.toString()}`);
  };

  if (!ready) {
    return (
      <div className="payment-brick-wrap">
        <InlineLoader label="Preparando o pagamento seguro..." />
      </div>
    );
  }

  return <div className="payment-brick-wrap">
    <CardPayment
      initialization={{ amount, ...(hasPayer ? { payer } : {}) }}
      onSubmit={async (formData, additionalData) => {
        if (submitting) return;
        setSubmitting(true);
        try {
          const enrichedFormData = { ...formData, ...(payerEmail ? { email: payerEmail } : {}) };
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 20000);
          let response: Response;
          try {
            const deviceId = String(window.MP_DEVICE_SESSION_ID || '').trim();
            response = await fetch('/api/mercadopago/create-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formData: enrichedFormData, orderId, total: amount, deviceId: deviceId || undefined, additionalData: additionalData || null }), signal: controller.signal, cache: 'no-store' });
          } finally { window.clearTimeout(timeout); }
          let result: PaymentResult & { error?: string };
          try { result = await response.json(); } catch { result = { status: 'rejected', statusDetail: 'Resposta inválida do servidor.' }; }
          try { localStorage.setItem('2p_guest_order_email', payerEmail); localStorage.setItem('2p_last_order_id', orderId); } catch {}

          if (!response.ok) {
            const detail = result.statusDetail || result.error || `Falha no pagamento (HTTP ${response.status}).`;
            console.error('Mercado Pago rejection diagnostics:', { httpStatus: response.status, ...result });
            redirectToResult({ ...result, httpStatus: response.status, status: result.status || 'rejected', statusDetail: detail });
            return;
          }

          const transactionResult: PaymentResult = { ...result, status: result.status || result.paymentStatus || 'pending', statusDetail: result.statusDetail || result.paymentStatusDetail || undefined, httpStatus: response.status };
          onResult(transactionResult);
          redirectToResult(transactionResult);
        } catch (error) {
          const message = error instanceof DOMException && error.name === 'AbortError' ? 'O Mercado Pago demorou para responder. Vamos verificar o pagamento na próxima tela.' : error instanceof Error ? error.message : 'Não foi possível processar o pagamento.';
          console.error('Mercado Pago submit error:', error);
          redirectToResult({ status: 'pending', statusDetail: message });
        } finally { setSubmitting(false); }
      }}
      onReady={() => undefined}
      onError={(error) => {
        console.error('Mercado Pago Card Payment Brick:', error);
        onError('O Mercado Pago encontrou um problema no formulário.');
      }}
    />
    {submitting && <div className="payment-processing" role="status" aria-live="polite">Processando pagamento… não feche esta tela.</div>}
    <div className="payment-mobile-note">Pagamento protegido pelo Mercado Pago. Os dados do cartão são tratados pelo Brick oficial e não ficam armazenados na 2P Box.</div>
    <style jsx>{`.payment-brick-wrap{width:100%;max-width:100%;min-width:0;overflow:visible;box-sizing:border-box}.payment-brick-wrap :global(*){box-sizing:border-box}.payment-processing{margin:12px 0;padding:12px;border-radius:10px;background:#111;color:#fff;text-align:center;font:700 12px/1.4 Inter,Arial,sans-serif}.payment-mobile-note{margin-top:10px;text-align:center;color:#8a8a86;font-size:9px;line-height:1.45}@media(max-width:600px){.payment-brick-wrap{padding:0;width:100%}}`}</style>
  </div>;
}
