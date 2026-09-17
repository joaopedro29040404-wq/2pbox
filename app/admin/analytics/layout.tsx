'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { BarChart3, Package, ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <>
    <nav className="analytics-nav">
      <Link className={pathname === '/admin/analytics' ? 'active' : ''} href="/admin/analytics"><BarChart3 size={15}/> Visão geral</Link>
      <Link className={pathname === '/admin/analytics/produtos' ? 'active' : ''} href="/admin/analytics/produtos"><Package size={15}/> Produtos</Link>
      <Link href="/admin"><ArrowLeft size={14}/> Painel</Link>
    </nav>
    {children}
    <style jsx global>{` .analytics-nav{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:18px 0 0;display:flex;gap:7px;align-items:center}.analytics-nav a{display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #ddd;background:#fff;border-radius:10px;text-decoration:none;color:#666;font:800 10px Inter,Arial,sans-serif}.analytics-nav a:hover{border-color:#bbb;color:#111}.analytics-nav a.active{background:#111;color:#fff;border-color:#111}.analytics-nav a:last-child{margin-left:auto;background:transparent;border-color:transparent}@media(max-width:560px){.analytics-nav{width:calc(100% - 28px);padding-top:12px;overflow-x:auto}.analytics-nav a{white-space:nowrap}}`}</style>
  </>;
}
