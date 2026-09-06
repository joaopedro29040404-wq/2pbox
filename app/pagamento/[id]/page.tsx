'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock3, Loader2, ArrowRight } from 'lucide-react';

const STATUS = {
  approved: { title: 'Pagamento confirmado!', text: 'Obrigado pela sua compra. Seu pedido foi confirmado pela 2P Box.', icon: CheckCircle2 },
  rejected: { title: 'Pagamento recusado', text: 'O Mercado Pago não aprovou este pagamento. Você pode tentar novamente com outra forma de pagamento.', icon: XCircle },
  cancelled: { title: 'Pagamento não concluído', text: 'Este pagamento foi cancelado. Você pode voltar à loja e tentar novamente.', icon: XCircle },
  pending: { title: 'Pagamento em processamento', text: 'Ainda estamos aguardando a confirmação do Mercado Pago. Esta página será atualizada automaticamente.', icon: Clock3 },
} as const;

type PaymentStatus = keyof typeof STATUS;

export default function PaymentResultPage({ params }: { params: { id: string } }) {
  const orderId = decodeURIComponent(params.id);
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const paymentId = new URLSearchParams(window.location.search).get('paymentId') || '';

    async function check() {
      try {
        const response = await fetch(`/api/mercadopago/payment-status?orderId=${encodeURIComponent(orderId)}${paymentId ? `&paymentId=${encodeURIComponent(paymentId)}` : ''}`, { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        if (data.paymentStatus === 'approved') setStatus('approved');
        else if (data.paymentStatus === 'rejected') setStatus('rejected');
        else if (data.paymentStatus === 'cancelled') setStatus('cancelled');
        else setStatus('pending');
        setDetail(data.statusDetail || '');
        setLoading(false);
        if (!['approved', 'rejected', 'cancelled'].includes(data.paymentStatus)) timer = window.setTimeout(check, 4000);
      } catch {
        if (active) { setLoading(false); timer = window.setTimeout(check, 5000); }
      }
    }
    check();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [orderId]);

  const config = STATUS[status];
  const Icon = config.icon;

  return (
    <main className="payment-result-page">
      <div className="payment-result-topbar">2P BOX <span>•</span> PAGAMENTO SEGURO</div>
      <header className="payment-result-header"><Link href="/" className="payment-brand"><img src="/logo.pnh.png" alt="2P Box"/><div><strong>2P BOX</strong><small>COMPRA SEGURA</small></div></Link></header>
      <section className={`payment-result-card ${status}`}>
        <div className="result-icon"><Icon size={48}/></div>
        <p className="result-eyebrow">PEDIDO {orderId.slice(0, 8).toUpperCase()}</p>
        <h1>{config.title}</h1>
        <p>{config.text}</p>
        {loading && <div className="checking"><Loader2 size={17}/> Consultando o Mercado Pago...</div>}
        {detail && status !== 'approved' && <small className="detail">Detalhe: {detail.replaceAll('_', ' ')}</small>}
        <div className="result-actions">
          {status === 'approved' ? <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="primary">Ver detalhes do pedido <ArrowRight size={17}/></Link> : <Link href="/loja" className="primary">Voltar para a loja <ArrowRight size={17}/></Link>}
          <Link href="/" className="secondary">Ir para o início</Link>
        </div>
      </section>
      <footer>2P BOX • QUALIDADE • VARIEDADE • CONFIANÇA</footer>
      <style jsx>{`
        .payment-result-page{min-height:100vh;background:#fafafa;color:#111;display:grid;grid-template-rows:auto auto 1fr auto;font-family:Arial,sans-serif}.payment-result-topbar{background:#111;color:#fff;text-align:center;padding:12px;font-size:11px;font-weight:900;letter-spacing:.18em}.payment-result-topbar span{color:#ffc400;margin:0 8px}.payment-result-header{background:#fff;border-bottom:1px solid #e6e6e6;padding:24px 6%;}.payment-brand{display:inline-flex;align-items:center;gap:12px;color:#111;text-decoration:none}.payment-brand img{width:92px;height:auto;display:block}.payment-brand div{display:grid;gap:3px}.payment-brand strong{font-size:22px;letter-spacing:.08em}.payment-brand small{font-size:9px;color:#888;letter-spacing:.16em;font-weight:800}.payment-result-card{width:min(680px,calc(100% - 32px));align-self:center;justify-self:center;margin:48px auto;padding:48px 28px;text-align:center;background:#fff;border:1px solid #e4e4e4;border-radius:20px;box-shadow:0 15px 50px rgba(0,0,0,.06)}.result-icon{width:78px;height:78px;margin:0 auto 22px;border-radius:50%;display:grid;place-items:center;background:#fff4bf}.approved .result-icon{color:#198754}.rejected .result-icon,.cancelled .result-icon{color:#c62828;background:#fff0f0}.result-eyebrow{margin:0 0 8px;font-size:10px;font-weight:900;letter-spacing:.18em;color:#a47b00}.payment-result-card h1{font-size:clamp(30px,5vw,48px);line-height:1.05;margin:0 0 15px;letter-spacing:-.04em}.payment-result-card>p:not(.result-eyebrow){max-width:520px;margin:0 auto;color:#666;font-size:15px;line-height:1.6}.checking{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:20px;color:#777;font-size:12px}.checking svg{animation:spin 1s linear infinite}.detail{display:block;margin-top:12px;color:#999;font-size:10px}.result-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:28px}.result-actions :global(a){display:inline-flex;align-items:center;gap:8px;text-decoration:none}.result-actions :global(.primary){background:#ffc400;color:#111;padding:14px 20px;border-radius:9px;font-weight:900}.result-actions :global(.secondary){border:1px solid #111;color:#111;padding:13px 20px;border-radius:9px;font-weight:800}footer{padding:22px;text-align:center;background:#111;color:#fff;font-size:9px;font-weight:900;letter-spacing:.18em}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:600px){.payment-result-header{padding:18px 22px}.payment-brand img{width:74px}.payment-brand strong{font-size:18px}.payment-result-card{margin:25px auto;padding:38px 20px}.result-actions{display:grid}.result-actions :global(a){justify-content:center}}
      `}</style>
    </main>
  );
}
