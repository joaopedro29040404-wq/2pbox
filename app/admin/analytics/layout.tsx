'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { BarChart3, Package, ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <>
    <nav className="analytics-nav">
      <Link className={`analytics-tab ${pathname === '/admin/analytics' ? 'active' : ''}`} href="/admin/analytics"><BarChart3 size={17}/><span><b>Visão geral</b><small>Indicadores do e-commerce</small></span></Link>
      <Link className={`analytics-tab ${pathname === '/admin/analytics/produtos' ? 'active' : ''}`} href="/admin/analytics/produtos"><Package size={17}/><span><b>Produtos</b><small>Desempenho por produto</small></span></Link>
      <Link className="analytics-panel-link" href="/admin"><ArrowLeft size={15}/><span>Painel</span></Link>
    </nav>
    {children}
    <style jsx global>{`
      .analytics-nav{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:16px 0 0;display:grid;grid-template-columns:1fr 1fr auto;gap:9px;align-items:stretch}
      .analytics-tab{display:flex;align-items:center;gap:10px;min-height:58px;padding:10px 14px;border:1px solid #dddcd7;background:#fff;border-radius:14px;text-decoration:none;color:#555;box-shadow:0 2px 8px rgba(0,0,0,.025);transition:.15s ease}
      .analytics-tab svg{flex:0 0 auto;color:#9b7600}
      .analytics-tab span{display:grid;gap:3px;min-width:0}
      .analytics-tab b{font:900 12px Inter,Arial,sans-serif;color:#222}
      .analytics-tab small{font:700 9px Inter,Arial,sans-serif;color:#999}
      .analytics-tab:hover{border-color:#cfcfc9;transform:translateY(-1px)}
      .analytics-tab.active{background:#111;border-color:#111;box-shadow:0 5px 14px rgba(0,0,0,.12)}
      .analytics-tab.active svg{color:#ffc400}
      .analytics-tab.active b{color:#fff}
      .analytics-tab.active small{color:#bdbdbd}
      .analytics-panel-link{display:flex;align-items:center;justify-content:center;gap:6px;min-width:76px;padding:0 12px;border:1px solid transparent;border-radius:12px;color:#777;text-decoration:none;font:800 10px Inter,Arial,sans-serif}
      .analytics-panel-link:hover{background:#fff;border-color:#dddcd7;color:#111}
      @media(max-width:700px){
        .analytics-nav{width:calc(100% - 20px);padding-top:10px;grid-template-columns:1fr 1fr;gap:7px}
        .analytics-tab{min-height:54px;padding:9px 11px;border-radius:12px}
        .analytics-tab b{font-size:11px}.analytics-tab small{font-size:8px}
        .analytics-panel-link{grid-column:1/-1;justify-self:start;min-height:30px;padding:3px 8px;font-size:9px}
      }
      @media(max-width:420px){
        .analytics-nav{width:calc(100% - 16px);gap:6px}
        .analytics-tab{min-height:50px;padding:8px 9px;gap:8px}
        .analytics-tab svg{width:15px;height:15px}.analytics-tab b{font-size:10px}.analytics-tab small{font-size:7px}
        .analytics-panel-link{min-height:28px}
      }
    `}</style>
  </>;
}
