'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Box, ChevronRight, LayoutDashboard, Package, Settings, ShoppingCart, Tags, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { money } from '@/lib/order-format';

type OrderRow = { created_at: string; status: string; payment_status?: string | null; total: number | string };
type Stat = { label: string; value: string; hint: string; icon: typeof Package };

const MENU = [
  { href: '/admin/produtos', title: 'Produtos', text: 'Catálogo, estoque, preços, fotos e conteúdo.', icon: Package, tone: 'yellow' },
  { href: '/admin/categorias', title: 'Categorias', text: 'Organize e mantenha seu catálogo limpo.', icon: Tags, tone: 'soft' },
  { href: '/admin/pedidos', title: 'Pedidos', text: 'Acompanhe vendas, pagamentos e status.', icon: ShoppingCart, tone: 'soft' },
  { href: '/admin/configuracoes', title: 'Configurações', text: 'Dados da loja, retirada, contato e atendimento.', icon: Settings, tone: 'soft' },
];

const INITIAL_STATS: Stat[] = [
  { label: 'Pedidos hoje', value: '0', hint: 'Hoje', icon: ShoppingCart },
  { label: 'Produtos ativos', value: '0', hint: 'Visíveis na loja', icon: Package },
  { label: 'Vendas no mês', value: 'R$ 0,00', hint: 'Pagamentos aprovados', icon: TrendingUp },
  { label: 'Aguardando pagamento', value: '0', hint: 'Pendentes de confirmação', icon: BarChart3 },
];

export default function AdminPage() {
  const [stats, setStats] = useState<Stat[]>(INITIAL_STATS);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const [{ count: products }, { data: orders }] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('orders').select('status,payment_status,total,created_at'),
      ]);

      const now = new Date();
      const today = now.toDateString();
      const month = now.getMonth();
      const year = now.getFullYear();
      const list = (orders ?? []) as OrderRow[];

      const todayCount = list.filter((order) => new Date(order.created_at).toDateString() === today).length;
      const monthSales = list
        .filter((order) => {
          const date = new Date(order.created_at);
          return date.getMonth() === month && date.getFullYear() === year && String(order.payment_status || '').toLowerCase() === 'paid';
        })
        .reduce((sum, order) => sum + Number(order.total), 0);
      const awaiting = list.filter((order) => String(order.payment_status || 'pending').toLowerCase() === 'pending').length;

      setStats([
        { label: 'Pedidos hoje', value: String(todayCount), hint: 'Hoje', icon: ShoppingCart },
        { label: 'Produtos ativos', value: String(products ?? 0), hint: 'Visíveis na loja', icon: Package },
        { label: 'Vendas no mês', value: money(monthSales), hint: 'Pagamentos aprovados', icon: TrendingUp },
        { label: 'Aguardando pagamento', value: String(awaiting), hint: 'Pendentes de confirmação', icon: BarChart3 },
      ]);
    }
    load();
  }, []);

  return (
    <main className="admin-dashboard">
      <SiteHeader variant="admin" subtitle="GESTÃO DA LOJA" />

      <section className="admin-dashboard-content">
        <div className="admin-welcome">
          <div>
            <p className="admin-eyebrow">VISÃO GERAL</p>
            <h1>Dashboard</h1>
            <p>Acompanhe a operação da 2P Box em um só lugar.</p>
          </div>
          <div className="admin-live">
            <i /> Dados em tempo real
          </div>
        </div>

        <div className="admin-stat-grid">
          {stats.map(({ label, value, hint, icon: Icon }) => (
            <article className="admin-stat" key={label}>
              <div className="admin-stat-top">
                <span>{label}</span>
                <b>
                  <Icon size={17} />
                </b>
              </div>
              <strong>{value}</strong>
              <small>{hint}</small>
            </article>
          ))}
        </div>

        <div className="admin-section-title">
          <div>
            <p className="admin-eyebrow">OPERAÇÃO</p>
            <h2>Acesso rápido</h2>
          </div>
          <span>{MENU.length} áreas</span>
        </div>

        <div className="admin-menu-grid">
          {MENU.map(({ href, title, text, icon: Icon, tone }) => (
            <Link href={href} className="admin-menu-card" key={href}>
              <div className={`admin-menu-icon ${tone}`}>
                <Icon size={21} />
              </div>
              <div className="admin-menu-copy">
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <ChevronRight className="admin-menu-arrow" size={19} />
            </Link>
          ))}
        </div>

        <div className="admin-info-panel">
          <div className="admin-info-icon">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <strong>Central de gestão</strong>
            <p>
              Pagamentos do Mercado Pago são reconciliados pelo worker de mensageria e cada mudança de status dispara o e-mail transacional para o cliente.
            </p>
          </div>
          <Box size={70} className="admin-info-mark" />
        </div>
      </section>

      <style jsx global>{`
        .admin-dashboard{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}
        .admin-dashboard-content{width:min(1180px,calc(100% - 40px));margin:auto;padding:44px 0 70px}
        .admin-welcome{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:28px}
        .admin-eyebrow{margin:0 0 9px;color:#9b7600;font-size:10px;font-weight:900;letter-spacing:.24em;text-transform:uppercase}
        .admin-welcome h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:66px;line-height:.84;font-style:italic;text-transform:uppercase;letter-spacing:-.02em}
        .admin-welcome>div:first-child>p:last-child{margin:14px 0 0;color:#777;font-size:14px}
        .admin-live{display:flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #ddd;background:#fff;border-radius:999px;color:#555;font-size:10px;font-weight:800;white-space:nowrap;flex:none}
        .admin-live i{width:7px;height:7px;border-radius:50%;background:#35a65a;display:block}
        .admin-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:42px}
        .admin-stat{background:#fff;border:1px solid #e2e2de;border-radius:16px;padding:18px;min-width:0;box-shadow:0 5px 18px rgba(0,0,0,.025)}
        .admin-stat-top{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#777;font-size:11px;font-weight:700}
        .admin-stat-top b{width:32px;height:32px;border-radius:9px;background:#f7f7f4;display:grid;place-items:center;color:#a07800;flex:none}
        .admin-stat>strong{display:block;font-family:'Barlow Condensed',sans-serif;font-size:36px;line-height:1;margin:18px 0 5px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .admin-stat>small{font-size:10px;color:#999}
        .admin-section-title{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:15px}
        .admin-section-title h2{margin:0;font-family:'Barlow Condensed',sans-serif;font-size:31px;text-transform:uppercase}
        .admin-section-title>span{font-size:10px;color:#888;font-weight:800}
        .admin-menu-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .admin-menu-card{min-height:126px;background:#fff;border:1px solid #e2e2de;border-radius:16px;padding:19px;display:flex;align-items:flex-start;gap:14px;text-decoration:none;color:#111;position:relative;transition:transform .18s,box-shadow .18s,border-color .18s}
        .admin-menu-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.07);border-color:#d1d1cb}
        .admin-menu-icon{width:43px;height:43px;border-radius:12px;display:grid;place-items:center;flex:none}
        .admin-menu-icon.yellow{background:#ffc400}
        .admin-menu-icon.soft{background:#f2f2ee}
        .admin-menu-copy{min-width:0;padding-right:20px}
        .admin-menu-copy h3{margin:1px 0 6px;font-family:'Barlow Condensed',sans-serif;font-size:25px;text-transform:uppercase}
        .admin-menu-copy p{margin:0;color:#777;font-size:12px;line-height:1.5;max-width:390px}
        .admin-menu-arrow{position:absolute;right:17px;top:20px;color:#aaa}
        .admin-info-panel{margin-top:28px;padding:19px 21px;border-radius:16px;background:#111;color:#fff;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden}
        .admin-info-icon{width:42px;height:42px;border-radius:11px;background:#ffc400;color:#111;display:grid;place-items:center;flex:none}
        .admin-info-panel strong{font-size:13px}
        .admin-info-panel p{margin:5px 0 0;color:#aaa;font-size:11px;line-height:1.5;max-width:700px}
        .admin-info-mark{position:absolute;right:-8px;opacity:.06;color:#ffc400}
        @media(max-width:900px){
          .admin-dashboard-content{width:min(100% - 28px,760px)}
          .admin-stat-grid{grid-template-columns:1fr 1fr}
          .admin-welcome{align-items:flex-start;flex-direction:column}
          .admin-menu-grid{grid-template-columns:1fr}
        }
        @media(max-width:560px){
          .admin-dashboard-content{padding:30px 0 50px}
          .admin-welcome{margin-bottom:22px}
          .admin-welcome h1{font-size:50px}
          .admin-welcome>div:first-child>p:last-child{font-size:12px;margin-top:11px}
          .admin-stat-grid{gap:8px;margin-bottom:30px}
          .admin-stat{padding:13px;border-radius:13px}
          .admin-stat-top{font-size:9px}
          .admin-stat>strong{font-size:28px;margin:15px 0 4px}
          .admin-section-title h2{font-size:28px}
          .admin-menu-card{min-height:104px;padding:15px}
          .admin-menu-copy h3{font-size:22px}
          .admin-info-panel{align-items:flex-start;padding:16px}
          .admin-info-mark{display:none}
        }
      `}</style>
    </main>
  );
}
