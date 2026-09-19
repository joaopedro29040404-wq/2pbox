'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, CheckCircle2, Eye, Funnel, MousePointerClick, ShoppingCart, Smartphone, Users, WalletCards, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { useToast } from '@/components/ui/toast';

const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const presets = ['today', 'yesterday', '7d', '30d', 'custom'] as const;
type Preset = typeof presets[number];
type Analytics = any;
type RecentOrder = { id: string; total: number; status: string; payment_status: string | null; created_at: string; is_test: boolean };

function rangeFor(preset: Preset, from: string, to: string) {
  if (preset === 'custom') return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59.999`) };
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  if (preset === 'today') return { start, end };
  if (preset === 'yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); return { start, end }; }
  start.setDate(start.getDate() - (preset === '7d' ? 6 : 29));
  return { start, end };
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Analytics | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTest, setUpdatingTest] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const range = rangeFor(preset, from, to);
    const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() });
    try {
      const [analyticsResponse, ordersResult] = await Promise.all([
        fetch(`/api/admin/analytics?${params.toString()}`, { cache: 'no-store' }),
        supabase ? supabase.from('orders').select('id,total,status,payment_status,created_at,is_test').gte('created_at', range.start.toISOString()).lt('created_at', range.end.toISOString()).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null } as any),
      ]);
      const result = await analyticsResponse.json();
      if (!analyticsResponse.ok) throw new Error(result?.error || 'Não foi possível carregar o Analytics.');
      if (ordersResult.error) throw new Error(ordersResult.error.message);
      setData(result);
      setRecentOrders((ordersResult.data || []) as RecentOrder[]);
    } catch (error) {
      toast.error('Analytics indisponível', error instanceof Error ? error.message : undefined);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [preset, from, to]);

  async function toggleTest(orderId: string, isTest: boolean) {
    setUpdatingTest(orderId);
    try {
      if (!supabase) throw new Error('Supabase indisponível.');
      const { error } = await supabase.from('orders').update({ is_test: !isTest }).eq('id', orderId);
      if (error) throw new Error(error.message);
      toast.success(!isTest ? 'Pedido marcado como teste' : 'Pedido voltou para vendas reais');
      void load();
    } catch (error) { toast.error('Não foi possível atualizar', error instanceof Error ? error.message : undefined); }
    finally { setUpdatingTest(null); }
  }

  const maxEvolution = useMemo(() => Math.max(1, ...(data?.evolution || []).map((row: any) => Number(row.visitors || 0))), [data]);
  const maxHour = useMemo(() => Math.max(1, ...(data?.hours || []).map((row: any) => Number(row.visitors || 0))), [data]);
  const cards = data ? [['Visitantes', data.cards.visitors, Users], ['Visualizações de produtos', data.cards.productViews, Eye], ['Central de impressão', data.cards.printPageViews, Printer], ['Adições ao carrinho', data.cards.cartAdds, ShoppingCart], ['Checkouts iniciados', data.cards.checkouts, Funnel], ['Pagamentos iniciados', data.cards.payments, WalletCards], ['Pedidos aprovados', data.cards.approvedOrders, CheckCircle2], ['Faturamento', money(data.cards.revenue), BarChart3], ['Ticket médio', money(data.cards.averageTicket), WalletCards], ['Taxa de conversão', `${Number(data.cards.conversionRate || 0).toFixed(2).replace('.', ',')}%`, MousePointerClick]] : [];

  return (
    <main className="analytics-page">
      <SiteHeader variant="admin" subtitle="ANALYTICS" />
      <section className="analytics-shell">
        <Link href="/admin" className="analytics-back"><ArrowLeft size={16} /> Painel</Link>
        <header className="analytics-head"><div><p>ANALYTICS</p><h1>Visão do e-commerce</h1><span>Do primeiro acesso à compra aprovada, sem interferir no fluxo de pagamento.</span></div><div className="analytics-live"><i /> Dados do período</div></header>
        <div className="analytics-period"><div className="period-buttons">{presets.map((item) => <button key={item} className={preset === item ? 'active' : ''} onClick={() => setPreset(item)}>{item === 'today' ? 'Hoje' : item === 'yesterday' ? 'Ontem' : item === '7d' ? 'Últimos 7 dias' : item === '30d' ? 'Últimos 30 dias' : 'Personalizado'}</button>)}</div>{preset === 'custom' && <div className="period-custom"><label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>}</div>
        {loading && !data ? <div className="analytics-loading">Carregando dados...</div> : data && <>
          <div className="analytics-cards">{cards.map(([label, value, Icon]: any) => <article className="analytics-card" key={label}><div><span>{label}</span><b><Icon size={17} /></b></div><strong>{value}</strong></article>)}</div><section className="analytics-section print-analytics"><div className="section-title"><div><p>CENTRAL DE IMPRESSÃO</p><h2>Interesse no serviço</h2></div><Link href="/admin/impressao/pedidos">Abrir pedidos de impressão</Link></div><div className="sales-grid print-metrics"><div><span>Visitas à página</span><b>{data.cards.printPageViews}</b></div><div><span>Visitantes únicos</span><b>{data.cards.printPageVisitors}</b></div><div><span>Pedidos de impressão</span><b>{data.sales.printOrders}</b></div><div><span>Valor aprovado</span><b>{money(data.sales.printRevenue)}</b></div></div></section>
          <section className="analytics-section"><div className="section-title"><div><p>EVOLUÇÃO</p><h2>Comportamento no período</h2></div><span>visitantes · carrinhos · pedidos · faturamento</span></div><div className="evolution-chart">{data.evolution.length === 0 ? <div className="analytics-empty">Ainda não há eventos neste período.</div> : data.evolution.map((row: any) => <div className="evolution-day" key={row.date}><div className="evolution-bars"><i style={{ height: `${Math.max(4, (row.visitors / maxEvolution) * 100)}%` }} /><i style={{ height: `${Math.max(3, (row.carts / maxEvolution) * 100)}%` }} /><i style={{ height: `${Math.max(3, (row.orders / maxEvolution) * 100)}%` }} /></div><small>{new Date(`${row.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</small><b>{money(row.revenue)}</b></div>)}</div></section>
          <div className="analytics-two-col"><section className="analytics-section"><div className="section-title"><div><p>FUNIL</p><h2>Conversão</h2></div></div><div className="funnel">{data.funnel.map((stage: any) => <div className="funnel-row" key={stage.key}><div className="funnel-main"><strong>{stage.label}</strong><span>{stage.count.toLocaleString('pt-BR')} · {stage.percent.toFixed(1).replace('.', ',')}% dos visitantes</span></div><div className="funnel-meta"><b>{stage.nextConversion == null ? '—' : `${stage.nextConversion.toFixed(1).replace('.', ',')}%`}</b><small>{stage.nextConversion == null ? 'final' : `${stage.abandonment.toLocaleString('pt-BR')} abandonaram`}</small></div></div>)}</div></section><section className="analytics-section"><div className="section-title"><div><p>TRÁFEGO</p><h2>Origem das visitas</h2></div></div><div className="table-wrap"><table><thead><tr><th>Origem</th><th>Visitas</th><th>Car.</th><th>Check.</th><th>Pedidos</th><th>Faturamento</th></tr></thead><tbody>{data.traffic.map((row: any) => <tr key={row.source}><td>{row.source}</td><td>{row.visits}</td><td>{row.carts}</td><td>{row.checkouts}</td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}</tbody></table></div></section></div>
          <section className="analytics-section"><div className="section-title"><div><p>PRODUTOS</p><h2>Interesse e vendas</h2></div><Link href="/admin/produtos">Ver catálogo</Link></div><div className="table-wrap"><table><thead><tr><th>Produto</th><th>Visualizações</th><th>Carrinhos</th><th>Vendidos</th><th>Conversão</th></tr></thead><tbody>{data.products.map((row: any) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.views}</td><td>{row.carts}</td><td>{row.sales}</td><td>{Number(row.conversion || 0).toFixed(2).replace('.', ',')}%</td></tr>)}</tbody></table>{data.products.length === 0 && <div className="analytics-empty">Nenhum produto recebeu eventos no período.</div>}</div></section>
          <div className="analytics-three-col"><section className="analytics-section compact"><div className="section-title"><div><p>CARRINHOS</p><h2>Abandono</h2></div></div><div className="big-metric">{data.abandoned.abandoned}<small>abandonados</small></div><div className="metric-lines"><span>Criados <b>{data.abandoned.carts}</b></span><span>Taxa <b>{Number(data.abandoned.rate).toFixed(1).replace('.', ',')}%</b></span><span>Valor estimado <b>{money(data.abandoned.value)}</b></span></div></section><section className="analytics-section compact"><div className="section-title"><div><p>DISPOSITIVOS</p><h2>Acessos</h2></div></div>{data.devices.map((row: any) => <div className="simple-line" key={row.device}><span><Smartphone size={14} />{row.device === 'mobile' ? 'Celular' : row.device === 'tablet' ? 'Tablet' : row.device === 'desktop' ? 'Computador' : 'Outro'}</span><b>{row.visitors}</b></div>)}</section><section className="analytics-section compact"><div className="section-title"><div><p>HORÁRIOS</p><h2>Picos</h2></div></div><div className="hour-chart">{data.hours.filter((row: any) => row.visitors > 0 || row.orders > 0).map((row: any) => <div key={row.hour}><i style={{ height: `${Math.max(5, row.visitors / maxHour * 100)}%` }} /><small>{String(row.hour).padStart(2, '0')}h</small></div>)}</div></section></div>
          <section className="analytics-section"><div className="section-title"><div><p>VENDAS</p><h2>Resumo</h2></div><Link href="/admin/pedidos">Abrir pedidos</Link></div><div className="sales-grid"><div><span>Pedidos</span><b>{data.sales.orders}</b></div><div><span>Aprovados</span><b>{data.sales.approved}</b></div><div><span>Cancelados</span><b>{data.sales.canceled}</b></div><div><span>Produtos vendidos</span><b>{data.sales.productsSold}</b></div><div><span>Faturamento</span><b>{money(data.sales.revenue)}</b></div><div><span>Ticket médio</span><b>{money(data.sales.averageTicket)}</b></div></div></section>
          <section className="analytics-section"><div className="section-title"><div><p>TESTES</p><h2>Pedidos de teste</h2></div><span>Pedidos recentes podem ser marcados antes ou depois do teste</span></div>{recentOrders.length === 0 ? <div className="analytics-empty">Nenhum pedido neste período.</div> : <div className="test-orders">{recentOrders.map((order) => <div className={`test-order ${order.is_test ? 'is-test' : ''}`} key={order.id}><div><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><span>{new Date(order.created_at).toLocaleString('pt-BR')} · {money(order.total)} · {order.payment_status || 'pending'}</span></div><button disabled={updatingTest === order.id} onClick={() => void toggleTest(order.id, order.is_test)}>{updatingTest === order.id ? 'Salvando...' : order.is_test ? 'Desmarcar teste' : 'Marcar como teste'}</button></div>)}</div>}</section>
        </>}
      </section>
      <style jsx global>{`
        .analytics-page{min-height:100vh;background:#f5f5f2;color:#111;font-family:Inter,Arial,sans-serif}.analytics-shell{width:min(1180px,calc(100% - 32px));margin:auto;padding:28px 0 70px}.analytics-back{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font-size:12px;font-weight:800;margin-bottom:28px}.analytics-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}.analytics-head p,.section-title p{margin:0 0 7px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.2em}.analytics-head h1{margin:0;font:italic 58px/1 'Barlow Condensed';text-transform:uppercase}.analytics-head span{display:block;color:#777;font-size:13px;margin-top:10px}.analytics-live{display:flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #ddd;background:#fff;border-radius:999px;color:#555;font-size:10px;font-weight:800;white-space:nowrap}.analytics-live i{width:7px;height:7px;border-radius:50%;background:#35a65a}.analytics-period{display:flex;gap:12px;justify-content:space-between;align-items:center;margin-bottom:16px}.period-buttons{display:flex;gap:7px;flex-wrap:wrap}.period-buttons button{border:1px solid #ddd;background:#fff;border-radius:10px;padding:10px 12px;font:800 11px Inter;color:#555;cursor:pointer}.period-buttons button.active{background:#111;color:#fff;border-color:#111}.period-custom{display:flex;gap:8px}.period-custom label{display:grid;gap:4px;font-size:9px;font-weight:800;color:#777}.period-custom input{border:1px solid #ddd;border-radius:9px;padding:9px;font:11px Inter;background:#fff}.analytics-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.analytics-card{background:#fff;border:1px solid #dddcd7;border-radius:15px;padding:16px}.analytics-card>div{display:flex;justify-content:space-between;align-items:center;color:#777;font-size:10px;font-weight:800}.analytics-card b{width:30px;height:30px;background:#f5f5f0;border-radius:9px;display:grid;place-items:center;color:#9b7600}.analytics-card>strong{display:block;font:700 31px/1 'Barlow Condensed';margin-top:16px}.analytics-section{background:#fff;border:1px solid #dddcd7;border-radius:17px;padding:18px;min-width:0;margin-top:14px}.section-title{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}.section-title h2{margin:0;font:700 27px/1 'Barlow Condensed';text-transform:uppercase}.section-title>span{font-size:9px;color:#999}.section-title a{font-size:10px;color:#111;font-weight:900;text-decoration:none}.evolution-chart{display:flex;gap:7px;align-items:flex-end;min-height:220px;overflow-x:auto;padding:10px 2px}.evolution-day{height:200px;min-width:45px;display:grid;grid-template-rows:1fr auto auto;gap:5px;align-items:end}.evolution-bars{height:165px;display:flex;align-items:flex-end;justify-content:center;gap:2px}.evolution-bars i{width:8px;background:#111;border-radius:3px 3px 0 0;min-height:3px}.evolution-bars i:nth-child(2){background:#ffc400}.evolution-bars i:nth-child(3){background:#777}.evolution-day small{font-size:8px;color:#888;text-align:center}.evolution-day b{font-size:8px;text-align:center;white-space:nowrap}.analytics-two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}.funnel{display:grid;gap:8px}.funnel-row{display:flex;justify-content:space-between;gap:12px;padding:12px;border:1px solid #eee;border-radius:11px}.funnel-main{display:grid;gap:4px}.funnel-main strong{font-size:11px}.funnel-main span{font-size:9px;color:#888}.funnel-meta{text-align:right;display:grid;gap:4px}.funnel-meta b{font-size:11px}.funnel-meta small{font-size:8px;color:#999}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:600px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #eee;font-size:10px;white-space:nowrap}th{color:#888;font-size:8px;text-transform:uppercase;letter-spacing:.08em}td strong{font-size:10px}.analytics-three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}.compact{min-height:180px}.big-metric{font:700 42px/1 'Barlow Condensed';margin:5px 0 14px}.big-metric small{font:400 11px Inter;color:#888;margin-left:7px}.metric-lines{display:grid;gap:9px}.metric-lines span,.simple-line{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#777}.metric-lines b,.simple-line b{color:#111}.simple-line{padding:9px 0;border-bottom:1px solid #eee}.simple-line span{display:flex;align-items:center;gap:6px}.hour-chart{height:120px;display:flex;align-items:flex-end;gap:3px;overflow-x:auto}.hour-chart>div{height:100%;min-width:18px;display:grid;grid-template-rows:1fr auto;align-items:end;gap:3px}.hour-chart i{display:block;background:#ffc400;border-radius:3px 3px 0 0;min-height:4px}.hour-chart small{font-size:7px;color:#888;text-align:center}.sales-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.sales-grid div{padding:12px;border-radius:10px;background:#f7f7f4}.sales-grid span{display:block;font-size:9px;color:#888}.sales-grid b{display:block;font-size:18px;margin-top:6px}.test-orders{display:grid;gap:8px}.test-order{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 12px;border:1px solid #eee;border-radius:10px}.test-order.is-test{background:#fff9df;border-color:#ffc400}.test-order div{display:grid;gap:4px}.test-order strong{font-size:11px}.test-order span{font-size:9px;color:#888}.test-order button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:8px 10px;font:800 9px Inter;cursor:pointer}.analytics-empty,.analytics-loading{padding:30px;text-align:center;color:#888;font-size:11px}.analytics-loading{background:#fff;border:1px solid #ddd;border-radius:15px}@media(max-width:900px){.analytics-cards{grid-template-columns:1fr 1fr}.analytics-two-col,.analytics-three-col{grid-template-columns:1fr}.sales-grid{grid-template-columns:repeat(3,1fr)}.analytics-head{align-items:flex-start;flex-direction:column}.analytics-period{align-items:stretch;flex-direction:column}.period-custom{width:100%}.period-custom label{flex:1}.period-custom input{width:100%}}@media(max-width:560px){.analytics-shell{width:calc(100% - 20px);padding:20px 0 48px}.analytics-head h1{font-size:45px}.analytics-head span{font-size:12px}.analytics-cards{grid-template-columns:1fr 1fr;gap:7px}.analytics-card{padding:12px;border-radius:12px}.analytics-card>strong{font-size:25px}.analytics-card>div{font-size:8px}.analytics-card b{width:27px;height:27px}.sales-grid{grid-template-columns:1fr 1fr}.section-title h2{font-size:25px}.test-order{align-items:flex-start;flex-direction:column}.test-order button{width:100%}}
      `}</style>
    </main>
  );
}
