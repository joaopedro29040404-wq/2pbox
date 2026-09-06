'use client';

import { Payment } from '@mercadopago/sdk-react';
import { initMercadoPago } from '@mercadopago/sdk-react';
import { useEffect, useRef } from 'react';

let initialized = false;

export default function PaymentBrick({ amount, orderId, email, onResult, onError }: { amount: number; orderId: string; email: string; onResult: (result: { id?: string | number; status?: string; statusDetail?: string }) => void; onError: (message: string) => void }) {
  const mounted = useRef(false);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) {
      onError('Mercado Pago ainda não foi configurado no site.');
      return;
    }
    if (!initialized) {
      initMercadoPago(publicKey, { locale: 'pt-BR' });
      initialized = true;
    }
    mounted.current = true;
    return () => { mounted.current = false; };
  }, [onError]);

  const initialization = { amount, payer: { email } };
  const customization = {
    paymentMethods: {
      creditCard: 'all' as const,
      debitCard: 'all' as const,
      prepaidCard: 'all' as const,
      ticket: 'all' as const,
      bankTransfer: 'all' as const,
      mercadoPago: 'all' as const,
    },
    visual: { style: { theme: 'default' as const } },
  };

  return (
    <div className="payment-brick-wrap">
      <Payment
        initialization={initialization}
        customization={customization}
        onSubmit={async ({ formData }) => {
          const response = await fetch('/api/mercadopago/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formData, orderId, total: amount }),
          });
          const result = await response.json();
          if (!response.ok) {
            onError(result.error || 'Não foi possível processar o pagamento.');
            throw new Error(result.error || 'Pagamento recusado');
          }
          onResult(result);
        }}
        onReady={() => {}}
        onError={(error) => onError('O Mercado Pago encontrou um problema ao carregar o pagamento. Tente novamente.')}
      />
      <style jsx>{`.payment-brick-wrap{width:100%;min-width:0}.payment-brick-wrap :global(*){box-sizing:border-box}`}</style>
    </div>
  );
}
