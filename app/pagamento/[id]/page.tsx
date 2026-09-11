'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock3, PackageSearch, RefreshCw, XCircle } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';

const STATUS = {
  paid: {
    title: 'Pagamento confirmado!',
    text: 'Obrigado pela sua compra. O Mercado Pago confirmou o pagamento e a 2P Box já pode seguir com o pedido.',
    icon: CheckCircle2,
  },
  failed: {
    title: 'Pagamento não aprovado',
    text: 'O pagamento não foi aprovado. Você pode tentar novamente com outra forma de pagamento.',
    icon: XCircle,
  },
  refunded: {
    title: 'Pagamento estornado',
    text: 'O valor deste pedido foi estornado. O prazo de devolução segue a sua instituição financeira.',
    icon: XCircle,
  },
  pending: {
    title: 'Pagamento pendente',
    text: 'O pagamento ainda não foi confirmado. Continuaremos consultando automaticamente.',
    icon: Clock3,
  },
} as const;

type PaymentStatus = keyof typeof STATUS;
const TERMINAL: PaymentStatus[] = ['paid', 'failed', 'refunded'];

function normalize(value: string | null): PaymentStatus {
  const status = String(value || '').toLowerCase();
  return status in STATUS ? (status as PaymentStatus) : 'pending';
}

function PaymentResultContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orderId = decodeURIComponent(String(params?.id || ''));
  const toast = useToast();

  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const notified = useRef(false);

  const checkStatus = useCallback(async () => {
    if (!orderId) return;
    setChecking(true);
    try {
      const paymentId = searchParams.get('paymentId') || searchParams.get('mpPaymentId') || '';
      const mpOrderId = searchParams.get('mpOrderId') || '';
      const query = new URLSearchParams({ orderId });
      if (paymentId) query.set('paymentId', paymentId);
      if (mpOrderId) query.set('mpOrderId', mpOrderId);

      const response = await fetch(`/api/mercadopago/payment-status?${query.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'status');
      setStatus(normalize(data.paymentStatus));
      setLastUpdate(new Date());
    } catch {
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, [orderId, searchParams]);

  useEffect(() => {
    if (!orderId) return;
    void checkStatus();
  }, [orderId, checkStatus]);

  useEffect(() => {
    if (!orderId || TERMINAL.includes(status)) return;
    const timer = window.setInterval(() => void checkStatus(), 3000);
    return () => window.clearInterval(timer);
  }, [orderId, status, checkStatus]);

  useEffect(() => {
    if (loading || notified.current || !TERMINAL.includes(status)) return;
    notified.current = true;
    if (status === 'paid') toast.success('Pagamento confirmado!', 'Seu pedido já está em preparação.');
    else if (status === 'failed') toast.error('Pagamento não aprovado', 'Tente outra forma de pagamento.');
    else toast.warning('Pagamento estornado', 'O valor deste pedido foi devolvido.');
  }, [status, loading, toast]);

  if (loading) {
    return (
      <main className="payment-page">
        <SiteHeader subtitle="COMPRA SEGURA" showCart={false} />
        <PageLoader title="Confirmando pagamento" description="Consultando o Mercado Pago em tempo real." />
      </main>
    );
  }

  const config = STATUS[status];
  const Icon = config.icon;
  const terminal = TERMINAL.includes(status);

  return (
    <main className="payment-page">
      <SiteHeader subtitle="COMPRA SEGURA" showCart={false} />

      <section className={`payment-card ${status}`}>
        <div className="payment-icon">
          <Icon size={36} />
        </div>
        <p className="payment-eyebrow">PEDIDO {orderId ? orderId.slice(0, 8).toUpperCase() : 'Não informado'}</p>
        <h1>{config.title}</h1>
        <p className="payment-text">{config.text}</p>

        {!terminal && (
          <div className="payment-sync">
            <div>
              <span className={`sync-dot ${checking ? 'active' : ''}`} />
              <strong>{checking ? 'Consultando pagamento' : 'Acompanhamento automático ativo'}</strong>
            </div>
            <small>Você não precisa atualizar esta página.</small>
          </div>
        )}

        {lastUpdate && !terminal && <small className="payment-updated">Última consulta: {lastUpdate.toLocaleTimeString('pt-BR')}</small>}

        {!terminal && (
          <button className="payment-refresh" type="button" onClick={() => void checkStatus()} disabled={checking}>
            <RefreshCw size={14} className={checking ? 'spin' : ''} /> Atualizar agora
          </button>
        )}

        <div className="payment-actions">
          {status === 'paid' ? (
            <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="payment-primary">
              <PackageSearch size={17} /> Acompanhar pedido
            </Link>
          ) : terminal ? (
            <Link href="/loja" className="payment-primary">
              Tentar novamente
            </Link>
          ) : (
            <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="payment-primary">
              <PackageSearch size={17} /> Acompanhar pedido
            </Link>
          )}
          <Link href="/loja" className="payment-secondary">
            Voltar para a loja
          </Link>
        </div>
      </section>

      <footer className="payment-footer">
        2P BOX <span>•</span> QUALIDADE • VARIEDADE • CONFIANÇA
      </footer>

      <style jsx global>{`
        .payment-page{--yellow:#ffc400;--gold:#9a7200;min-height:100svh;background:#fff;color:#111;display:flex;flex-direction:column;font-family:Inter,Arial,sans-serif;overflow-x:hidden}
        .payment-card{width:min(680px,calc(100% - 40px));margin:44px auto;padding:42px 44px 38px;background:#fff;border:1px solid #e7e7e7;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.06);text-align:center;flex:1;align-self:center;height:max-content}
        .payment-icon{width:68px;height:68px;margin:0 auto 19px;border-radius:50%;display:grid;place-items:center;background:#fff7d5}
        .paid .payment-icon{color:#218b53;background:#eaf8ee}
        .failed .payment-icon,.refunded .payment-icon{background:#fff0f0;color:#c62828}
        .payment-eyebrow{margin:0 0 8px;color:var(--gold);font:900 8px Inter,Arial,sans-serif;letter-spacing:.22em}
        .payment-card h1{margin:0;font-size:clamp(30px,5vw,44px);line-height:1.02;letter-spacing:-.035em}
        .payment-text{max-width:540px;margin:16px auto 0;color:#707070;font-size:13px;line-height:1.6}
        .payment-sync{max-width:470px;margin:21px auto 0;padding:13px 15px;border:1px solid #e8e8df;border-radius:10px;background:#fafaf7;text-align:left}
        .payment-sync>div{display:flex;align-items:center;gap:8px}
        .payment-sync strong{font-size:10px}
        .payment-sync small{display:block;margin-top:5px;color:#777;font-size:9px}
        .sync-dot{width:8px;height:8px;border-radius:50%;background:#d3d3d0;flex:0 0 8px}
        .sync-dot.active{background:var(--yellow)}
        .payment-updated{display:block;margin-top:8px;color:#aaa;font-size:9px}
        .payment-refresh{display:inline-flex;align-items:center;gap:7px;margin-top:12px;padding:9px 13px;border:1px solid #d9d9d4;border-radius:8px;background:#fff;font:800 9px Inter,Arial,sans-serif;cursor:pointer}
        .payment-refresh:disabled{opacity:.6;cursor:wait}
        .payment-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin-top:26px}
        .payment-actions a{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font:900 10px Inter,Arial,sans-serif;letter-spacing:.08em;padding:14px 20px;border-radius:8px}
        .payment-primary{background:var(--yellow);color:#111}
        .payment-primary:hover{background:#111;color:#fff}
        .payment-secondary{border:1px solid #111;color:#111}
        .payment-footer{padding:18px 10px;text-align:center;background:#111;color:#fff;font:900 7px Inter,Arial,sans-serif;letter-spacing:.16em}
        .payment-footer span{color:var(--yellow);margin:0 5px}
        .spin{animation:ui-spin .8s linear infinite}
        @media(max-width:600px){
          .payment-card{width:calc(100% - 24px);margin:22px auto;padding:30px 18px 26px;border-radius:14px}
          .payment-icon{width:60px;height:60px;margin-bottom:16px}
          .payment-text{font-size:12px;margin-top:13px}
          .payment-actions{display:grid;gap:8px;margin-top:21px}
          .payment-actions a{width:100%}
        }
      `}</style>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={<PageLoader title="Confirmando pagamento" description="Consultando o Mercado Pago em tempo real." />}>
      <PaymentResultContent />
    </Suspense>
  );
}
