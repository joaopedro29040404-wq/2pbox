'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { BarChart3, Package, ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const target = document.querySelector('.analytics-cards, .dashboard-cards');
    if (!target?.parentElement) return;
    const node = document.createElement('div');
    node.className = 'analytics-switcher-slot';
    target.parentElement.insertBefore(node, target);
    setSlot(node);
    return () => node.remove();
  }, [pathname]);

  const tabs = (
    <section className="analytics-switcher">
      <Link className={`analytics-switch-card ${pathname === '/admin/analytics' ? 'active' : ''}`} href="/admin/analytics">
        <span className="switch-icon"><BarChart3 size={19}/></span>
        <span className="switch-copy"><small>VISÃO GERAL</small><b>Visão do e-commerce</b><em>Indicadores gerais da sua loja</em></span>
      </Link>
      <Link className={`analytics-switch-card ${pathname === '/admin/analytics/produtos' ? 'active' : ''}`} href="/admin/analytics/produtos">
        <span className="switch-icon"><Package size={19}/></span>
        <span className="switch-copy"><small>PRODUTOS</small><b>Desempenho por produto</b><em>Interesse, vendas e lucro</em></span>
      </Link>
      <Link className="analytics-switch-back" href="/admin"><ArrowLeft size={15}/> Painel</Link>
    </section>
  );

  return <>
    {children}
    {slot ? createPortal(tabs, slot) : null}
    <style jsx global>{`
      .analytics-switcher-slot{width:100%;margin:0 0 14px}.analytics-switcher{width:100%;display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:stretch}
      .analytics-switch-card{display:flex;align-items:center;gap:11px;min-height:72px;padding:12px 15px;background:#fff;border:1px solid #dddcd7;border-radius:15px;text-decoration:none;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.025);transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
      .analytics-switch-card:hover{transform:translateY(-1px);border-color:#cfcfc9;box-shadow:0 5px 14px rgba(0,0,0,.06)}.analytics-switch-card.active{background:#111;border-color:#111;box-shadow:0 6px 18px rgba(0,0,0,.12)}
      .switch-icon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:11px;background:#f5f5f0;color:#9b7600}.active .switch-icon{background:#222;color:#ffc400}
      .switch-copy{display:grid;gap:2px;min-width:0}.switch-copy small{font:900 8px Inter,Arial,sans-serif;letter-spacing:.16em;color:#9b7600}.switch-copy b{font:900 13px Inter,Arial,sans-serif;color:#222}.switch-copy em{font:700 9px Inter,Arial,sans-serif;color:#999;font-style:normal}.active .switch-copy b{color:#fff}.active .switch-copy em{color:#aaa}
      .analytics-switch-back{display:flex;align-items:center;justify-content:center;gap:6px;min-width:76px;padding:0 11px;border:1px solid transparent;border-radius:12px;color:#777;text-decoration:none;font:800 10px Inter,Arial,sans-serif}.analytics-switch-back:hover{background:#fff;border-color:#dddcd7;color:#111}
      .analytics-products-page .pagination{width:100%;box-sizing:border-box}.analytics-products-page .pagination>div{flex-wrap:wrap;justify-content:flex-end}
      @media(max-width:700px){.analytics-switcher{grid-template-columns:1fr 1fr;gap:7px}.analytics-switch-card{min-height:64px;padding:10px;border-radius:13px;gap:8px}.switch-icon{width:32px;height:32px;flex-basis:32px;border-radius:9px}.switch-icon svg{width:16px;height:16px}.switch-copy small{font-size:7px}.switch-copy b{font-size:10px;line-height:1.2}.switch-copy em{font-size:7px}.analytics-switch-back{grid-column:1/-1;justify-self:start;min-height:28px;padding:2px 7px;font-size:9px}}
      @media(max-width:650px){.analytics-products-page .pagination{flex-direction:column;align-items:stretch;gap:10px;text-align:center;padding-top:14px}.analytics-products-page .pagination>span{display:block}.analytics-products-page .pagination>div{width:100%;justify-content:center;gap:5px}.analytics-products-page .pagination button{width:34px;height:34px;flex:0 0 34px}.analytics-switcher-slot{margin-bottom:12px}}
      @media(max-width:390px){.analytics-switch-card{min-height:60px;padding:8px}.switch-icon{width:28px;height:28px;flex-basis:28px}.switch-copy b{font-size:9px}.switch-copy em{display:none}.analytics-products-page .pagination>div{gap:4px}.analytics-products-page .pagination button{width:32px;height:32px;flex-basis:32px}}
    `}</style>
  </>;
}
