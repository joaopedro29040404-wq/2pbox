'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronRight, Clock3, KeyRound, Mail, Package, ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/components/order-tracker';
import { TextField } from '@/components/ui/field';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { isValidEmail } from '@/lib/masks';
import { money } from '@/lib/order-format';

type OrderSummary = {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
  delivery_type: string;
  item_count: number;
};

type Stage = 'loading' | 'email' | 'code' | 'list';
const PAGE_SIZE = 8;

export default function TrackOrderPage() {
  const [stage, setStage] = useState<Stage>('loading');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [identity, setIdentity] = useState<{ email: string; source: string } | null>(null);
  const toast = useToast();

  const loadOrders = useCallback(async (): Promise<boolean> => {
    const response = await fetch('/api/pedidos', { cache: 'no-store' });
    if (response.status === 401) return false;
    if (!response.ok) throw new Error('Não foi possível carregar seus pedidos.');
    const data = await response.json();
    setOrders((data.orders ?? []) as OrderSummary[]);
    setIdentity({ email: data.email, source: data.source });
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const authorized = await loadOrders();
        if (!active) return;
        setStage(authorized ? 'list' : 'email');
      } catch {
        if (active) setStage('email');
      }
    })();
    return () => {
      active = false;
    };
  }, [loadOrders]);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) return setError('Informe um e-mail válido.');

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/pedido/acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'request', email: normalized }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || 'Não foi possível enviar o código.');
        return;
      }
      setCode('');
      setStage('code');
      toast.info('Código enviado', 'Se existir pedido nesse e-mail, o código chega em instantes.');
    } catch {
      setError('Não foi possível enviar o código agora.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) return setError('O código tem 6 dígitos.');

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/pedido/acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'verify', email: email.trim().toLowerCase(), code: digits }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || 'Código inválido.');
        return;
      }
      await loadOrders();
      setStage('list');
      toast.success('Acesso liberado', 'Estes são os seus pedidos.');
    } catch {
      setError('Não foi possível validar o código agora.');
    } finally {
      setBusy(false);
    }
  }

  async function signOutAccess() {
    await fetch('/api/pedido/acesso', { method: 'DELETE' }).catch(() => undefined);
    setOrders([]);
    setIdentity(null);
    setCode('');
    setStage('email');
    toast.info('Sessão de consulta encerrada');
  }

  if (stage === 'loading') {
    return (
      <main className="track-page">
        <SiteHeader subtitle="ACOMPANHAR PEDIDO" />
        <PageLoader title="Carregando seus pedidos" description="Verificando se você já está identificado." />
        <style jsx global>{styles}</style>
      </main>
    );
  }

  if (stage === 'list') return <OrdersView orders={orders} identity={identity} onExit={signOutAccess} />;

  return (
    <main className="track-page">
      <SiteHeader subtitle="ACOMPANHAR PEDIDO" />
      <section className="track-hero">
        <div className="track-container">
          <div className="track-heading">
            <p className="track-eyebrow">2P BOX • PEDIDOS</p>
            <h1>
              Acompanhe seus <em>pedidos.</em>
            </h1>
            <p className="track-lead">
              {stage === 'email'
                ? 'Informe o e-mail usado na compra. Enviaremos um código de verificação para proteger seus dados.'
                : 'Digite o código de 6 dígitos que enviamos para o seu e-mail.'}
            </p>
          </div>

          <div className="track-layout">
            <aside className="track-side">
              <div className="track-side-number">{stage === 'email' ? '01' : '02'}</div>
              <ShieldCheck size={28} strokeWidth={1.6} />
              <h2>
                Seus pedidos,
                <br />
                <em>só para você.</em>
              </h2>
              <p>
                Sem criar conta. O código confirma que o e-mail é seu e ninguém mais consegue ver o que você comprou.
              </p>
            </aside>

            <div className="track-card">
              {stage === 'email' ? (
                <>
                  <div className="track-card-head">
                    <div className="track-icon">
                      <Mail size={21} strokeWidth={2} />
                    </div>
                    <div>
                      <p>PASSO 1 DE 2</p>
                      <h2>Informe seu e-mail</h2>
                    </div>
                  </div>
                  <form onSubmit={requestCode} noValidate>
                    <TextField
                      label="E-mail da compra"
                      type="email"
                      mask="email"
                      autoComplete="email"
                      placeholder="voce@email.com"
                      value={email}
                      error={error}
                      icon={<Mail size={16} />}
                      onValueChange={setEmail}
                      fullWidth
                    />
                    <button type="submit" disabled={busy}>
                      {busy ? <InlineLoader label="Enviando..." /> : <>ENVIAR CÓDIGO <ArrowRight size={17} /></>}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="track-card-head">
                    <div className="track-icon">
                      <KeyRound size={21} strokeWidth={2} />
                    </div>
                    <div>
                      <p>PASSO 2 DE 2</p>
                      <h2>Digite o código</h2>
                    </div>
                  </div>
                  <form onSubmit={verifyCode} noValidate>
                    <TextField
                      label="Código de 6 dígitos"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      error={error}
                      hint={`Enviado para ${email}. Válido por 10 minutos.`}
                      className="track-code-input"
                      onValueChange={(value) => setCode(value.replace(/\D/g, ''))}
                      fullWidth
                    />
                    <button type="submit" disabled={busy}>
                      {busy ? <InlineLoader label="Validando..." /> : <>VER MEUS PEDIDOS <ArrowRight size={17} /></>}
                    </button>
                  </form>
                  <button
                    type="button"
                    className="track-secondary"
                    onClick={() => {
                      setStage('email');
                      setError('');
                    }}
                  >
                    Usar outro e-mail
                  </button>
                </>
              )}

              <Link href="/loja" className="track-back">
                <ArrowLeft size={15} /> Voltar para a loja
              </Link>
            </div>
          </div>
        </div>
      </section>
      <style jsx global>{styles}</style>
    </main>
  );
}

function OrdersView({
  orders,
  identity,
  onExit,
}: {
  orders: OrderSummary[];
  identity: { email: string; source: string } | null;
  onExit: () => void;
}) {
  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(orders, PAGE_SIZE, identity?.email);

  return (
    <main className="track-page">
      <SiteHeader subtitle="MEUS PEDIDOS" />
      <section className="orders-shell" id="lista">
        <div className="orders-head">
          <div>
            <p className="track-eyebrow">2P BOX • PEDIDOS</p>
            <h1>Meus pedidos</h1>
            <p>
              {orders.length} {orders.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'} para{' '}
              <strong>{identity?.email}</strong>
            </p>
          </div>
          {identity?.source === 'verified_code' && (
            <button type="button" className="orders-exit" onClick={onExit}>
              Encerrar consulta
            </button>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="orders-empty">
            <Package size={30} />
            <h2>Nenhum pedido por aqui</h2>
            <p>Não encontramos compras associadas a este e-mail.</p>
            <Link href="/loja" className="orders-cta">
              Conhecer a loja
            </Link>
          </div>
        ) : (
          <>
            <div className="orders-cards">
              {pageItems.map((order) => (
                <Link key={order.id} href={`/pedido/${order.id}`} className="orders-card">
                  <div className="orders-card-main">
                    <small>PEDIDO #{order.id.slice(0, 8).toUpperCase()}</small>
                    <strong>{new Date(order.created_at).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</strong>
                    <span>
                      {order.item_count} {order.item_count === 1 ? 'item' : 'itens'} ·{' '}
                      {order.delivery_type === 'pickup' ? 'Retirada na loja' : 'Entrega via WhatsApp'}
                    </span>
                  </div>
                  <div className="orders-card-side">
                    <b>{money(order.total)}</b>
                    <span className={`orders-badge status-${order.status}`}>
                      <Clock3 size={12} />
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </span>
                    <em className={`orders-payment payment-${order.payment_status}`}>
                      {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
                    </em>
                  </div>
                  <ChevronRight className="orders-card-arrow" size={18} />
                </Link>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="pedidos" scrollTargetId="lista" />
          </>
        )}
      </section>
      <style jsx global>{styles}</style>
    </main>
  );
}

const styles = `
.track-page{--yellow:#ffc400;--gold:#e7ad00;--line:#e7e7e7;min-height:100svh;background:#fff;color:#111;font-family:Inter,Arial,sans-serif;overflow-x:hidden}
.track-container{width:min(1180px,calc(100% - 56px));margin:0 auto}
.track-hero{position:relative;overflow:hidden;background:linear-gradient(105deg,#fff 0%,#fff 63%,#fffdf2 100%);border-bottom:1px solid var(--line);padding:64px 0 80px}
.track-hero:after{content:'';position:absolute;width:520px;height:330px;right:-150px;top:150px;background:radial-gradient(ellipse,rgba(255,196,0,.18),transparent 70%);pointer-events:none}
.track-heading{position:relative;z-index:1;max-width:720px}
.track-eyebrow{margin:0 0 13px;color:#9a7200;font:900 10px Inter,Arial,sans-serif;letter-spacing:.34em}
.track-heading h1{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:clamp(46px,7vw,70px);line-height:.9;letter-spacing:-.025em;font-weight:800;font-style:italic;text-transform:uppercase}
.track-heading h1 em{color:var(--gold);font-style:italic}
.track-lead{max-width:590px;margin:22px 0 0;color:#686868;font-size:15px;line-height:1.65}
.track-layout{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1.25fr;margin-top:50px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.track-side{min-height:340px;padding:34px 55px 34px 0;border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:flex-start}
.track-side-number{color:#a37b00;font:900 9px Inter,Arial,sans-serif;letter-spacing:.18em;margin-bottom:26px}
.track-side svg{margin-bottom:24px}
.track-side h2{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:40px;line-height:.94;text-transform:uppercase;font-style:italic}
.track-side h2 em{color:var(--gold);font-style:italic}
.track-side p{max-width:290px;margin:17px 0 0;color:#777;font-size:12px;line-height:1.55}
.track-card{align-self:center;width:min(560px,calc(100% - 70px));margin-left:70px;padding:34px 36px;background:#fff;border:1px solid #deded9;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.06)}
.track-card-head{display:flex;align-items:center;gap:14px;margin-bottom:24px}
.track-icon{width:48px;height:48px;flex:none;display:grid;place-items:center;background:var(--yellow);border-radius:50%}
.track-card-head p{margin:0 0 4px;color:#9a7200;font:900 8px Inter,Arial,sans-serif;letter-spacing:.18em}
.track-card-head h2{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:27px;line-height:1;text-transform:uppercase;font-style:italic}
.track-card form{display:grid;gap:16px}
.track-card form button{width:100%;min-height:50px;border:0;border-radius:9px;background:var(--yellow);color:#111;display:flex;align-items:center;justify-content:center;gap:9px;font:900 10px Inter,Arial,sans-serif;letter-spacing:.1em;cursor:pointer}
.track-card form button:hover:not(:disabled){background:#111;color:#fff}
.track-card form button:disabled{opacity:.7;cursor:wait}
.track-code-input{text-align:center;letter-spacing:.5em;font-weight:800}
.track-secondary{display:block;width:100%;margin-top:12px;border:0;background:none;color:#777;font:700 11px Inter,Arial,sans-serif;text-decoration:underline;cursor:pointer}
.track-back{display:inline-flex;align-items:center;gap:6px;margin-top:20px;color:#666;text-decoration:none;font:800 10px Inter,Arial,sans-serif}
.orders-shell{width:min(1080px,calc(100% - 48px));margin:0 auto;padding:40px 0 70px}
.orders-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:26px}
.orders-head h1{margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:54px;line-height:.92;text-transform:uppercase;font-style:italic}
.orders-head>div>p:last-child{margin:10px 0 0;color:#777;font-size:13px}
.orders-exit{flex:none;height:42px;padding:0 15px;border:1px solid #dcdcd6;border-radius:9px;background:#fff;color:#111;font:800 11px Inter,Arial,sans-serif;cursor:pointer}
.orders-exit:hover{border-color:#111}
.orders-cards{display:grid;gap:10px}
.orders-card{position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 44px 18px 18px;border:1px solid #e6e6e2;border-radius:12px;background:#fff;text-decoration:none;color:#111;transition:border-color .18s,transform .18s,box-shadow .18s}
.orders-card:hover{border-color:#dcd0a0;transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.06)}
.orders-card-main{display:grid;gap:5px;min-width:0}
.orders-card-main small{font:900 8px Inter,Arial,sans-serif;letter-spacing:.14em;color:#999}
.orders-card-main strong{font-size:14px}
.orders-card-main span{font-size:11px;color:#888}
.orders-card-side{display:grid;justify-items:end;gap:6px;flex:none}
.orders-card-side b{font-size:16px}
.orders-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:20px;background:#f4f4f1;font:800 9px Inter,Arial,sans-serif}
.orders-badge.status-confirmed,.orders-badge.status-completed{background:#e9f7ec;color:#27733b}
.orders-badge.status-cancelled{background:#ffecec;color:#a22}
.orders-payment{font:600 9px Inter,Arial,sans-serif;font-style:normal;color:#8b8b8b}
.orders-payment.payment-paid{color:#27733b}
.orders-payment.payment-failed,.orders-payment.payment-refunded{color:#a22}
.orders-payment.payment-pending{color:#9a7200}
.orders-card-arrow{position:absolute;right:16px;top:50%;transform:translateY(-50%);color:#bbb}
.orders-empty{text-align:center;padding:60px 24px;border:1px dashed #ddd;border-radius:16px;color:#777}
.orders-empty svg{color:#c39a00}
.orders-empty h2{margin:14px 0 6px;font-size:20px;color:#111}
.orders-empty p{margin:0 0 20px;font-size:13px}
.orders-cta{display:inline-flex;align-items:center;justify-content:center;height:46px;padding:0 20px;border-radius:9px;background:var(--yellow);color:#111;text-decoration:none;font:900 11px Inter,Arial,sans-serif}
@media(max-width:900px){
  .track-container{width:min(100% - 36px,660px)}
  .track-hero{padding:44px 0 54px}
  .track-layout{grid-template-columns:1fr;margin-top:36px}
  .track-side{min-height:0;padding:26px 0;border-right:0;border-bottom:1px solid var(--line)}
  .track-side h2{font-size:33px}
  .track-card{width:100%;margin:28px 0 0;padding:26px 22px}
  .orders-shell{width:min(100% - 32px,1080px)}
  .orders-head{align-items:flex-start;flex-direction:column}
  .orders-head h1{font-size:42px}
}
@media(max-width:600px){
  .track-container{width:calc(100% - 28px)}
  .track-heading h1{font-size:clamp(36px,12vw,50px)}
  .track-lead{font-size:13px}
  .track-card{padding:22px 16px}
  .track-card-head h2{font-size:23px}
  .orders-card{align-items:flex-start;flex-direction:column;padding:16px 40px 16px 16px}
  .orders-card-side{justify-items:start}
}`;
