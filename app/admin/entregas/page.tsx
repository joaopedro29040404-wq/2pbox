'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  Store,
  Truck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { SelectField } from '@/components/ui/field';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { ORDER_STATUS_LABELS } from '@/components/order-tracker';
import { money, shortId } from '@/lib/order-format';
import { toWhatsAppNumber } from '@/lib/masks';

type DeliveryOrder = {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total: number;
  delivery_type: string | null;
  delivery_address: string | null;
  delivery_distance_km?: number | null;
  delivery_fee?: number | null;
  delivery_fee_subsidy?: number | null;
  delivery_provider?: string | null;
  delivery_notes?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
};

type Payload = {
  cycle: { start: string; end: string; hour: number; label: string; isCurrent: boolean };
  totals: {
    count: number;
    byStatus: Record<string, number>;
    revenue: number;
    fees: number;
    subsidy: number;
    pickups: number;
    deliveries: number;
    open: number;
  };
  orders: DeliveryOrder[];
  operations: {
    pickupEnabled: boolean;
    ownDeliveryEnabled: boolean;
    appDeliveryEnabled: boolean;
    subsidyPercent: number;
    maxKm: number;
    addressConfigured: boolean;
  };
};

const PICKUP_FLOW = ['confirmed', 'preparing', 'ready', 'completed'];
const DELIVERY_FLOW = ['confirmed', 'preparing', 'out_for_delivery', 'delivered'];

const LANES = [
  { key: 'confirmed', label: 'A preparar' },
  { key: 'preparing', label: 'Em preparo' },
  { key: 'ready', label: 'Pronto / a caminho' },
  { key: 'done', label: 'Finalizados' },
] as const;

const FILTERS = [
  { value: 'all', label: 'Todas as modalidades' },
  { value: 'pickup', label: 'Somente retirada' },
  { value: 'delivery', label: 'Somente entrega' },
  { value: 'open', label: 'Somente em aberto' },
];

export default function DeliveriesPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(
    async (cycle?: string | null) => {
      setLoading(true);
      try {
        const query = cycle ? `?cycle=${encodeURIComponent(cycle)}` : '';
        const response = await fetch(`/api/admin/entregas${query}`, { cache: 'no-store' });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Falha ao carregar as entregas.');
        const data = (await response.json()) as Payload;
        setPayload(data);
        setCursor(data.cycle.start);
        setAllowed(true);
      } catch (error) {
        toast.error('Não foi possível carregar as entregas', error instanceof Error ? error.message : undefined);
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.href = '/admin/login';
        return;
      }
      if (mounted) await load();
    }

    void boot();
    return () => {
      mounted = false;
    };
  }, [load]);

  async function advance(order: DeliveryOrder) {
    const next = nextStatus(order);
    if (!next) return;

    setBusy(order.id);
    try {
      const response = await fetch('/api/admin/pedidos/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Não foi possível atualizar o pedido.');

      toast.success('Pedido atualizado', `${shortId(order.id)} agora está em "${ORDER_STATUS_LABELS[next] || next}".`);
      await load(cursor);
    } catch (error) {
      toast.error('Não foi possível atualizar', error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const visible = useMemo(() => {
    const orders = payload?.orders || [];
    if (filter === 'pickup') return orders.filter((order) => isPickup(order));
    if (filter === 'delivery') return orders.filter((order) => !isPickup(order));
    if (filter === 'open') return orders.filter((order) => !isDone(order.status));
    return orders;
  }, [payload, filter]);

  const lanes = useMemo(() => {
    const grouped: Record<string, DeliveryOrder[]> = { confirmed: [], preparing: [], ready: [], done: [] };
    for (const order of visible) grouped[laneFor(order.status)].push(order);
    return grouped;
  }, [visible]);

  if (loading && !payload) {
    return (
      <main className="deliveries-page">
        <SiteHeader variant="admin" subtitle="ENTREGAS" />
        <PageLoader title="Carregando entregas" description="Montando o ciclo operacional." />
      </main>
    );
  }

  if (!allowed || !payload) {
    return (
      <main className="deliveries-page">
        <SiteHeader variant="admin" subtitle="ENTREGAS" />
        <section className="deliveries-content">
          <div className="deliveries-alert">
            <ShieldAlert size={30} />
            <h2>Acesso restrito</h2>
            <p>É necessário estar autenticado para acessar as entregas.</p>
            <Link href="/admin/login" className="deliveries-primary">
              Entrar no Admin
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const { cycle, totals, operations } = payload;

  return (
    <main className="deliveries-page">
      <SiteHeader variant="admin" subtitle="ENTREGAS" />
      <section className="deliveries-content">
        <div className="deliveries-heading">
          <div>
            <p className="deliveries-eyebrow">OPERAÇÃO</p>
            <h1>Entregas</h1>
            <p className="deliveries-subtitle">
              O ciclo vira às {String(cycle.hour).padStart(2, '0')}h. Cada ciclo agrupa os pedidos pagos entre uma virada
              e a seguinte.
            </p>
          </div>
          <button className="refresh-button" type="button" onClick={() => void load(cursor)} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> <span>Atualizar</span>
          </button>
        </div>

        <div className="cycle-bar">
          <button type="button" onClick={() => void load(shift(cycle.start, -1))} aria-label="Ciclo anterior">
            <ChevronLeft size={17} />
          </button>
          <div className="cycle-label">
            <strong>{cycle.label}</strong>
            <span>{cycle.isCurrent ? 'Ciclo atual' : 'Ciclo encerrado'}</span>
          </div>
          <button type="button" onClick={() => void load(shift(cycle.start, 1))} aria-label="Próximo ciclo" disabled={cycle.isCurrent}>
            <ChevronRight size={17} />
          </button>
          {!cycle.isCurrent && (
            <button type="button" className="cycle-now" onClick={() => void load(null)}>
              Voltar para o atual
            </button>
          )}
        </div>

        {!operations.addressConfigured && (
          <div className="deliveries-warning">
            <ShieldAlert size={17} />
            <span>
              O endereço da loja não está configurado, então a distância e o valor das entregas não são calculados.{' '}
              <Link href="/admin/configuracoes">Configurar endereço</Link>.
            </span>
          </div>
        )}

        <div className="deliveries-cards">
          <Metric icon={<PackageCheck size={17} />} label="Pedidos no ciclo" value={String(totals.count)} hint={`${totals.open} em aberto`} />
          <Metric icon={<Store size={17} />} label="Retiradas" value={String(totals.pickups)} hint="sem custo de entrega" />
          <Metric icon={<Bike size={17} />} label="Entregas" value={String(totals.deliveries)} hint={`raio de ${operations.maxKm} km`} />
          <Metric icon={<Truck size={17} />} label="Frete cobrado" value={money(totals.fees)} hint={`loja absorveu ${money(totals.subsidy)}`} />
        </div>

        <div className="deliveries-filter">
          <SelectField aria-label="Filtrar modalidade" value={filter} options={FILTERS} onValueChange={setFilter} fullWidth />
        </div>

        {visible.length === 0 ? (
          <div className="deliveries-empty">
            <Bike size={30} />
            <h3>Nenhum pedido neste ciclo</h3>
            <p>Os pedidos pagos aparecem aqui automaticamente na virada do ciclo.</p>
          </div>
        ) : (
          <div className="lanes">
            {LANES.map((lane) => (
              <section key={lane.key} className="lane">
                <header>
                  <h2>{lane.label}</h2>
                  <span>{lanes[lane.key].length}</span>
                </header>

                <div className="lane-body">
                  {lanes[lane.key].length === 0 ? (
                    <p className="lane-empty">Vazio</p>
                  ) : (
                    lanes[lane.key].map((order) => {
                      const next = nextStatus(order);
                      const whatsapp = toWhatsAppNumber(order.customer_phone || '');
                      return (
                        <article key={order.id} className="delivery-card">
                          <div className="delivery-top">
                            <Link href={`/admin/pedidos/${order.id}`} className="delivery-id">
                              {shortId(order.id)}
                            </Link>
                            <span className={`delivery-mode ${isPickup(order) ? 'is-pickup' : 'is-delivery'}`}>
                              {isPickup(order) ? <Store size={12} /> : <Bike size={12} />}
                              {isPickup(order) ? 'Retirada' : 'Entrega'}
                            </span>
                          </div>

                          <strong className="delivery-name">{order.customer_name || 'Cliente'}</strong>
                          <span className="delivery-time">{hour(order.created_at)} • {money(order.total)}</span>

                          {!isPickup(order) && order.delivery_address && (
                            <p className="delivery-address">
                              <MapPin size={12} /> {order.delivery_address}
                            </p>
                          )}

                          {order.delivery_distance_km != null && (
                            <p className="delivery-meta">
                              {Number(order.delivery_distance_km).toFixed(1)} km
                              {order.delivery_fee != null ? ` • frete ${money(order.delivery_fee)}` : ''}
                            </p>
                          )}

                          <div className="delivery-actions">
                            {next ? (
                              <button type="button" onClick={() => void advance(order)} disabled={busy === order.id}>
                                {busy === order.id ? <InlineLoader /> : <>{ORDER_STATUS_LABELS[next] || next}</>}
                              </button>
                            ) : (
                              <span className="delivery-final">{ORDER_STATUS_LABELS[order.status] || order.status}</span>
                            )}
                            {whatsapp && (
                              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp">
                                <MessageCircle size={15} />
                              </a>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <style jsx global>{`
        .deliveries-page{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}
        .deliveries-content{width:min(1320px,calc(100% - 40px));margin:0 auto;padding:44px 0 80px}
        .deliveries-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:26px;margin-bottom:26px}
        .deliveries-eyebrow{margin:0 0 12px;color:#9a7200;font:900 10px Inter,Arial,sans-serif;letter-spacing:.3em}
        .deliveries-heading h1{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:66px;line-height:.86;letter-spacing:-.025em;font-style:italic;text-transform:uppercase}
        .deliveries-subtitle{max-width:640px;margin:15px 0 0;color:#747474;font-size:14px;line-height:1.6}
        .refresh-button{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:0 17px;border:1px solid #dcdcd6;border-radius:10px;background:#fff;font:800 11.5px Inter,Arial,sans-serif;cursor:pointer;flex:none}
        .refresh-button:hover:not(:disabled){border-color:#111}
        .refresh-button .spin{animation:deliveries-spin 1s linear infinite}
        @keyframes deliveries-spin{to{transform:rotate(360deg)}}
        .cycle-bar{display:flex;align-items:center;gap:12px;margin-bottom:18px;padding:13px 16px;background:#fff;border:1px solid #e2e2dc;border-radius:14px}
        .cycle-bar>button{display:grid;place-items:center;width:38px;height:38px;flex:none;border:1px solid #e2e2dc;border-radius:9px;background:#fff;cursor:pointer}
        .cycle-bar>button:hover:not(:disabled){border-color:#111}
        .cycle-bar>button:disabled{opacity:.35;cursor:not-allowed}
        .cycle-label{display:grid;gap:2px}
        .cycle-label strong{font:900 19px 'Barlow Condensed',Inter,sans-serif;letter-spacing:.01em}
        .cycle-label span{font:800 9.5px Inter,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8a8a86}
        .cycle-now{margin-left:auto;min-height:38px;padding:0 14px;border:0;border-radius:9px;background:#111;color:#fff;font:800 11px Inter,Arial,sans-serif;cursor:pointer}
        .deliveries-warning{display:flex;align-items:flex-start;gap:10px;margin-bottom:18px;padding:14px 16px;background:#fff9d9;border:1px solid #f0d65b;border-radius:12px;color:#5c5000;font-size:12.5px;line-height:1.55}
        .deliveries-warning svg{flex:none;color:#a47700;margin-top:1px}
        .deliveries-warning a{color:#5c5000;font-weight:800}
        .deliveries-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}
        .metric{padding:17px 18px;background:#fff;border:1px solid #e2e2dc;border-radius:14px}
        .metric-top{display:flex;align-items:center;gap:8px;color:#9a7200}
        .metric-top span{font:900 9px Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8a8a86}
        .metric strong{display:block;margin:9px 0 3px;font:900 30px 'Barlow Condensed',Inter,sans-serif;line-height:1}
        .metric small{color:#8a8a86;font-size:10.5px}
        .deliveries-filter{max-width:330px;margin-bottom:18px}
        .deliveries-empty{padding:60px 30px;background:#fff;border:1px solid #e2e2dc;border-radius:18px;text-align:center;color:#777}
        .deliveries-empty svg{color:#c9c9c2}
        .deliveries-empty h3{margin:14px 0 6px;font-family:'Barlow Condensed',Inter,sans-serif;font-size:28px;text-transform:uppercase;color:#111}
        .deliveries-empty p{margin:0;font-size:13px}
        .lanes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:start}
        .lane{background:#fff;border:1px solid #e2e2dc;border-radius:16px;overflow:hidden}
        .lane>header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 17px;border-bottom:1px solid #eee}
        .lane>header h2{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:20px;text-transform:uppercase;letter-spacing:.01em}
        .lane>header span{min-width:26px;padding:4px 8px;border-radius:999px;background:#f2f2ef;text-align:center;font:900 10px Inter,Arial,sans-serif;color:#666}
        .lane-body{display:grid;gap:11px;padding:14px}
        .lane-empty{margin:0;padding:18px 0;text-align:center;color:#b5b5b0;font:800 10px Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}
        .delivery-card{display:grid;gap:5px;padding:14px;background:#fafaf7;border:1px solid #ececE4;border-radius:12px}
        .delivery-top{display:flex;align-items:center;justify-content:space-between;gap:9px}
        .delivery-id{font:900 12px ui-monospace,Menlo,monospace;color:#111;text-decoration:none;letter-spacing:.04em}
        .delivery-id:hover{color:#9a7200}
        .delivery-mode{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;font:800 9px Inter,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
        .delivery-mode.is-pickup{background:#eef3ff;color:#33518f}
        .delivery-mode.is-delivery{background:#fff2d9;color:#8a6d00}
        .delivery-name{font:800 13.5px Inter,Arial,sans-serif;overflow-wrap:anywhere}
        .delivery-time{font-size:11px;color:#8a8a86}
        .delivery-address{display:flex;align-items:flex-start;gap:5px;margin:3px 0 0;font-size:11px;line-height:1.45;color:#5d5d5d}
        .delivery-address svg{flex:none;margin-top:2px;color:#a58a2e}
        .delivery-meta{margin:0;font:700 11px Inter,Arial,sans-serif;color:#5d5d5d}
        .delivery-actions{display:flex;align-items:center;gap:8px;margin-top:7px}
        .delivery-actions button{flex:1;min-height:40px;border:0;border-radius:9px;background:#ffc400;color:#111;font:900 10.5px Inter,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
        .delivery-actions button:hover:not(:disabled){background:#111;color:#fff}
        .delivery-actions button:disabled{opacity:.7;cursor:wait}
        .delivery-actions a{display:grid;place-items:center;width:40px;height:40px;flex:none;border:1px solid #dcdcd6;border-radius:9px;background:#fff;color:#25651f}
        .delivery-actions a:hover{border-color:#25651f}
        .delivery-final{flex:1;padding:11px 0;text-align:center;font:800 10px Inter,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#3f7a4d}
        .deliveries-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border:0;border-radius:10px;background:#ffc400;color:#111;text-decoration:none;font:900 12px Inter,Arial,sans-serif;cursor:pointer}
        .deliveries-alert{max-width:520px;margin:60px auto;padding:38px;background:#fff;border:1px solid #e5e5e5;border-radius:20px;text-align:center}
        .deliveries-alert svg{color:#a52626}
        .deliveries-alert h2{margin:13px 0 7px;font-family:'Barlow Condensed',Inter,sans-serif;font-size:36px;text-transform:uppercase}
        .deliveries-alert p{color:#777;font-size:13px;margin:0 0 20px}
        @media(max-width:1120px){
          .deliveries-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
          .lanes{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media(max-width:760px){
          .deliveries-content{width:min(100% - 28px,720px);padding:30px 0 60px}
          .deliveries-heading{align-items:flex-start;flex-direction:column;gap:16px}
          .deliveries-heading h1{font-size:46px}
          .refresh-button{width:100%}
          .deliveries-cards,.lanes{grid-template-columns:1fr}
          .deliveries-filter{max-width:none}
          .cycle-bar{flex-wrap:wrap}
          .cycle-now{margin-left:0;width:100%}
        }
      `}</style>
    </main>
  );
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="metric">
      <div className="metric-top">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function isPickup(order: DeliveryOrder) {
  return String(order.delivery_type || 'pickup') === 'pickup';
}

function isDone(status: string) {
  return ['delivered', 'completed', 'cancelled'].includes(String(status || ''));
}

function laneFor(status: string): 'confirmed' | 'preparing' | 'ready' | 'done' {
  const value = String(status || '');
  if (isDone(value)) return 'done';
  if (value === 'preparing') return 'preparing';
  if (value === 'ready' || value === 'out_for_delivery') return 'ready';
  return 'confirmed';
}

function nextStatus(order: DeliveryOrder) {
  const flow = isPickup(order) ? PICKUP_FLOW : DELIVERY_FLOW;
  const current = String(order.status || 'pending');
  if (current === 'pending') return flow[0];

  const index = flow.indexOf(current);
  if (index < 0 || index === flow.length - 1) return null;
  return flow[index + 1];
}

function shift(start: string, days: number) {
  const date = new Date(start);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function hour(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
