'use client';

import { Payment, initMercadoPago } from '@mercadopago/sdk-react';
import { useEffect } from 'react';

let initializedKey = '';

type Props = {
  amount: number;
  orderId: string;
  email: string;
  preferenceId?: string;
  onResult: (result: { id?: string | number; status?: string; statusDetail?: string }) => void;
  onError: (message: string) => void;
};

export default function PaymentBrick({ amount, orderId, email, preferenceId, onResult, onError }: Props) {
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) {
      onError('A chave pública do Mercado Pago ainda não foi configurada na Vercel.');
      return;
    }
    if (initializedKey !== publicKey) {
      initMercadoPago(publicKey, { locale: 'pt-BR' });
      initializedKey = publicKey;
    }
  }, [onError]);

  return (
    <div className="payment-brick-wrap">
      <Payment
        initialization={{ amount, ...(preferenceId ? { preferenceId } : {}), payer: { email } }}
        customization={{
          paymentMethods: {
            creditCard: 'all', debitCard: 'all', prepaidCard: 'all',
            ticket: 'all', bankTransfer: 'all', mercadoPago: 'all',
          },
        }}
        onSubmit={async ({ formData }) => {
          const response = await fetch('/api/mercadopago/create-payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formData, orderId, total: amount }),
          });
          const result = await response.json();
          if (!response.ok) {
            onError(result.error || 'Não foi possível processar o pagamento.');
            throw new Error(result.error || 'Pagamento recusado');
          }
          onResult(result);
        }}
        onReady={() => undefined}
        onError={() => onError('O Mercado Pago encontrou um problema ao carregar o pagamento. Tente novamente.')}
      />
      <style jsx>{`.payment-brick-wrap{width:100%;min-width:0}.payment-brick-wrap :global(*){box-sizing:border-box}`}</style>
    </div>
  );
}
