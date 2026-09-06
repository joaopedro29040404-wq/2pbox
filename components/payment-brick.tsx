'use client';

import { Payment, initMercadoPago } from '@mercadopago/sdk-react';
import { useEffect, useState } from 'react';

let initializedKey = '';
type PixData = { qrCode?: string | null; qrCodeBase64?: string | null; ticketUrl?: string | null };
type PaymentResult = { id?: string | number; status?: string; statusDetail?: string; paymentMethodId?: string; pix?: PixData | null };
type Props = { amount: number; orderId: string; email: string; cpf?: string; preferenceId?: string; onResult: (result: PaymentResult) => void; onError: (message: string) => void };

export default function PaymentBrick({ amount, orderId, email, cpf, preferenceId, onResult, onError }: Props) {
  const [pix, setPix] = useState<PixData | null>(null);
  const [paymentId, setPaymentId] = useState<string | number | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (!publicKey) { onError('A chave pública do Mercado Pago ainda não foi configurada na Vercel.'); return; }
    if (initializedKey !== publicKey) { initMercadoPago(publicKey, { locale: 'pt-BR' }); initializedKey = publicKey; }
  }, [onError]);

  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    let timer: number | undefined;
    const check = async () => {
      try {
        const response = await fetch(`/api/mercadopago/payment-status?orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(String(paymentId))}`, { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        if (['approved', 'rejected', 'cancelled'].includes(data.paymentStatus)) {
          window.localStorage.setItem('2p_guest_order_email', email.trim().toLowerCase());
          window.localStorage.setItem('2p_last_order_id', orderId);
          window.location.href = `/pagamento/${encodeURIComponent(orderId)}?paymentId=${encodeURIComponent(String(paymentId))}&payment=${encodeURIComponent(data.paymentStatus)}`;
          return;
        }
      } catch { /* continua aguardando */ }
      timer = window.setTimeout(check, 2500);
    };
    timer = window.setTimeout(check, 1500);
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [paymentId, orderId, email]);

  async function copyPixCode() {
    if (!pix?.qrCode) return;
    try { await navigator.clipboard.writeText(pix.qrCode); setCopyMessage('Código Pix copiado!'); window.setTimeout(() => setCopyMessage(''), 2200); }
    catch { setCopyMessage('Não foi possível copiar automaticamente.'); }
  }

  if (pix) return <div className="pix-payment-result">
    <div className="pix-payment-head"><div><span className="pix-eyebrow">PAGAMENTO PIX</span><h3>Escaneie o QR Code para pagar</h3><p>O QR Code e o Pix Copia e Cola ficam disponíveis aqui. Assim que o Mercado Pago confirmar o pagamento, esta tela avançará automaticamente.</p></div><strong>R$ {amount.toFixed(2).replace('.', ',')}</strong></div>
    {pix.qrCodeBase64 && <div className="pix-qr"><img src={`data:image/jpeg;base64,${pix.qrCodeBase64}`} alt="QR Code Pix para pagamento" /></div>}
    {pix.qrCode && <div className="pix-copy-box"><label>Pix Copia e Cola</label><div><input readOnly value={pix.qrCode} onFocus={(e) => e.currentTarget.select()} /><button type="button" onClick={copyPixCode}>Copiar</button></div>{copyMessage && <small>{copyMessage}</small>}</div>}
    {pix.ticketUrl && <a className="pix-link" href={pix.ticketUrl} target="_blank" rel="noreferrer">Abrir pagamento do Mercado Pago ↗</a>}
    {paymentId && <p className="pix-payment-id">Pagamento #{paymentId} • aguardando confirmação automática</p>}
    <style jsx>{`.pix-payment-result{display:grid;gap:16px;padding:22px;border:1px solid #e5e5e5;border-radius:14px;background:#fff;text-align:center}.pix-payment-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;text-align:left}.pix-payment-head h3{margin:5px 0;font-size:18px}.pix-payment-head p{margin:0;color:#777;font-size:12px;line-height:1.5;max-width:600px}.pix-payment-head>strong{font-size:18px;white-space:nowrap}.pix-eyebrow{font-size:9px;font-weight:900;letter-spacing:.16em;color:#b68c00}.pix-qr{width:min(280px,100%);margin:2px auto;padding:12px;border:1px solid #eee;border-radius:12px;background:#fff}.pix-qr img{display:block;width:100%;height:auto}.pix-copy-box{display:grid;gap:7px;text-align:left}.pix-copy-box label{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.pix-copy-box>div{display:flex;gap:8px}.pix-copy-box input{min-width:0;flex:1;border:1px solid #ddd;border-radius:8px;padding:11px;font-size:10px;color:#555}.pix-copy-box button{border:0;border-radius:8px;background:#111;color:#fff;padding:0 15px;font-size:10px;font-weight:900;cursor:pointer}.pix-copy-box small{color:#367b43;font-size:10px}.pix-link{justify-self:center;color:#111;font-size:11px;font-weight:900;text-decoration:underline}.pix-payment-id{margin:0;color:#999;font-size:9px}@media(max-width:600px){.pix-payment-head{display:grid;gap:7px}.pix-payment-head>strong{font-size:16px}.pix-copy-box>div{display:grid}.pix-copy-box button{height:40px}}`}</style>
  </div>;

  const normalizedCpf = String(cpf || '').replace(/\D/g, '');
  const payerIdentification = normalizedCpf.length === 11 ? { type: 'CPF', number: normalizedCpf } : undefined;

  return <div className="payment-brick-wrap"><Payment
    initialization={{ amount, ...(preferenceId ? { preferenceId } : {}), payer: { email, ...(payerIdentification ? { identification: payerIdentification } : {}) } }}
    customization={{ paymentMethods: { creditCard: 'all', debitCard: 'all', prepaidCard: 'all', ticket: 'all', bankTransfer: 'all', mercadoPago: 'all' } }}
    onSubmit={async ({ formData }, additionalData) => {
      const cardholderName = String((additionalData as { cardholderName?: string } | undefined)?.cardholderName || '').trim();
      const enrichedFormData = {
        ...formData,
        ...(cardholderName ? { cardholderName } : {}),
      };
      const response = await fetch('/api/mercadopago/create-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formData: enrichedFormData, orderId, total: amount }) });
      const result: PaymentResult = await response.json();
      if (!response.ok) {
        if (result.id) {
          window.localStorage.setItem('2p_guest_order_email', email.trim().toLowerCase());
          window.localStorage.setItem('2p_last_order_id', orderId);
        }
        onError(result?.statusDetail || result?.status || 'Não foi possível processar o pagamento.');
        throw new Error(result?.statusDetail || 'Pagamento recusado');
      }
      window.localStorage.setItem('2p_guest_order_email', email.trim().toLowerCase());
      window.localStorage.setItem('2p_last_order_id', orderId);
      if (result.paymentMethodId === 'pix' && result.pix) { setPaymentId(result.id ?? null); setPix(result.pix); return; }
      window.location.href = `/pagamento/${encodeURIComponent(orderId)}?paymentId=${encodeURIComponent(String(result.id || ''))}&payment=${encodeURIComponent(result.status || 'pending')}`;
    }}
    onReady={() => undefined}
    onError={() => onError('O Mercado Pago encontrou um problema ao carregar o pagamento. Tente novamente.')}
  /><style jsx>{`.payment-brick-wrap{width:100%;min-width:0}.payment-brick-wrap :global(*){box-sizing:border-box}`}</style></div>;
}
