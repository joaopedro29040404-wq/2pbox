'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, Mail, MapPin, Package, ReceiptText, ShoppingBag, XCircle } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { OrderTracker, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderHistoryEntry } from '@/components/order-tracker';
import { TextField } from '@/components/ui/field';
import { PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { formatAddress, formatPaymentMethod, money } from '@/lib/order-format';
import { isValidEmail } from '@/lib/masks';

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_type: string;
  delivery_address: Record<string, string> | string | null;
  notes: string | null;
  status: string;
  payment_status: string | null;
  payment_status_detail?: string | null;
  payment_id?: string | null;
  payment_method?: string | null;
  payment_type?: string | null;
  payment_installments?: number | null;
  payment_amount?: number | null;
  paid_at?: string | null;
  total: number;
  created_at: string;
};
type Item = { product_id: string; product_name: string; quantity: number; unit_price: number };

function OrderPageContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [emailError, setEmailError] = useState('');
  const [askingEmail, setAskingEmail] = useState(false);
  const [sendingCopy, setSendingCopy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const toast = useToast();

  const loadOrder = useCallback(
    async (orderEmail: string, silent = false) => {
      if (!id || !orderEmail) return false;
      if (!silent) setLoading(true);
      try {
        const response = await fetch(`/api/pedido/status?orderId=${encodeURIComponent(id)}&email=${encodeURIComponent(orderEmail)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.order) {
          if (!silent) setError('Pedido não encontrado. Confira o e-mail informado na compra.');
          return false;
        }
        setError('');
        setOrder(data.order as Order);
        setItems((data.items ?? []) as Item[]);
        setHistory((data.history ?? []) as OrderHistoryEntry[]);
        setLastUpdated(new Date());
        return true;
      } catch {
        if (!silent) setError('Não foi possível consultar o pedido agora.');
        return false;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!id) return;
    let saved = searchParams.get('email')?.trim().toLowerCase() || '';
    if (!saved) {
      try {
        saved = localStorage.getItem('2p_guest_order_email')?.trim().toLowerCase() || '';
      } catch {}
    }
    setEmail(saved);
    if (!saved) {
      setAskingEmail(true);
      setLoading(false);
      return;
    }
    void loadOrder(saved);
  }, [id, searchParams, loadOrder]);

  useEffect(() => {
    if (!id || !email || askingEmail) return;
    const settled = order && ['paid', 'failed', 'refunded'].includes(String(order.payment_status || '').toLowerCase());
    const interval = settled ? 15000 : 4000;
    const timer = window.setInterval(() => void loadOrder(email, true), interval);
    return () => window.clearInterval(timer);
  }, [id, email, askingEmail, order, loadOrder]);

  function submitEmail(event: FormEvent) {
    event.preventDefault();
    const normalized = emailDraft.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setEmailError('Informe um e-mail válido.');
      return;
    }
    setEmailError('');
    try {
      localStorage.setItem('2p_guest_order_email', normalized);
      localStorage.setItem('2p_last_order_id', id);
    } catch {}
    setEmail(normalized);
    setEmailDraft('');
    setAskingEmail(false);
    void loadOrder(normalized);
  }

  async function sendCopy() {
    if (!order?.customer_email || sendingCopy) return;
    setSendingCopy(true);
    try {
      const response = await fetch('/api/conta/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'order_details', email: order.customer_email, orderId: order.id }),
      });
      if (!response.ok) throw new Error();
      toast.success('Resumo enviado', `Confira o e-mail ${order.customer_email}.`);
    } catch {
      toast.error('Não foi possível enviar o resumo', 'Tente novamente em instantes.');
    } finally {
      setSendingCopy(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <PageLoader title="Carregando seu pedido" description="Consultando o status mais recente do pagamento." />
      </Shell>
    );
  }

  if (askingEmail) {
    return (
      <Shell>
        <div className="guest-access">
          <div className="access-icon">
            <Package size={28} />
          </div>
          <p className="eyebrow">ACOMPANHAMENTO SEM LOGIN</p>
          <h1>Acompanhe seu pedido</h1>
          <p>Digite o mesmo e-mail usado na compra. Você não precisa criar uma conta.</p>
          <form onSubmit={submitEmail}>
            <TextField
              label="E-mail da compra"
              type="email"
              mask="email"
              value={emailDraft}
              placeholder="voce@email.com"
              autoComplete="email"
              error={emailError}
              icon={<Mail size={16} />}
              onValueChange={setEmailDraft}
              fullWidth
            />
            <button type="submit">Ver meu pedido</button>
          </form>
          <Link href="/acompanhar-pedido">Acompanhar outro pedido</Link>
        </div>
      </Shell>
    );
  }

  if (error || !order) {
    return (
      <Shell>
        <div className="order-error">
          <Package size={34} />
          <h1>{error || 'Pedido não encontrado.'}</h1>
          <p>Informe novamente o e-mail usado na compra para localizar este pedido.</p>
          <button
            type="button"
            onClick={() => {
              setError('');
              setEmailDraft('');
              setAskingEmail(true);
            }}
          >
            Informar e-mail novamente
          </button>
          <Link href="/acompanhar-pedido">Acompanhar outro pedido</Link>
        </div>
      </Shell>
    );
  }

  const paymentStatus = String(order.payment_status || 'pending').toLowerCase();
  const address = formatAddress(order.delivery_address);

  return (
    <Shell>
      <Link href="/loja" className="back">
        <ArrowLeft size={16} /> Voltar para a loja
      </Link>

      <div className="order-head">
        <div>
          <p className="eyebrow">DETALHES DO PEDIDO</p>
          <h1>Pedido #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p>Realizado em {new Date(order.created_at).toLocaleString('pt-BR')}</p>
        </div>
        <span className={`order-badge status-${order.status}`}>
          <Clock3 size={14} />
          {ORDER_STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      <div className="live-banner">
        <span className="live-dot" />
        <strong>Status em tempo real</strong>
        <span>Atualizamos automaticamente conforme o Mercado Pago confirma o pagamento.</span>
        {lastUpdated && <small>Atualizado às {lastUpdated.toLocaleTimeString('pt-BR')}</small>}
      </div>

      <div className={`order-card-status status-${order.status}`}>
        <div className="status-icon">
          {order.status === 'cancelled' ? <XCircle size={20} /> : ['confirmed', 'completed'].includes(order.status) ? <CheckCircle2 size={20} /> : <Package size={20} />}
        </div>
        <div>
          <span>Pedido</span>
          <strong>{ORDER_STATUS_LABELS[order.status] || order.status}</strong>
        </div>
      </div>

      <OrderTracker status={order.status} history={history} />

      <div className="order-layout">
        <div className="order-main">
          <section className="card">
            <div className="card-title">
              <Package size={18} />
              <h2>Produtos</h2>
            </div>
            {items.length ? (
              items.map((item) => (
                <div className="item" key={item.product_id}>
                  <div className="item-icon">
                    <ShoppingBag size={18} />
                  </div>
                  <div className="item-info">
                    <strong>{item.product_name}</strong>
                    <span>
                      {item.quantity} × {money(item.unit_price)}
                    </span>
                  </div>
                  <strong>{money(item.quantity * item.unit_price)}</strong>
                </div>
              ))
            ) : (
              <p className="muted">Itens deste pedido não puderam ser carregados.</p>
            )}
            <div className="total">
              <span>Total do pedido</span>
              <strong>{money(order.total)}</strong>
            </div>
          </section>

          <section className="card">
            <div className="card-title">
              <ReceiptText size={18} />
              <h2>Pagamento e faturamento</h2>
            </div>
            <dl className="data-list">
              <div>
                <dt>Situação</dt>
                <dd className={`payment-state payment-${paymentStatus}`}>
                  {['failed', 'refunded'].includes(paymentStatus) ? <XCircle size={13} /> : paymentStatus === 'paid' ? <CheckCircle2 size={13} /> : <CreditCard size={13} />}
                  {PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus}
                </dd>
              </div>
              <div>
                <dt>Forma de pagamento</dt>
                <dd>{formatPaymentMethod(order.payment_type, order.payment_method)}</dd>
              </div>
              <div>
                <dt>Parcelamento</dt>
                <dd>{order.payment_installments && order.payment_installments > 1 ? `${order.payment_installments}x` : 'À vista'}</dd>
              </div>
              <div>
                <dt>Valor cobrado</dt>
                <dd>{money(order.payment_amount ?? order.total)}</dd>
              </div>
              <div>
                <dt>Pago em</dt>
                <dd>{order.paid_at ? new Date(order.paid_at).toLocaleString('pt-BR') : '—'}</dd>
              </div>
              <div>
                <dt>Identificador</dt>
                <dd className="breakable">{order.payment_id || 'Não informado'}</dd>
              </div>
            </dl>
            <button type="button" className="send-copy" onClick={sendCopy} disabled={sendingCopy}>
              <Mail size={15} /> {sendingCopy ? 'Enviando...' : 'Receber resumo por e-mail'}
            </button>
          </section>

          {order.notes && (
            <section className="card">
              <div className="card-title">
                <h2>Observações</h2>
              </div>
              <p className="muted">{order.notes}</p>
            </section>
          )}
        </div>

        <aside className="side">
          <section className="card">
            <div className="card-title">
              <MapPin size={18} />
              <h2>Recebimento</h2>
            </div>
            <strong className="delivery-label">{order.delivery_type === 'pickup' ? 'Retirada na loja' : 'Entrega — frete pelo WhatsApp'}</strong>
            {address ? <address className="address">{address}</address> : null}
            <p className="muted">
              {order.delivery_type === 'pickup'
                ? 'Seu pedido ficará disponível para retirada assim que for marcado como pronto.'
                : 'O valor do frete é combinado pelo WhatsApp com a equipe da 2P Box.'}
            </p>
          </section>

          <section className="card">
            <div className="card-title">
              <h2>Seus dados</h2>
            </div>
            <dl className="data-list">
              <div>
                <dt>Nome</dt>
                <dd>{order.customer_name}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{order.customer_phone}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd className="breakable">{order.customer_email || email}</dd>
              </div>
            </dl>
            <Link href="/acompanhar-pedido" className="switch-order">
              Acompanhar outro pedido
            </Link>
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="order-page">
      <SiteHeader subtitle="ÁREA DO CLIENTE" />
      <div className="shell">{children}</div>
      <style jsx global>{`
        .order-page{min-height:100vh;background:#f7f7f5;color:#111}
        .shell{width:min(100% - 40px,1080px);margin:auto;padding:34px 0 70px}
        .back{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font:800 11px Inter,Arial,sans-serif;margin-bottom:22px}
        .order-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
        .order-head .eyebrow{margin:0 0 7px;color:#b68c00;font-size:9px;font-weight:900;letter-spacing:.18em}
        .order-head h1{margin:0;font-size:30px}
        .order-head>div>p:last-child{margin:7px 0 0;color:#888;font-size:11px}
        .order-badge{display:flex;align-items:center;gap:6px;padding:9px 12px;border-radius:20px;background:#eee;font-size:10px;font-weight:900;flex:none}
        .status-confirmed,.status-completed{background:#e8f7eb;color:#27733b}
        .status-cancelled{background:#ffeaea;color:#a22}
        .live-banner{display:flex;align-items:center;gap:8px;margin-top:18px;padding:11px 14px;background:#fff;border:1px solid #e4e4df;border-radius:10px;font-size:10px}
        .live-banner small{margin-left:auto;color:#999}
        .live-dot{width:8px;height:8px;border-radius:50%;background:#27a45b;box-shadow:0 0 0 4px #e6f6ec;flex:none}
        .order-card-status{display:flex;align-items:center;gap:12px;margin-top:12px;background:#fff;border:1px solid #e4e4df;border-radius:11px;padding:16px}
        .status-icon{width:38px;height:38px;border-radius:9px;background:#fff4bf;display:grid;place-items:center;flex:none}
        .order-card-status.status-confirmed .status-icon,.order-card-status.status-completed .status-icon{color:#278149;background:#eaf8ee}
        .order-card-status.status-cancelled .status-icon{color:#a22;background:#fff0f0}
        .order-card-status>div:last-child{display:grid;gap:4px}
        .order-card-status span,.data-list dt{font-size:8px;color:#999;text-transform:uppercase;letter-spacing:.12em}
        .order-card-status strong{font-size:13px}
        .order-layout{display:grid;grid-template-columns:1.55fr .9fr;gap:18px;margin-top:26px}
        .order-main,.side{display:grid;align-content:start;gap:18px}
        .card{background:#fff;border:1px solid #e4e4df;border-radius:12px;padding:23px}
        .card-title{display:flex;align-items:center;gap:9px;border-bottom:1px solid #eee;padding-bottom:15px;margin-bottom:14px}
        .card-title h2{margin:0;font-size:15px}
        .item{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #f0f0ee}
        .item-icon{width:40px;height:40px;border-radius:8px;background:#f5f5f2;display:grid;place-items:center;flex:none}
        .item-info{flex:1;display:grid;gap:4px;min-width:0}
        .item-info strong{font-size:11px}
        .item-info span,.muted{font-size:10px;color:#888;line-height:1.5}
        .item>strong{font-size:11px;white-space:nowrap}
        .total{display:flex;justify-content:space-between;align-items:center;padding-top:18px;font-size:11px}
        .total strong{font-size:19px}
        .data-list{display:grid;margin:0}
        .data-list>div{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid #f2f2ef}
        .data-list>div:last-child{border-bottom:0}
        .data-list dt{margin:0;flex:none}
        .data-list dd{margin:0;font:700 12px Inter,Arial,sans-serif;color:#111;text-align:right}
        .data-list .breakable{overflow-wrap:anywhere}
        .payment-state{display:inline-flex;align-items:center;gap:6px}
        .payment-state svg{flex:none}
        .payment-state.payment-paid{color:#278149}
        .payment-state.payment-failed,.payment-state.payment-refunded{color:#a22}
        .payment-state.payment-pending{color:#9a7200}
        .send-copy{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;margin-top:16px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#111;font:800 11px Inter,Arial,sans-serif;cursor:pointer}
        .send-copy:hover:not(:disabled){border-color:#111}
        .send-copy:disabled{opacity:.6;cursor:wait}
        .delivery-label{display:block;font-size:13px;margin-bottom:10px}
        .address{white-space:pre-line;font:400 12px/1.7 Inter,Arial,sans-serif;font-style:normal;background:#f7f7f5;border-radius:8px;padding:12px;margin:0 0 10px;color:#4d4d4d}
        .switch-order{display:block;margin-top:14px;color:#111;font:800 11px Inter,Arial,sans-serif;text-decoration:underline}
        .guest-access{max-width:480px;margin:56px auto;padding:34px;background:#fff;border:1px solid #e4e4df;border-radius:18px;text-align:center}
        .access-icon{width:58px;height:58px;margin:0 auto 18px;border-radius:50%;background:#fff4bf;display:grid;place-items:center}
        .guest-access .eyebrow{margin:0 0 7px;color:#b68c00;font-size:9px;font-weight:900;letter-spacing:.18em}
        .guest-access h1{margin:0 0 10px;font-size:30px}
        .guest-access>p:not(.eyebrow){margin:0 auto 25px;color:#777;font-size:12px;line-height:1.6}
        .guest-access form{display:grid;gap:14px;text-align:left}
        .guest-access button,.order-error button{border:0;background:#ffc400;color:#111;height:48px;padding:0 18px;border-radius:9px;font:900 12px Inter,Arial,sans-serif;cursor:pointer}
        .guest-access>a{display:inline-block;margin-top:18px;color:#555;font:800 10px Inter,Arial,sans-serif}
        .order-error{max-width:620px;margin:0 auto;text-align:center;padding:80px 20px;color:#777}
        .order-error h1{font-size:20px;color:#111}
        .order-error p{font-size:12px;line-height:1.6;margin-bottom:20px}
        .order-error a{display:block;margin-top:16px;color:#111;font:800 11px Inter,Arial,sans-serif}
        @media(max-width:700px){
          .shell{width:min(100% - 28px,1080px);padding-top:24px}
          .order-head{align-items:flex-start;flex-direction:column}
          .order-head h1{font-size:25px}
          .order-badge{align-self:flex-start}
          .live-banner{align-items:flex-start;flex-wrap:wrap}
          .live-banner small{width:100%;margin:4px 0 0 16px}
          .order-layout{grid-template-columns:1fr}
          .card{padding:18px}
          .data-list>div{align-items:flex-start;flex-direction:column;gap:4px}
          .data-list dd{text-align:left}
          .guest-access{margin:28px auto;padding:24px 18px}
          .guest-access h1{font-size:25px}
        }
      `}</style>
    </main>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<PageLoader title="Carregando seu pedido" description="Um instante enquanto localizamos as informações." />}>
      <OrderPageContent />
    </Suspense>
  );
}
