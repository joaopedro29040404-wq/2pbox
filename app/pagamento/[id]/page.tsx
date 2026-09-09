'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock3, Loader2, PackageSearch, RefreshCw } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';

const STATUS = {
  approved: { title: 'Pagamento confirmado!', text: 'Obrigado pela sua compra. O Mercado Pago confirmou o pagamento e a 2P Box já pode seguir com o pedido.', icon: CheckCircle2 },
  rejected: { title: 'Pagamento recusado', text: 'O pagamento não foi aprovado. Você pode tentar novamente com outra forma de pagamento.', icon: XCircle },
  cancelled: { title: 'Pagamento não concluído', text: 'Este pagamento foi cancelado ou não foi concluído. Você pode voltar à loja e tentar novamente.', icon: XCircle },
  pending: { title: 'Pagamento pendente', text: 'O pagamento ainda não foi confirmado. Continuaremos consultando automaticamente.', icon: Clock3 },
  in_process: { title: 'Pagamento em análise', text: 'O pagamento foi recebido e ainda está sendo processado. A 2P Box continuará acompanhando automaticamente.', icon: Clock3 },
  authorized: { title: 'Pagamento autorizado', text: 'O pagamento foi autorizado e aguardamos a confirmação final.', icon: Clock3 },
} as const;

type PaymentStatus = keyof typeof STATUS;
function normalizePaymentStatus(value: string | null): PaymentStatus { const status = String(value || '').toLowerCase(); return status in STATUS ? status as PaymentStatus : 'pending'; }

function PaymentResultPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orderId = decodeURIComponent(String(params?.id || ''));
  const [status, setStatus] = useState<PaymentStatus>(() => normalizePaymentStatus(searchParams.get('payment')));
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function checkStatus() {
    if (!orderId || checking) return;
    setChecking(true);
    try {
      const paymentId = searchParams.get('paymentId') || searchParams.get('mpPaymentId') || '';
      const response = await fetch(`/api/mercadopago/payment-status?orderId=${encodeURIComponent(orderId)}${paymentId ? `&paymentId=${encodeURIComponent(paymentId)}` : ''}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'status');
      setStatus(normalizePaymentStatus(data.paymentStatus));
      setLastUpdate(new Date());
    } catch {} finally { setLoading(false); setChecking(false); }
  }

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    checkStatus();
    const timer = window.setInterval(() => { if (active && !['approved', 'rejected', 'cancelled'].includes(status)) checkStatus(); }, 2200);
    return () => { active = false; window.clearInterval(timer); };
  }, [orderId, status]);

  const config = STATUS[status];
  const Icon = config.icon;
  const terminal = ['approved', 'rejected', 'cancelled'].includes(status);

  return (
    <main className="payment-page">
      <div className="payment-topbar"><span>QUALIDADE</span><b>•</b><span>VARIEDADE</span><b>•</b><span>CONFIANÇA</span></div>
      <header className="payment-header"><div className="payment-header-inner"><Link href="/" className="payment-brand"><img src="/logo.pnh.png" alt="2P Box" /><span><strong>2P BOX</strong><small>COMPRA SEGURA</small></span></Link></div></header>

      <section className={`payment-card ${status}`}>
        <div className="payment-icon"><Icon size={38} /></div>
        <p className="payment-eyebrow">PEDIDO {orderId ? orderId.slice(0, 8).toUpperCase() : '—'}</p>
        <h1>{config.title}</h1>
        <p className="payment-text">{config.text}</p>

        {!terminal && <div className="payment-sync"><div><span className={`sync-dot ${checking ? 'active' : ''}`} /><strong>{checking ? 'Consultando pagamento' : 'Acompanhamento automático ativo'}</strong></div><small>Você não precisa atualizar esta página.</small></div>}
        {lastUpdate && !terminal && <small className="payment-updated">Última consulta: {lastUpdate.toLocaleTimeString('pt-BR')}</small>}
        {!terminal && <button className="payment-refresh" type="button" onClick={checkStatus} disabled={checking}><RefreshCw size={14} /> Atualizar agora</button>}

        <div className="payment-actions">
          {status === 'approved' && <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="payment-primary"><PackageSearch size={17} /> Acompanhar pedido</Link>}
          {status !== 'approved' && status !== 'pending' && status !== 'in_process' && status !== 'authorized' && <Link href="/loja" className="payment-primary">Tentar novamente</Link>}
          {!terminal && <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="payment-secondary"><PackageSearch size={16} /> Acompanhar pedido</Link>}
          {terminal && <Link href="/loja" className="payment-secondary">Voltar para a loja</Link>}
        </div>
      </section>

      <footer className="payment-footer">2P BOX <span>•</span> QUALIDADE • VARIEDADE • CONFIANÇA</footer>

      <style jsx>{`
        .payment-page{--yellow:#ffc400;--gold:#9a7200;--ink:#111;min-height:100svh;background:#fff;color:var(--ink);display:grid;grid-template-rows:auto auto 1fr auto;font-family:Inter,Arial,sans-serif;overflow-x:hidden}
        .payment-topbar{height:34px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:14px;font-size:10px;font-weight:800;letter-spacing:.25em}.payment-topbar b{color:var(--yellow);font-size:9px}
        .payment-header{height:86px;background:rgba(255,255,255,.96);border-bottom:1px solid #e7e7e7}.payment-header-inner{width:min(1180px,calc(100% - 56px));height:100%;margin:auto;display:flex;align-items:center}.payment-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#111}.payment-brand img{width:78px;height:54px;object-fit:contain}.payment-brand span{display:grid;gap:3px}.payment-brand strong{font-size:17px;letter-spacing:.08em}.payment-brand small{font-size:7px;color:#888;letter-spacing:.14em;font-weight:800}
        .payment-card{width:min(680px,calc(100% - 56px));align-self:center;justify-self:center;margin:58px auto;padding:52px 52px 44px;background:#fff;border:1px solid #e7e7e7;box-shadow:0 20px 60px rgba(0,0,0,.06);text-align:center}.payment-icon{width:74px;height:74px;margin:0 auto 21px;border-radius:50%;display:grid;place-items:center;background:#fff7d5}.approved .payment-icon{color:#218b53}.rejected .payment-icon,.cancelled .payment-icon{background:#fff0f0;color:#c62828}.payment-eyebrow{margin:0 0 9px;color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.25em}.payment-card h1{margin:0;font-size:clamp(30px,5vw,48px);line-height:.98;letter-spacing:-.045em}.payment-text{max-width:540px;margin:18px auto 0;color:#707070;font-size:14px;line-height:1.65}.payment-sync{max-width:470px;margin:23px auto 0;padding:14px 16px;border:1px solid #e8e8df;background:#fafaf7;text-align:left}.payment-sync>div{display:flex;align-items:center;gap:8px}.payment-sync strong{font-size:10px}.payment-sync small{display:block;margin-top:5px;color:#777;font-size:9px}.sync-dot{width:8px;height:8px;border-radius:50%;background:#d3d3d0}.sync-dot.active{background:var(--yellow)}.payment-updated{display:block;margin-top:8px;color:#aaa;font-size:9px}.payment-refresh{display:inline-flex;align-items:center;gap:7px;margin-top:13px;padding:9px 13px;border:1px solid #d9d9d4;border-radius:8px;background:#fff;font-size:10px;font-weight:800}.payment-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:28px}.payment-actions a{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.08em;padding:14px 20px;border-radius:8px}.payment-primary{background:var(--yellow);color:#111}.payment-secondary{border:1px solid #111;color:#111}.payment-footer{padding:21px;text-align:center;background:#111;color:#fff;font-size:8px;font-weight:900;letter-spacing:.18em}.payment-footer span{color:var(--yellow);margin:0 5px}
        @media(max-width:600px){.payment-topbar{height:30px;padding:0 8px;gap:7px;font-size:7px;letter-spacing:.12em}.payment-header{height:70px}.payment-header-inner{width:calc(100% - 28px)}.payment-brand img{width:54px;height:42px}.payment-brand strong{font-size:14px}.payment-brand small{font-size:6px}.payment-card{width:calc(100% - 24px);margin:24px auto;padding:34px 17px 29px}.payment-icon{width:62px;height:62px;margin-bottom:17px}.payment-card h1{font-size:clamp(27px,8vw,36px)}.payment-text{font-size:12px;line-height:1.55;margin-top:14px}.payment-actions{display:grid;gap:9px;margin-top:23px}.payment-actions a{width:100%;box-sizing:border-box}.payment-footer{padding:16px 10px;font-size:7px;letter-spacing:.12em}}
        @media(max-width:340px){.payment-card{width:calc(100% - 16px);padding-inline:13px}.payment-card h1{font-size:25px}.payment-text{font-size:11px}}
      `}</style>
    </main>
  );
}

export default function PaymentResultPage(){return <Suspense fallback={<main className="payment-page"><div className="payment-card"><Loader2 size={38}/><h1>Carregando...</h1></div></main>}><PaymentResultPageContent /></Suspense>;}
