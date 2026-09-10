'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Store,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { SelectField, TextField } from '@/components/ui/field';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { InlineLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/components/order-tracker';

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  delivery_type: string;
  status: string;
  payment_status?: string | null;
  payment_id?: string | null;
  payment_type?: string | null;
  payment_method?: string | null;
  total: number;
  notes?: string | null;
  created_at: string;
};
type Item = { order_id: string; product_name: string; quantity: number; total: number };

const STATUS_ICONS: Record<string, typeof Clock3> = {
  pending: Clock3,
  confirmed: CheckCircle2,
  preparing: PackageCheck,
  ready: Store,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const FILTER_OPTIONS = [{ value: 'all', label: 'Todos os status' }, ...STATUS_OPTIONS];
const TERMINAL_PAYMENTS = new Set(['approved', 'rejected', 'cancelled']);
const PAGE_SIZE = 8;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const lastReconcile = useRef(0);
  const loadSequence = useRef(0);
  const mounted = useRef(true);
  const toast = useToast();

  async function reconcilePayments(currentOrders: Order[]) {
    const now = Date.now();
    if (now - lastReconcile.current < 8000) return;
    const candidates = currentOrders.filter((order) => !TERMINAL_PAYMENTS.has(String(order.payment_status || 'pending').toLowerCase()));
    if (!candidates.length) return;
    lastReconcile.current = now;

    await Promise.allSettled(
      candidates.map(async (order) => {
        const params = new URLSearchParams({ orderId: order.id });
        if (order.payment_id) params.set('paymentId', order.payment_id);
        const response = await fetch(`/api/mercadopago/payment-status?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!mounted.current || !data?.paymentStatus) return;
        const incoming = String(data.paymentStatus).toLowerCase();
        setOrders((previous) =>
          previous.map((current) => {
            if (current.id !== order.id) return current;
            const existing = String(current.payment_status || 'pending').toLowerCase();
            if (TERMINAL_PAYMENTS.has(existing) && existing !== incoming) return current;
            return {
              ...current,
              payment_status: data.paymentStatus || current.payment_status,
              status: data.orderStatus || current.status,
              payment_id: data.paymentId || current.payment_id,
              payment_type: data.paymentType || current.payment_type,
              payment_method: data.paymentMethod || current.payment_method,
            };
          }),
        );
      }),
    );
  }

  async function load(silent = false) {
    if (!supabase) return;
    const sequence = ++loadSequence.current;
    if (!silent) setLoading(true);

    const [{ data: orderRows, error }, { data: itemRows, error: itemsError }] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('order_items').select('order_id,product_name,quantity,total'),
    ]);

    if (!mounted.current || sequence !== loadSequence.current) return;
    if (error) toast.error('Não foi possível carregar os pedidos', error.message);
    else {
      const next = (orderRows ?? []) as Order[];
      setOrders(next);
      void reconcilePayments(next);
    }
    if (itemsError) toast.error('Não foi possível carregar os itens', itemsError.message);
    else setItems((itemRows ?? []) as Item[]);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    if (!supabase) return;

    const channel = supabase
      .channel('admin-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => void load(true))
      .subscribe();
    const timer = window.setInterval(() => void load(true), 8000);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  async function change(order: Order, status: string) {
    if (status === order.status || updating) return;
    setUpdating(order.id);
    try {
      const response = await fetch('/api/admin/pedidos/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Falha ao atualizar o pedido.');
      setOrders((previous) => previous.map((item) => (item.id === order.id ? { ...item, status } : item)));
      toast.success('Pedido atualizado', `#${order.id.slice(0, 8).toUpperCase()} · ${ORDER_STATUS_LABELS[status] || status}`);
      void load(true);
    } catch (error) {
      toast.error('Não foi possível atualizar', error instanceof Error ? error.message : undefined);
    } finally {
      setUpdating(null);
    }
  }

  const money = (value: number) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.customer_name.toLowerCase().includes(query) ||
        order.customer_phone.toLowerCase().includes(query) ||
        (order.customer_email || '').toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query);
      return matchesSearch && (filter === 'all' || order.status === filter);
    });
  }, [orders, search, filter]);

  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(filtered, PAGE_SIZE, `${search}|${filter}`);

  return (
    <main className="admin-orders">
      <SiteHeader variant="admin" subtitle="PEDIDOS" />
      <section className="orders-content" id="lista-pedidos">
        <div className="orders-heading">
          <div>
            <p className="orders-eyebrow">VENDAS</p>
            <h1>Pedidos</h1>
            <p className="orders-subtitle">Pedidos e pagamentos sincronizados automaticamente pelo worker de mensageria.</p>
          </div>
          <div className="orders-side">
            <div className="orders-count">
              <strong>{orders.length}</strong>
              <span>pedidos</span>
            </div>
            <button className="refresh-button" type="button" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} /> <span>Atualizar</span>
            </button>
          </div>
        </div>

        <div className="orders-toolbar">
          <TextField
            aria-label="Buscar pedido"
            placeholder="Buscar por cliente, telefone, e-mail ou pedido..."
            value={search}
            icon={<Search size={17} />}
            onValueChange={setSearch}
            fullWidth
          />
          <SelectField aria-label="Filtrar por status" value={filter} options={FILTER_OPTIONS} onValueChange={setFilter} />
        </div>

        {loading ? (
          <div className="admin-empty">
            <InlineLoader label="Carregando pedidos..." />
          </div>
        ) : pageItems.length === 0 ? (
          <div className="admin-empty">
            <PackageCheck size={30} />
            <h3>{orders.length ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}</h3>
            <p>{orders.length ? 'Tente alterar a busca ou o filtro.' : 'Os novos pedidos aparecerão aqui automaticamente.'}</p>
          </div>
        ) : (
          <>
            <div className="orders-list">
              {pageItems.map((order) => {
                const StatusIcon = STATUS_ICONS[order.status] || Clock3;
                const orderItems = items.filter((item) => item.order_id === order.id);
                const payment = String(order.payment_status || 'pending');
                return (
                  <article className="order-card" key={order.id}>
                    <div className="order-card-top">
                      <div className="order-main">
                        <div className="order-number">
                          PEDIDO <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                        </div>
                        <h2>{order.customer_name}</h2>
                        <p className="order-contact">
                          {order.customer_phone}
                          {order.customer_email ? ` • ${order.customer_email}` : ''}
                        </p>
                        <time>{new Date(order.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
                        <Link href={`/admin/pedidos/${order.id}`} className="order-open">
                          <ExternalLink size={14} /> Ver detalhes completos
                        </Link>
                      </div>
                      <div className="order-status">
                        <div className={`status-badge status-${order.status}`}>
                          <StatusIcon size={15} />
                          {ORDER_STATUS_LABELS[order.status] || order.status}
                        </div>
                        <div className={`payment-badge payment-${payment}`}>
                          <CreditCard size={13} />
                          {PAYMENT_STATUS_LABELS[payment] || payment}
                        </div>
                        <SelectField
                          aria-label="Alterar status do pedido"
                          value={order.status}
                          options={STATUS_OPTIONS}
                          disabled={updating === order.id}
                          onValueChange={(value) => void change(order, value)}
                        />
                      </div>
                    </div>

                    <div className="order-divider" />

                    <div className="order-details">
                      <div className="order-items">
                        {orderItems.map((item, index) => (
                          <div className="order-item" key={`${order.id}-${index}`}>
                            <span>
                              <b>{item.quantity}×</b> {item.product_name}
                            </span>
                            <strong>{money(item.total)}</strong>
                          </div>
                        ))}
                        {order.notes && (
                          <div className="order-note">
                            <b>Observações:</b> {order.notes}
                          </div>
                        )}
                      </div>
                      <div className="order-summary">
                        <div className="delivery-method">
                          {order.delivery_type === 'pickup' ? (
                            <>
                              <Store size={17} />
                              <span>
                                <b>Retirada na loja</b>
                                <small>Sem custo de entrega</small>
                              </span>
                            </>
                          ) : (
                            <>
                              <MessageCircle size={17} />
                              <span>
                                <b>Frete via WhatsApp</b>
                                <small>Combinar valor da entrega</small>
                              </span>
                            </>
                          )}
                        </div>
                        <div className="order-total">
                          <span>Total</span>
                          <strong>{money(order.total)}</strong>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="pedidos" scrollTargetId="lista-pedidos" />
          </>
        )}
      </section>

      <style jsx global>{`
        .admin-orders{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}
        .orders-content{width:min(1180px,calc(100% - 40px));margin:auto;padding:38px 0 70px}
        .orders-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:26px}
        .orders-eyebrow{margin:0 0 8px;color:#a07800;font-size:10px;font-weight:900;letter-spacing:.22em}
        .orders-heading h1{font-family:'Barlow Condensed';font-size:64px;line-height:.86;text-transform:uppercase;font-style:italic;margin:0}
        .orders-subtitle{color:#777;max-width:560px;margin:12px 0 0;font-size:13px}
        .orders-side{display:flex;align-items:center;gap:9px;flex:none}
        .orders-count{display:flex;align-items:baseline;gap:8px;border:1px solid #ddd;background:#fff;border-radius:12px;padding:12px 16px}
        .orders-count strong{font-size:23px}
        .orders-count span{font-size:10px;color:#777}
        .refresh-button{height:48px;padding:0 15px;border:1px solid #111;border-radius:11px;background:#111;color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:800 11px Inter,Arial,sans-serif;cursor:pointer}
        .refresh-button:disabled{opacity:.6;cursor:wait}
        .orders-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:10px;align-items:end;margin-bottom:20px}
        .orders-list{display:grid;gap:12px}
        .order-card{background:#fff;border:1px solid #e1e1dc;border-radius:16px;padding:20px;box-shadow:0 4px 16px rgba(0,0,0,.025)}
        .order-card-top{display:flex;justify-content:space-between;gap:20px}
        .order-number{font-size:9px;letter-spacing:.14em;color:#888;text-transform:uppercase}
        .order-number strong{color:#111}
        .order-main h2{font-size:21px;margin:7px 0 3px}
        .order-contact{margin:0;color:#666;font-size:12px;overflow-wrap:anywhere}
        .order-main time{display:block;color:#999;font-size:10px;margin-top:7px}
        .order-open{display:inline-flex;align-items:center;gap:6px;margin-top:11px;color:#111;text-decoration:none;font-size:10px;font-weight:900}
        .order-open:hover{text-decoration:underline}
        .order-status{width:220px;display:grid;gap:7px;align-content:start;flex:none}
        .status-badge,.payment-badge{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;padding:8px 10px;font-size:10px;font-weight:800;background:#f3f3f0}
        .status-pending,.payment-pending{background:#fff5cc}
        .status-confirmed,.payment-approved{background:#eaf7df;color:#27733b}
        .status-preparing{background:#e9f1ff}
        .status-ready{background:#fff0c2}
        .status-completed{background:#e3f6e9}
        .status-cancelled,.payment-rejected,.payment-cancelled{background:#ffe7e7;color:#a22}
        .payment-in_process{background:#fff4d4;color:#8b6a00}
        .payment-authorized{background:#e9f1ff;color:#2e5f96}
        .order-divider{height:1px;background:#ededeb;margin:17px 0}
        .order-details{display:grid;grid-template-columns:1.5fr 1fr;gap:24px}
        .order-item{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:12px}
        .order-item b{color:#555}
        .order-note{margin-top:10px;padding:10px 12px;background:#f8f8f5;border-radius:8px;font-size:11px;color:#555}
        .order-summary{border-left:1px solid #ededeb;padding-left:24px;display:flex;flex-direction:column;justify-content:space-between;gap:18px}
        .delivery-method{display:flex;align-items:center;gap:9px}
        .delivery-method svg{color:#e8aa00;flex:none}
        .delivery-method span{display:grid;gap:2px}
        .delivery-method b{font-size:11px}
        .delivery-method small{font-size:9px;color:#888}
        .order-total{display:flex;justify-content:space-between;align-items:end}
        .order-total span{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#888}
        .order-total strong{font-size:23px}
        .admin-empty{min-height:240px;border:1px dashed #d5d5d0;background:#fff;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;color:#777}
        .admin-empty h3{margin:10px 0 2px;color:#222}
        .admin-empty p{margin:0;font-size:12px}
        .spin{animation:ui-spin .8s linear infinite}
        @media(max-width:860px){
          .orders-content{width:min(100% - 28px,760px)}
          .orders-heading{align-items:flex-start;flex-direction:column;margin-bottom:20px}
          .orders-heading h1{font-size:52px}
          .orders-side{width:100%}
          .orders-count{flex:1;justify-content:center}
          .orders-toolbar{grid-template-columns:1fr}
          .order-card{padding:16px}
          .order-card-top{flex-direction:column}
          .order-status{width:100%}
          .order-details{grid-template-columns:1fr;gap:16px}
          .order-summary{border-left:0;border-top:1px solid #ededeb;padding-left:0;padding-top:15px}
        }
        @media(max-width:520px){
          .orders-content{padding-top:28px}
          .orders-heading h1{font-size:46px}
          .order-main h2{font-size:19px}
          .order-total strong{font-size:21px}
        }
      `}</style>
    </main>
  );
}
