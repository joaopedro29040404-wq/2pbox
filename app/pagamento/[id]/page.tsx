'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock3, Loader2, ArrowRight, PackageSearch, RefreshCw } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';

const STATUS = {
  approved: { title: 'Pagamento confirmado!', text: 'Obrigado pela sua compra. O Mercado Pago confirmou o pagamento e a 2P Box já pode seguir com o pedido.', icon: CheckCircle2 },
  rejected: { title: 'Pagamento recusado', text: 'O Mercado Pago recusou este pagamento. Seu pedido continua identificado e você pode tentar novamente com outra forma de pagamento.', icon: XCircle },
  cancelled: { title: 'Pagamento não concluído', text: 'Este pagamento foi cancelado ou não foi concluído. Você pode voltar à loja e tentar novamente.', icon: XCircle },
  pending: { title: 'Pagamento em processamento', text: 'Ainda estamos aguardando a confirmação do Mercado Pago. Esta página consulta o servidor automaticamente.', icon: Clock3 },
  in_process: { title: 'Pagamento em análise', text: 'O Mercado Pago recebeu o pagamento e ainda está processando a confirmação. Esta página consulta o servidor automaticamente.', icon: Clock3 },
  authorized: { title: 'Pagamento autorizado', text: 'O Mercado Pago autorizou o pagamento e estamos aguardando a confirmação final.', icon: Clock3 },
} as const;

type PaymentStatus = keyof typeof STATUS;

function normalizePaymentStatus(value: string | null): PaymentStatus {
  const status = String(value || '').toLowerCase();
  return status in STATUS ? status as PaymentStatus : 'pending';
}

function PaymentResultPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orderId = decodeURIComponent(String(params?.id || ''));
  const [status, setStatus] = useState<PaymentStatus>(() => normalizePaymentStatus(searchParams.get('payment')));
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    let timer: number | undefined;
    const paymentId = searchParams.get('paymentId') || '';

    async function check() {
      try {
        const response = await fetch(`/api/mercadopago/payment-status?orderId=${encodeURIComponent(orderId)}${paymentId ? `&paymentId=${encodeURIComponent(paymentId)}` : ''}`, { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        const next = normalizePaymentStatus(data.paymentStatus);
        setStatus(next);
        setDetail(data.statusDetail || '');
        setLoading(false);
        setLastUpdate(new Date());
        if (!['approved', 'rejected', 'cancelled'].includes(next)) timer = window.setTimeout(check, 1800);
      } catch {
        if (active) { setLoading(false); timer = window.setTimeout(check, 3000); }
      }
    }
    check();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [orderId, searchParams]);

  const config = STATUS[status];
  const Icon = config.icon;

  return (
    <main className="payment-result-page">
      <div className="payment-result-topbar">2P BOX <span>•</span> PAGAMENTO SEGURO</div>
      <header className="payment-result-header"><Link href="/" className="payment-brand"><img src="/logo.pnh.png" alt="2P Box"/><div><strong>2P BOX</strong><small>COMPRA SEGURA</small></div></Link></header>
      <section className={`payment-result-card ${status}`}>
        <div className="result-icon"><Icon size={48}/></div>
        <p className="result-eyebrow">PEDIDO {orderId ? orderId.slice(0, 8).toUpperCase() : '—'}</p>
        <h1>{config.title}</h1>
        <p>{config.text}</p>
        {loading && <div className="checking"><Loader2 size={17}/> Sincronizando com o Mercado Pago...</div>}
        {!loading && !['approved', 'rejected', 'cancelled'].includes(status) && <div className="checking"><RefreshCw size={15}/> Aguardando confirmação automática</div>}
        {detail && !['approved'].includes(status) && <small className="detail">Detalhe: {detail.replaceAll('_', ' ')}</small>}
        {lastUpdate && <small className="updated">Última consulta: {lastUpdate.toLocaleTimeString('pt-BR')}</small>}
        <div className="result-actions">
          <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="primary"><PackageSearch size={17}/> Acompanhar pedido</Link>
          {status === 'approved' && <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="primary secondary-primary">Ver detalhes <ArrowRight size={17}/></Link>}
          {status !== 'approved' && <Link href="/loja" className="secondary">Voltar para a loja</Link>}
          <Link href="/acompanhar-pedido" className="secondary">Acompanhar sem login</Link>
        </div>
      </section>
      <footer>2P BOX • QUALIDADE • VARIEDADE • CONFIANÇA</footer>
      <style jsx>{`
        .payment-result-page{min-height:100vh;background:#fafafa;color:#111;display:grid;grid-template-rows:auto auto 1fr auto;font-family:Arial,sans-serif}.payment-result-topbar{background:#111;color:#fff;text-align:center;padding:12px;font-size:11px;font-weight:900;letter-spacing:.18em}.payment-result-topbar span{color:#ffc400;margin:0 8px}.payment-result-header{background:#fff;border-bottom:1px solid #e6e6e6;padding:24px 6%}.payment-brand{display:inline-flex;align-items:center;gap:12px;color:#111;text-decoration:none}.payment-brand img{width:92px;height:auto;max-width:100%;display:block}.payment-brand div{display:grid;gap:3px}.payment-brand strong{font-size:22px;letter-spacing:.08em}.payment-brand small{font-size:9px;color:#888;letter-spacing:.16em;font-weight:800}.payment-result-card{width:min(680px,calc(100% - 32px));align-self:center;justify-self:center;margin:48px auto;padding:48px 28px;text-align:center;background:#fff;border:1px solid #e4e4e4;border-radius:20px;box-shadow:0 15px 50px rgba(0,0,0,.06);box-sizing:border-box}.result-icon{width:78px;height:78px;margin:0 auto 22px;border-radius:50%;display:grid;place-items:center;background:#fff4bf}.approved .result-icon{color:#198754}.rejected .result-icon,.cancelled .result-icon{color:#c62828;background:#fff0f0}.payment-result-card h1{font-size:clamp(30px,5vw,48px);line-height:1.05;margin:0 0 15px;letter-spacing:-.04em}.payment-result-card>p:not(.result-eyebrow){max-width:520px;margin:0 auto;color:#666;font-size:15px;line-height:1.6}.checking{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:20px;color:#777;font-size:12px}.checking svg{animation:spin 1s linear infinite}.detail{display:block;margin-top:12px;color:#999;font-size:10px}.updated{display:block;margin-top:7px;color:#aaa;font-size:9px}.result-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:28px}.result-actions :global(a){display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}.result-actions :global(.primary){background:#ffc400;color:#111;padding:14px 20px;border-radius:9px;font-weight:900}.result-actions :global(.secondary){border:1px solid #111;color:#111;padding:13px 20px;border-radius:9px;font-weight:800}.result-actions :global(.secondary-primary){background:#111;color:#fff;border-color:#111}footer{padding:22px;text-align:center;background:#111;color:#fff;font-size:9px;font-weight:900;letter-spacing:.18em}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:600px){.payment-result-header{padding:18px 22px}.payment-brand img{width:74px}.payment-brand strong{font-size:18px}.payment-result-card{margin:25px auto;padding:38px 20px}.result-actions{display:grid}.result-actions :global(a){width:100%}}
      `}</style>
    </main>
  );
}

export default function PaymentResultPage() {
  return <Suspense fallback={<main className="payment-result-page"><div className="payment-result-card pending"><div className="result-icon"><Loader2 size={48}/></div><h1>Carregando pagamento...</h1></div></main>}><PaymentResultPageContent /></Suspense>;
}
