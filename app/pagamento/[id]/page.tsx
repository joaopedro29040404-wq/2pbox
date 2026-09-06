'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, Loader2, Package, PackageCheck, RefreshCw, ShoppingBag, XCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';

type Status = 'pending' | 'in_process' | 'authorized' | 'approved' | 'rejected' | 'cancelled';

type OrderSnapshot = {
  id: string;
  status: string;
  payment_status: Status | null;
  payment_id?: string | null;
  payment_status_detail?: string | null;
  payment_updated_at?: string | null;
  total: number;
};

const PAYMENT_COPY: Record<Status, { title: string; text: string; icon: typeof Clock3 }> = {
  pending: { title: 'Aguardando pagamento', text: 'O pedido foi criado e ainda aguardamos a confirmação do Mercado Pago.', icon: Clock3 },
  in_process: { title: 'Pagamento em análise', text: 'O Mercado Pago está analisando a transação. Não é preciso refazer o pedido.', icon: Clock3 },
  authorized: { title: 'Pagamento autorizado', text: 'O pagamento foi autorizado e aguarda a confirmação final.', icon: CreditCard },
  approved: { title: 'Pagamento confirmado', text: 'O Mercado Pago confirmou o pagamento e o pedido pode seguir para preparação.', icon: CheckCircle2 },
  rejected: { title: 'Pagamento recusado', text: 'O pagamento foi recusado. Você pode tentar novamente com outra forma de pagamento.', icon: XCircle },
  cancelled: { title: 'Pagamento cancelado', text: 'Este pagamento foi cancelado. O estoque reservado para ele já pode ser liberado.', icon: XCircle },
};

const ORDER_COPY: Record<string, string> = {
  pending: 'Pedido recebido',
  confirmed: 'Pagamento confirmado',
  preparing: 'Em preparação',
  ready: 'Pronto para retirada',
  completed: 'Pedido concluído',
  cancelled: 'Pedido cancelado',
};

const ORDER_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

export default function PaymentResultPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orderId = decodeURIComponent(String(params?.id || ''));
  const paymentId = searchParams.get('paymentId') || '';
  const [order, setOrder] = useState<OrderSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await fetch(`/api/pedido/status?orderId=${encodeURIComponent(orderId)}&email=${encodeURIComponent(localStorage.getItem('2p_guest_order_email') || '')}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.order) throw new Error(data.error || 'Pedido não encontrado.');
      setOrder(data.order as OrderSnapshot);
      setLastUpdated(new Date());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o pedido.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2500);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!orderId || !paymentId) return;
    // O GET abaixo consulta o Mercado Pago e passa pela mesma função de sincronização
    // usada pelo webhook. Assim, voltar do Brick não cria um estado paralelo.
    fetch(`/api/mercadopago/payment-status?orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(paymentId)}`, { cache: 'no-store' }).catch(() => undefined);
  }, [orderId, paymentId]);

  const paymentStatus = order?.payment_status || 'pending';
  const paymentCopy = PAYMENT_COPY[paymentStatus] || PAYMENT_COPY.pending;
  const PaymentIcon = paymentCopy.icon;
  const currentStep = order ? Math.max(-1, ORDER_STEPS.indexOf(order.status)) : -1;

  if (loading && !order) return <Page><div className="loading"><Loader2 className="spin" size={24} /> Sincronizando pedido e pagamento...</div></Page>;

  return <Page>
    <Link href="/loja" className="back"><ArrowLeft size={16} /> Voltar para a loja</Link>
    <div className="result-head"><div><p className="eyebrow">PAGAMENTO • PEDIDO</p><h1>{orderId ? `Pedido #${orderId.slice(0, 8).toUpperCase()}` : 'Pedido'}</h1><p>O status exibido aqui vem do mesmo registro usado no acompanhamento do pedido.</p></div><div className={`payment-badge payment-${paymentStatus}`}><PaymentIcon size={16} />{paymentCopy.title}</div></div>
    {error && <div className="error-banner">{error} <button type="button" onClick={load}><RefreshCw size={14} /> Tentar novamente</button></div>}
    {order && <>
      <div className="live-banner"><span className="dot" /><strong>Status automático</strong><span>Webhook do Mercado Pago + sincronização do servidor.</span>{lastUpdated && <small>Atualizado às {lastUpdated.toLocaleTimeString('pt-BR')}</small>}</div>
      <section className="hero-status">
        <div className="hero-icon"><PaymentIcon size={42} /></div>
        <p className="eyebrow">PAGAMENTO</p>
        <h2>{paymentCopy.title}</h2>
        <p>{paymentCopy.text}</p>
        <div className="hero-total"><span>Total</span><strong>R$ {Number(order.total).toFixed(2).replace('.', ',')}</strong></div>
      </section>

      <section className="status-card"><div className="card-heading"><PackageCheck size={18} /><div><h3>Etapas do pedido</h3><span>Depois da aprovação, o pedido avança automaticamente conforme a operação da loja.</span></div></div><div className="timeline"><div className="line" />{ORDER_STEPS.map((step, index) => <div className={`step ${index <= currentStep ? 'done' : ''}`} key={step}><div className="step-dot">{index <= currentStep ? <CheckCircle2 size={15} /> : index + 1}</div><strong>{ORDER_COPY[step]}</strong></div>)}</div></section>

      <section className="info-grid"><div className="info-card"><CreditCard size={18} /><div><span>Pagamento</span><strong>{paymentCopy.title}</strong><small>{order.payment_status_detail ? order.payment_status_detail.replaceAll('_', ' ') : 'Sem detalhe adicional'}</small></div></div><div className="info-card"><Package size={18} /><div><span>Pedido</span><strong>{ORDER_COPY[order.status] || order.status}</strong><small>{order.status === 'cancelled' ? 'Pedido encerrado.' : 'A operação da loja atualiza esta etapa.'}</small></div></div></section>
    </>}
    <div className="actions"><Link href={`/pedido/${encodeURIComponent(orderId)}`} className="primary"><ShoppingBag size={17} /> Ver pedido completo</Link><Link href="/acompanhar-pedido" className="secondary">Acompanhar outro pedido</Link><Link href="/loja" className="secondary">Continuar comprando</Link></div>
  </Page>;
}

function Page({ children }: { children: React.ReactNode }) {
  return <main className="payment-result-page"><header><Link href="/" className="brand"><img src="/logo.pnh.png" alt="2P Box" /><span>2P BOX<small>PAGAMENTO E PEDIDOS</small></span></Link></header><div className="shell">{children}</div><footer>2P BOX • PAGAMENTO SEGURO • ACOMPANHAMENTO EM TEMPO REAL</footer><style jsx global>{styles}</style></main>;
}

const styles = `
.payment-result-page{min-height:100vh;background:#f7f7f5;color:#111}.payment-result-page header{height:78px;background:#fff;border-bottom:1px solid #e8e8e5;display:flex;align-items:center;padding:0 max(20px,calc((100% - 1080px)/2))}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#111;font-weight:900;letter-spacing:.08em}.brand img{width:72px;height:50px;object-fit:contain}.brand span{display:grid;gap:3px}.brand small{font-size:7px;letter-spacing:.14em;color:#999}.shell{width:min(100% - 28px,1080px);margin:0 auto;padding:34px 0 55px}.back{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font-size:11px;font-weight:800;margin-bottom:24px}.result-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.eyebrow{margin:0 0 7px;color:#b68c00;font-size:9px;font-weight:900;letter-spacing:.18em}.result-head h1{margin:0;font:900 clamp(32px,5vw,46px)/1 'Barlow Condensed',Arial,sans-serif;text-transform:uppercase;font-style:italic}.result-head p{margin:8px 0 0;color:#777;font-size:12px}.payment-badge{display:flex;align-items:center;gap:8px;padding:10px 13px;border-radius:999px;background:#eee;font-size:10px;font-weight:900;white-space:nowrap}.payment-approved{color:#287548;background:#e9f7ed}.payment-rejected,.payment-cancelled{color:#a12626;background:#ffeded}.payment-in_process,.payment-authorized,.payment-pending{color:#755f00;background:#fff7cf}.live-banner{display:flex;align-items:center;gap:8px;margin-top:15px;padding:10px 12px;background:#fff;border:1px solid #e4e4df;border-radius:10px;font-size:10px}.live-banner small{margin-left:auto;color:#999}.dot{width:8px;height:8px;border-radius:50%;background:#2d9b57;box-shadow:0 0 0 4px #e8f7ee}.hero-status{margin-top:16px;padding:32px 24px;text-align:center;background:#fff;border:1px solid #e4e4df;border-radius:18px;box-shadow:0 12px 35px rgba(0,0,0,.04)}.hero-icon{width:68px;height:68px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;background:#fff5c8}.payment-approved .hero-icon{color:#2b824c;background:#e8f8ec}.hero-status h2{margin:0;font:900 clamp(28px,5vw,42px)/1 'Barlow Condensed',Arial,sans-serif;text-transform:uppercase}.hero-status>p:not(.eyebrow){max-width:560px;margin:10px auto 0;color:#6f6f6a;font-size:13px;line-height:1.55}.hero-total{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:18px}.hero-total span{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.hero-total strong{font-size:24px}.status-card{margin-top:14px;background:#fff;border:1px solid #e4e4df;border-radius:14px;padding:20px}.card-heading{display:flex;align-items:flex-start;gap:10px}.card-heading h3{margin:0;font-size:14px}.card-heading span{display:block;margin-top:4px;color:#888;font-size:10px;line-height:1.4}.timeline{position:relative;display:flex;justify-content:space-between;margin-top:28px}.line{position:absolute;left:9%;right:9%;top:13px;height:2px;background:#ddd}.step{position:relative;z-index:1;display:grid;justify-items:center;gap:7px;text-align:center;width:20%;font-size:9px;color:#999}.step.done{color:#111}.step-dot{width:27px;height:27px;border-radius:50%;background:#eee;display:grid;place-items:center}.step.done .step-dot{background:#ffc400;color:#111}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.info-card{display:flex;gap:10px;align-items:flex-start;padding:16px;background:#fff;border:1px solid #e4e4df;border-radius:12px}.info-card>svg{flex:none}.info-card div{display:grid;gap:4px}.info-card span{font-size:8px;color:#999;text-transform:uppercase;letter-spacing:.12em}.info-card strong{font-size:11px}.info-card small{color:#888;font-size:9px;line-height:1.4}.actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:18px}.actions a{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}.error-banner{margin-top:14px;padding:12px 13px;background:#fff0f0;border:1px solid #efcccc;border-radius:9px;color:#912e2e;font-size:11px;display:flex;align-items:center;justify-content:space-between;gap:10px}.error-banner button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;text-decoration:underline;font-weight:900;cursor:pointer}.loading{text-align:center;padding:110px 0;color:#777;display:flex;justify-content:center;gap:9px;align-items:center}.spin{animation:spin .8s linear infinite}footer{padding:22px;text-align:center;background:#111;color:#fff;font-size:9px;font-weight:900;letter-spacing:.16em}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:700px){.result-head{display:grid;align-items:start}.payment-badge{justify-self:start}.live-banner{flex-wrap:wrap}.live-banner small{width:100%;margin-left:0}.timeline{gap:7px}.step{font-size:8px}.info-grid{grid-template-columns:1fr}.actions{display:grid}.actions a{width:100%}.hero-status{padding:28px 18px}.status-card{padding:17px 14px}}
`;
