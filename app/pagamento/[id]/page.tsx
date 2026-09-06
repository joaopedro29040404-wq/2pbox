'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock3, Loader2, ArrowRight, PackageSearch, RefreshCw } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';

const STATUS = {
  approved: { title: 'Pagamento confirmado!', text: 'Obrigado pela sua compra. O Mercado Pago confirmou o pagamento e a 2P Box já pode seguir com o pedido.', icon: CheckCircle2 },
  rejected: { title: 'Pagamento recusado', text: 'O Mercado Pago recusou este pagamento. Seu pedido continua identificado e você pode tentar novamente com outra forma de pagamento.', icon: XCircle },
  cancelled: { title: 'Pagamento não concluído', text: 'Este pagamento foi cancelado ou não foi concluído. Você pode voltar à loja e tentar novamente.', icon: XCircle },
  pending: { title: 'Pagamento pendente', text: 'O Mercado Pago ainda não confirmou o pagamento. Continuaremos consultando automaticamente.', icon: Clock3 },
  in_process: { title: 'Pagamento em análise', text: 'O Mercado Pago recebeu o pagamento e ainda está processando a confirmação. A 2P Box continuará acompanhando automaticamente.', icon: Clock3 },
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
  const [checking, setChecking] = useState(false);

  async function checkStatus() {
    if (!orderId || checking) return;
    setChecking(true);
    try {
      const paymentId = searchParams.get('paymentId') || '';
      const response = await fetch(`/api/mercadopago/payment-status?orderId=${encodeURIComponent(orderId)}${paymentId ? `&paymentId=${encodeURIComponent(paymentId)}` : ''}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'status');
      setStatus(normalizePaymentStatus(data.paymentStatus));
      setDetail(data.statusDetail || '');
      setLastUpdate(new Date());
    } catch {
      // Mantém o último status conhecido e tenta novamente no próximo ciclo.
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    const run = async () => { if (active) await checkStatus(); };
    run();
    const timer = window.setInterval(() => { if (active && !['approved', 'rejected', 'cancelled'].includes(status)) run(); }, 2200);
    return () => { active = false; window.clearInterval(timer); };
  }, [orderId, searchParams, status]);

  const config = STATUS[status];
  const Icon = config.icon;
  const terminal = ['approved', 'rejected', 'cancelled'].includes(status);

  return (
    <main className="payment-result-page">
      <div className="payment-result-topbar">2P BOX <span>•</span> PAGAMENTO SEGURO</div>
      <header className="payment-result-header"><Link href="/" className="payment-brand"><span className="logo-frame"><img src="/logo.pnh.png" alt="2P Box"/></span><div><strong>2P BOX</strong><small>COMPRA SEGURA</small></div></Link></header>
      <section className={`payment-result-card ${status}`}>
        <div className="result-icon"><Icon size={42}/></div>
        <p className="result-eyebrow">PEDIDO {orderId ? orderId.slice(0, 8).toUpperCase() : '—'}</p>
        <h1>{config.title}</h1>
        <p>{config.text}</p>
        {!terminal && <div className="sync-panel"><div className="sync-row"><span className={`sync-dot ${checking ? 'active' : ''}`}></span><strong>{checking ? 'Consultando o Mercado Pago' : 'Acompanhamento automático ativo'}</strong></div><span>Você não precisa atualizar esta página.</span></div>}
        {detail && <small className="detail">Detalhe: {detail.replaceAll('_', ' ')}</small>}
        {lastUpdate && <small className="updated">Última consulta: {lastUpdate.toLocaleTimeString('pt-BR')}</small>}
        {!terminal && <button type="button" className="refresh-button" onClick={checkStatus} disabled={checking}><RefreshCw size={14} className={checking ? 'spin' : ''}/> Atualizar agora</button>}
        <div className="result-actions">
          <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="primary"><PackageSearch size={17}/> Acompanhar pedido</Link>
          {status === 'approved' && <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="primary secondary-primary">Ver detalhes <ArrowRight size={17}/></Link>}
          {status !== 'approved' && <Link href="/loja" className="secondary">Voltar para a loja</Link>}
          <Link href="/acompanhar-pedido" className="secondary">Acompanhar sem login</Link>
        </div>
      </section>
      <footer>2P BOX • QUALIDADE • VARIEDADE • CONFIANÇA</footer>
      <style jsx>{`
        .payment-result-page{min-height:100vh;background:#fafafa;color:#111;display:grid;grid-template-rows:auto auto 1fr auto;font-family:Arial,sans-serif;overflow-x:hidden}.payment-result-topbar{background:#111;color:#fff;text-align:center;padding:11px;font-size:10px;font-weight:900;letter-spacing:.18em}.payment-result-topbar span{color:#ffc400;margin:0 8px}.payment-result-header{height:82px;background:#fff;border-bottom:1px solid #e6e6e6;padding:0 clamp(18px,6vw,72px);display:flex;align-items:center;overflow:hidden}.payment-brand{display:inline-flex;align-items:center;gap:10px;color:#111;text-decoration:none;min-width:0;max-width:100%}.logo-frame{width:68px;height:46px;flex:0 0 68px;display:flex;align-items:center;justify-content:center;overflow:hidden}.payment-brand img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center}.payment-brand div{display:grid;gap:3px;min-width:0}.payment-brand strong{font-size:19px;letter-spacing:.08em;white-space:nowrap}.payment-brand small{font-size:7px;color:#888;letter-spacing:.14em;font-weight:800;white-space:nowrap}.payment-result-card{width:min(650px,calc(100% - 32px));align-self:center;justify-self:center;margin:36px auto;padding:40px 28px;text-align:center;background:#fff;border:1px solid #e4e4e4;border-radius:18px;box-shadow:0 15px 50px rgba(0,0,0,.05);box-sizing:border-box;overflow:hidden}.result-icon{width:72px;height:72px;margin:0 auto 20px;border-radius:50%;display:grid;place-items:center;background:#fff4bf}.approved .result-icon{color:#198754}.rejected .result-icon,.cancelled .result-icon{color:#c62828;background:#fff0f0}.payment-result-card h1{font-size:clamp(28px,5vw,44px);line-height:1.05;margin:0 0 13px;letter-spacing:-.04em}.payment-result-card>p:not(.result-eyebrow){max-width:500px;margin:0 auto;color:#666;font-size:14px;line-height:1.6}.sync-panel{display:grid;gap:5px;margin:20px auto 0;padding:13px 15px;max-width:470px;background:#fafaf7;border:1px solid #e8e8df;border-radius:10px;text-align:left;color:#777;font-size:10px}.sync-row{display:flex;align-items:center;gap:8px;color:#222}.sync-dot{width:8px;height:8px;border-radius:50%;background:#d3d3d0;box-shadow:0 0 0 4px #f1f1ee}.sync-dot.active{background:#ffc400;box-shadow:0 0 0 4px #fff4bf}.detail{display:block;margin-top:10px;color:#999;font-size:9px}.updated{display:block;margin-top:6px;color:#aaa;font-size:9px}.refresh-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;margin-top:13px;padding:9px 13px;border:1px solid #d9d9d4;border-radius:8px;background:#fff;color:#333;font-size:10px;font-weight:800;cursor:pointer}.refresh-button:disabled{opacity:.55;cursor:wait}.spin{animation:spin .8s linear infinite}.result-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:24px}.result-actions :global(a){display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}.result-actions :global(.primary){background:#ffc400;color:#111;padding:13px 18px;border-radius:9px;font-weight:900}.result-actions :global(.secondary){border:1px solid #111;color:#111;padding:12px 18px;border-radius:9px;font-weight:800}.result-actions :global(.secondary-primary){background:#111;color:#fff;border-color:#111}footer{padding:20px;text-align:center;background:#111;color:#fff;font-size:8px;font-weight:900;letter-spacing:.18em}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:600px){.payment-result-header{height:70px;padding:0 18px}.logo-frame{width:56px;height:40px;flex-basis:56px}.payment-brand{gap:8px}.payment-brand strong{font-size:16px}.payment-brand small{font-size:6px}.payment-result-card{width:calc(100% - 24px);margin:20px auto;padding:32px 17px}.result-actions{display:grid}.result-actions :global(a){width:100%}}
      `}</style>
    </main>
  );
}

export default function PaymentResultPage() {
  return <Suspense fallback={<main className="payment-result-page"><div className="payment-result-card pending"><div className="result-icon"><Loader2 size={42}/></div><h1>Carregando pagamento...</h1></div></main>}><PaymentResultPageContent /></Suspense>;
}