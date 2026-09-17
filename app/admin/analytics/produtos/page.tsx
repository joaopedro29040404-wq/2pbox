'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, ShoppingCart, TrendingUp, PackageCheck } from 'lucide-react';

const presets = ['today', 'yesterday', '7d', '30d', 'custom'] as const;
type Preset = typeof presets[number];
const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const labels: Record<Preset, string> = { today: 'Hoje', yesterday: 'Ontem', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', custom: 'Personalizado' };

type ProductRow = { id: string; name: string; slug: string | null; price: number; active: boolean; views: number; carts: number; checkouts: number; orders: number; units: number; revenue: number; conversion: number; cartRate: number; interestLowConversion: boolean };
type Data = { page: number; pageSize: number; total: number; totalPages: number; sort: string; summary: { views: number; carts: number; orders: number; units: number; revenue: number }; products: ProductRow[] };

function rangeFor(preset: Preset, from: string, to: string) {
  if (preset === 'custom') return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59.999`) };
  const now = new Date(); const start = new Date(now); start.setHours(0,0,0,0); const end = new Date(now); end.setHours(23,59,59,999);
  if (preset === 'today') return { start, end };
  if (preset === 'yesterday') { start.setDate(start.getDate()-1); end.setDate(end.getDate()-1); return { start, end }; }
  start.setDate(start.getDate() - (preset === '7d' ? 6 : 29)); return { start, end };
}

export default function AnalyticsProductsPage() {
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [sort, setSort] = useState('views');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setPage(1); }, [preset, from, to, sort]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); const range = rangeFor(preset, from, to);
      const params = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString(), page: String(page), sort });
      try { const response = await fetch(`/api/admin/analytics/produtos?${params}`, { cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result?.error || 'Não foi possível carregar os produtos.'); if (!cancelled) setData(result); }
      catch { if (!cancelled) setData(null); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [preset, from, to, sort, page]);

  const first = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const pages = useMemo(() => { if (!data) return []; const start = Math.max(1, Math.min(data.page - 2, data.totalPages - 4)); return Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => start + i); }, [data]);

  return <main className="analytics-products-page"><section className="analytics-products-shell">
    <Link href="/admin/analytics" className="products-back"><ArrowLeft size={16}/> Analytics</Link>
    <header className="products-head"><div><p>ANALYTICS / PRODUTOS</p><h1>Desempenho por produto</h1><span>Todos os produtos já aparecem aqui. Sem precisar pesquisar.</span></div><div className="period-buttons">{presets.map((item) => <button key={item} className={preset === item ? 'active' : ''} onClick={() => setPreset(item)}>{labels[item]}</button>)}</div></header>
    {preset === 'custom' && <div className="custom-period"><label>De<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label></div>}
    <div className="product-summary"><div><Eye size={17}/><span>Visualizações<b>{data?.summary.views ?? 0}</b></span></div><div><ShoppingCart size={17}/><span>Carrinhos<b>{data?.summary.carts ?? 0}</b></span></div><div><PackageCheck size={17}/><span>Pedidos<b>{data?.summary.orders ?? 0}</b></span></div><div><TrendingUp size={17}/><span>Unidades<b>{data?.summary.units ?? 0}</b></span></div><div><TrendingUp size={17}/><span>Faturamento<b>{money(data?.summary.revenue ?? 0)}</b></span></div></div>
    <section className="products-panel"><div className="panel-head"><div><p>CATÁLOGO COMPLETO</p><h2>Produtos</h2></div><div className="sort-wrap"><span>Ordenar por</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="views">Mais visualizados</option><option value="carts">Mais adicionados</option><option value="orders">Mais vendidos</option><option value="revenue">Maior faturamento</option><option value="conversion">Maior conversão</option></select></div></div>
      {loading ? <div className="empty">Carregando desempenho...</div> : !data || data.products.length === 0 ? <div className="empty">Nenhum produto encontrado no catálogo.</div> : <div className="product-list"><div className="product-table-head"><span>Produto</span><span>Vis.</span><span>Car.</span><span>Check.</span><span>Pedidos</span><span>Unid.</span><span>Faturamento</span><span>Conversão</span></div>{data.products.map(product => <Link href={product.slug ? `/produto/${product.slug}` : '/admin/produtos'} className="product-row" key={product.id}><div className="product-name"><strong>{product.name}</strong><small>{product.active ? 'Ativo' : 'Inativo'}{product.interestLowConversion ? ' · Alto interesse, sem venda' : ''}</small></div><b>{product.views}</b><b>{product.carts}</b><b>{product.checkouts}</b><b>{product.orders}</b><b>{product.units}</b><b>{money(product.revenue)}</b><b className={product.interestLowConversion ? 'attention' : ''}>{product.conversion.toFixed(2).replace('.', ',')}%</b></Link>)}</div>}
      {data && data.total > 0 && <footer className="pagination"><span>{first}–{last} de {data.total} produtos</span><div><button disabled={data.page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16}/></button>{pages.map(p => <button key={p} className={p === data.page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>)}<button disabled={data.page >= data.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16}/></button></div></footer>}
    </section>
  </section><style jsx global>{` .analytics-products-page{min-height:100vh;background:#f5f5f2;color:#111;font-family:Inter,Arial,sans-serif}.analytics-products-shell{width:min(1180px,calc(100% - 32px));margin:auto;padding:28px 0 70px}.products-back{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font-size:12px;font-weight:800;margin-bottom:25px}.products-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:15px}.products-head p,.panel-head p{margin:0 0 7px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.2em}.products-head h1{margin:0;font:italic 54px/1 'Barlow Condensed';text-transform:uppercase}.products-head span{display:block;color:#777;font-size:13px;margin-top:10px}.period-buttons{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.period-buttons button,.sort-wrap select{border:1px solid #ddd;background:#fff;border-radius:10px;padding:10px 12px;font:800 10px Inter;color:#555;cursor:pointer}.period-buttons button.active{background:#111;color:#fff;border-color:#111}.custom-period{display:flex;gap:8px;justify-content:flex-end;margin-bottom:14px}.custom-period label{display:grid;gap:4px;font-size:9px;font-weight:800;color:#777}.custom-period input{border:1px solid #ddd;border-radius:9px;padding:9px;font:11px Inter;background:#fff}.product-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:20px 0 14px}.product-summary>div{background:#fff;border:1px solid #dddcd7;border-radius:13px;padding:13px;display:flex;gap:9px;align-items:center;color:#9b7600}.product-summary span{display:grid;gap:3px;color:#777;font-size:9px;font-weight:800}.product-summary b{display:block;color:#111;font-size:17px}.products-panel{background:#fff;border:1px solid #dddcd7;border-radius:16px;padding:18px;overflow:hidden}.panel-head{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;margin-bottom:14px}.panel-head h2{margin:0;font:700 30px/1 'Barlow Condensed';text-transform:uppercase}.sort-wrap{display:flex;align-items:center;gap:8px}.sort-wrap span{font-size:9px;color:#888;font-weight:800}.sort-wrap select{padding:9px 10px}.product-list{overflow-x:auto}.product-table-head,.product-row{min-width:850px;display:grid;grid-template-columns:minmax(260px,2.4fr) .55fr .55fr .6fr .65fr .55fr 1fr .8fr;align-items:center;gap:10px}.product-table-head{padding:10px 12px;color:#999;font-size:9px;font-weight:900;text-transform:uppercase;border-bottom:1px solid #eee}.product-row{padding:13px 12px;text-decoration:none;color:#111;border-bottom:1px solid #f0f0ed}.product-row:hover{background:#fafaf7}.product-row> b{font-size:11px}.product-name{min-width:0}.product-name strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.product-name small{display:block;color:#999;font-size:9px;margin-top:4px}.product-name small::first-letter{}.attention{color:#b12b2b}.empty{text-align:center;padding:55px 20px;color:#888;font-size:12px}.pagination{display:flex;align-items:center;justify-content:space-between;padding-top:16px;color:#888;font-size:10px;font-weight:800}.pagination>div{display:flex;gap:5px}.pagination button{width:30px;height:30px;border:1px solid #ddd;background:#fff;border-radius:8px;font:800 10px Inter;cursor:pointer}.pagination button.active{background:#111;color:#fff;border-color:#111}.pagination button:disabled{opacity:.35;cursor:not-allowed}@media(max-width:800px){.products-head{align-items:flex-start;flex-direction:column}.products-head h1{font-size:45px}.period-buttons{justify-content:flex-start}.product-summary{grid-template-columns:repeat(2,1fr)}.product-summary>div:last-child{grid-column:1/-1}.panel-head{align-items:flex-start;flex-direction:column}.sort-wrap{width:100%}.sort-wrap select{width:100%}}@media(max-width:560px){.analytics-products-shell{width:calc(100% - 28px);padding-top:22px}.products-head h1{font-size:39px}.products-head span{font-size:11px}.product-summary{gap:7px}.product-summary>div{padding:11px}.product-summary b{font-size:15px}.products-panel{padding:12px;border-radius:13px}.pagination{align-items:flex-start;gap:10px;flex-direction:column}.pagination>div{width:100%}.pagination button{flex:1}}`}</style></main>;
}
