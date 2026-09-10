'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { OrderTracker, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderHistoryEntry } from '@/components/order-tracker';
import { SelectField } from '@/components/ui/field';
import { PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { formatAddress, formatPaymentMethod, money } from '@/lib/order-format';

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

const STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const load = useCallback(
    async (silent = false) => {
      if (!id || !supabase) return;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const { data, error: orderError } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
        if (orderError) throw orderError;
        if (!data) {
          setError('Pedido não encontrado.');
          return;
        }

        let current = data as Order;
        setError('');

        const email = String(current.customer_email || '').trim();
        if (email) {
          try {
            const response = await fetch(`/api/pedido/status?orderId=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`, { cache: 'no-store' });
            if (response.ok) {
              const payload = await response.json();
              if (payload?.order) current = payload.order as Order;
              setItems((payload?.items ?? []) as Item[]);
              setHistory((payload?.history ?? []) as OrderHistoryEntry[]);
            }
          } catch {}
        }

        setOrder(current);

        if (!email) {
          const { data: itemRows } = await supabase
            .from('order_items')
            .select('product_id,product_name,quantity,unit_price')
            .eq('order_id', id)
            .order('product_name');
          setItems((itemRows || []) as Item[]);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o pedido.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
    if (!id || !supabase) return;

    const channel = supabase
      .channel(`admin-order-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => void load(true))
      .subscribe();
    const timer = window.setInterval(() => void load(true), 10000);

    return () => {
      window.clearInterval(timer);
      supabase?.removeChannel(channel);
    };
  }, [id, load]);

  async function changeStatus(status: string) {
    if (!order || updating || status === order.status) return;
    setUpdating(true);
    try {
      const response = await fetch('/api/admin/pedidos/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Falha ao atualizar o pedido.');
      toast.success('Status atualizado', `${ORDER_STATUS_LABELS[status] || status} · o cliente foi notificado por e-mail.`);
      void load(true);
    } catch (caught) {
      toast.error('Não foi possível atualizar', caught instanceof Error ? caught.message : undefined);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-detail">
        <SiteHeader variant="admin" subtitle="DETALHES DO PEDIDO" />
        <PageLoader title="Carregando pedido" description="Buscando os dados e a movimentação deste pedido." />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="admin-detail">
        <SiteHeader variant="admin" subtitle="DETALHES DO PEDIDO" />
        <div className="detail-error">
          <Package size={34} />
          <h1>{error || 'Pedido não encontrado.'}</h1>
          <Link href="/admin/pedidos">Voltar para pedidos</Link>
        </div>
      </main>
    );
  }

  const paymentStatus = String(order.payment_status || 'pending').toLowerCase();
  const address = formatAddress(order.delivery_address);
  const billedAmount = order.payment_amount ?? order.total;

  return (
    <main className="admin-detail">
      <SiteHeader variant="admin" subtitle="DETALHES DO PEDIDO" />
      <section className="detail-shell">
        <Link href="/admin/pedidos" className="detail-back">
          <ArrowLeft size={16} /> Pedidos
        </Link>

        <div className="detail-top">
          <div>
            <p className="eyebrow">DETALHES DO PEDIDO</p>
            <h1>Pedido #{order.id.slice(0, 8).toUpperCase()}</h1>
            <p className="date">Realizado em {new Date(order.created_at).toLocaleString('pt-BR')}</p>
          </div>
          <div className="detail-top-actions">
            <span className={`order-badge status-${order.status}`}>
              <Clock3 size={15} />
              {ORDER_STATUS_LABELS[order.status] || order.status}
            </span>
            <button type="button" className="refresh" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Atualizar
            </button>
          </div>
        </div>

        <div className="live">
          <span className="live-dot" />
          <strong>Sincronização ativa</strong>
          <span>O pagamento é reconciliado pelo worker e o cliente é notificado a cada mudança.</span>
        </div>

        <div className="status-grid">
          <div className={`status-card status-${order.status}`}>
            <div className="status-icon">
              {order.status === 'cancelled' ? <XCircle size={22} /> : ['confirmed', 'completed'].includes(order.status) ? <CheckCircle2 size={22} /> : <Package size={22} />}
            </div>
            <div>
              <span>Pedido</span>
              <strong>{ORDER_STATUS_LABELS[order.status] || order.status}</strong>
            </div>
          </div>
          <div className="status-card status-action">
            <div className="status-icon">
              <ReceiptText size={22} />
            </div>
            <div className="status-select">
              <span>Alterar status</span>
              <SelectField
                aria-label="Alterar status do pedido"
                value={order.status}
                options={STATUS_OPTIONS}
                disabled={updating}
                onValueChange={changeStatus}
              />
            </div>
          </div>
        </div>

        <OrderTracker status={order.status} history={history} />

        <div className="detail-layout">
          <div className="main-column">
            <section className="card">
              <div className="card-title">
                <Package size={19} />
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
                <p className="muted">Nenhum item encontrado.</p>
              )}
              <div className="total">
                <span>Total do pedido</span>
                <strong>{money(order.total)}</strong>
              </div>
            </section>

            <section className="card">
              <div className="card-title">
                <ReceiptText size={19} />
                <h2>Faturamento</h2>
              </div>
              <dl className="data-list">
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
                  <dd>{money(billedAmount)}</dd>
                </div>
                <div>
                  <dt>Status do pagamento</dt>
                  <dd>{PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus}</dd>
                </div>
                <div>
                  <dt>Detalhe do gateway</dt>
                  <dd>{order.payment_status_detail || '—'}</dd>
                </div>
                <div>
                  <dt>ID do pagamento</dt>
                  <dd className="breakable">{order.payment_id || 'Não informado'}</dd>
                </div>
                <div>
                  <dt>Pago em</dt>
                  <dd>{order.paid_at ? new Date(order.paid_at).toLocaleString('pt-BR') : '—'}</dd>
                </div>
              </dl>
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

          <aside className="side-column">
            <section className="card">
              <div className="card-title">
                <MapPin size={19} />
                <h2>Endereço e recebimento</h2>
              </div>
              <strong className="delivery-label">{order.delivery_type === 'pickup' ? 'Retirada na loja' : 'Entrega — frete pelo WhatsApp'}</strong>
              {address ? (
                <address className="address">{address}</address>
              ) : (
                <p className="muted">{order.delivery_type === 'pickup' ? 'Pedido para retirada na loja, sem endereço de entrega.' : 'Endereço não informado no checkout.'}</p>
              )}
            </section>

            <section className="card">
              <div className="card-title">
                <h2>Dados do cliente</h2>
              </div>
              <dl className="data-list">
                <div>
                  <dt>Nome</dt>
                  <dd>{order.customer_name}</dd>
                </div>
                <div>
                  <dt>
                    <Phone size={11} /> Telefone
                  </dt>
                  <dd>{order.customer_phone}</dd>
                </div>
                <div>
                  <dt>
                    <Mail size={11} /> E-mail
                  </dt>
                  <dd className="breakable">{order.customer_email || 'Não informado'}</dd>
                </div>
              </dl>
              {order.customer_email && (
                <Link
                  href={`/pedido/${order.id}?email=${encodeURIComponent(order.customer_email)}`}
                  target="_blank"
                  className="customer-link"
                >
                  <ExternalLink size={15} /> Abrir página do cliente
                </Link>
              )}
            </section>
          </aside>
        </div>
      </section>

      <style jsx global>{`
        .admin-detail{min-height:100vh;background:#f7f7f5;color:#111;font-family:Inter,Arial,sans-serif}
        .detail-shell{width:min(1080px,calc(100% - 40px));margin:auto;padding:32px 0 70px}
        .detail-back{display:inline-flex;align-items:center;gap:7px;margin-bottom:20px;color:#666;text-decoration:none;font:800 11px Inter,Arial,sans-serif}
        .detail-top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
        .detail-top .eyebrow{margin:0 0 7px;color:#b68c00;font-size:9px;font-weight:900;letter-spacing:.18em}
        .detail-top h1{margin:0;font-size:32px}
        .detail-top .date{margin:7px 0 0;color:#888;font-size:11px}
        .detail-top-actions{display:flex;align-items:center;gap:9px;flex:none}
        .order-badge{display:flex;align-items:center;gap:6px;padding:10px 13px;border-radius:22px;background:#eee;font-size:10px;font-weight:900}
        .status-confirmed,.status-completed{background:#e8f7eb;color:#27733b}
        .status-cancelled{background:#ffeaea;color:#a22}
        .refresh{border:1px solid #ddd;background:#fff;color:#111;border-radius:9px;height:40px;padding:0 13px;display:inline-flex;align-items:center;gap:7px;font:800 10px Inter,Arial,sans-serif;cursor:pointer}
        .refresh:disabled{opacity:.6;cursor:wait}
        .live{display:flex;align-items:center;gap:8px;margin-top:18px;padding:11px 14px;background:#fff;border:1px solid #e4e4df;border-radius:10px;font-size:10px}
        .live-dot{width:8px;height:8px;border-radius:50%;background:#27a45b;box-shadow:0 0 0 4px #e6f6ec;flex:none}
        .status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
        .status-card{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e4e4df;border-radius:11px;padding:16px}
        .status-icon{width:42px;height:42px;border-radius:10px;background:#fff4bf;display:grid;place-items:center;flex:none}
        .status-card.status-confirmed .status-icon,.status-card.status-completed .status-icon{color:#278149;background:#eaf8ee}
        .status-card.status-cancelled .status-icon{color:#a22;background:#fff0f0}
        .status-card>div:last-child{display:grid;gap:4px;min-width:0;flex:1}
        .status-card span,.data-list dt{font-size:8px;color:#999;text-transform:uppercase;letter-spacing:.12em}
        .status-card strong{font-size:12px}
        .status-select span{margin-bottom:2px}
        .status-select .ui-input input,.status-select .ui-input select{height:38px;font-size:12px}
        .detail-layout{display:grid;grid-template-columns:1.55fr .9fr;gap:18px;margin-top:26px}
        .main-column,.side-column{display:grid;align-content:start;gap:18px}
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
        .total strong{font-size:20px}
        .data-list{display:grid;gap:0;margin:0}
        .data-list>div{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid #f2f2ef}
        .data-list>div:last-child{border-bottom:0}
        .data-list dt{display:flex;align-items:center;gap:4px;margin:0;flex:none}
        .data-list dd{margin:0;font:700 12px Inter,Arial,sans-serif;color:#111;text-align:right}
        .data-list .breakable{overflow-wrap:anywhere;text-align:right}
        .delivery-label{display:block;font-size:13px;margin-bottom:10px}
        .address{white-space:pre-line;font:400 12px/1.7 Inter,Arial,sans-serif;font-style:normal;background:#f7f7f5;border-radius:8px;padding:12px;color:#4d4d4d}
        .customer-link{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:100%;height:42px;margin-top:16px;border-radius:9px;background:#ffc400;color:#111;text-decoration:none;font:900 10px Inter,Arial,sans-serif}
        .detail-error{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:#777}
        .detail-error h1{font-size:20px;color:#111}
        .detail-error a{color:#111;font-size:11px;font-weight:900}
        .spin{animation:ui-spin .8s linear infinite}
        @media(max-width:900px){.status-grid{grid-template-columns:1fr}.detail-layout{grid-template-columns:1fr}}
        @media(max-width:700px){
          .detail-shell{width:min(100% - 28px,1080px);padding-top:24px}
          .detail-top{align-items:flex-start;flex-direction:column}
          .detail-top h1{font-size:27px}
          .detail-top-actions{width:100%}
          .refresh{margin-left:auto}
          .card{padding:18px}
          .data-list>div{align-items:flex-start;flex-direction:column;gap:4px}
          .data-list dd{text-align:left}
        }
      `}</style>
    </main>
  );
}
