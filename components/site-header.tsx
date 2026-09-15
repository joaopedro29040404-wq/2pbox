'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, LogIn, LogOut, Menu, ShoppingBag, UserRound, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';
import { useToast } from '@/components/ui/toast';

type NavLink = { href: string; label: string };

const STORE_LINKS: NavLink[] = [
  { href: '/loja', label: 'Produtos' },
  { href: '/favoritos', label: 'Favoritos' },
  { href: '/acompanhar-pedido', label: 'Acompanhar pedido' },
];

const ADMIN_LINKS: NavLink[] = [
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/entregas', label: 'Entregas' },
  { href: '/admin/configuracoes', label: 'Configurações' },
  { href: '/admin/configuracoes/envio-imediato', label: 'Envio imediato' },
];

export type SiteHeaderProps = {
  variant?: 'store' | 'admin';
  subtitle?: string;
  links?: NavLink[];
  showCart?: boolean;
  showTopbar?: boolean;
  sticky?: boolean;
};

export function SiteHeader({
  variant = 'store',
  subtitle,
  links,
  showCart = true,
  showTopbar = true,
  sticky = true,
}: SiteHeaderProps) {
  const isAdmin = variant === 'admin';
  const navLinks = links ?? (isAdmin ? ADMIN_LINKS : STORE_LINKS);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [freeShippingFrom, setFreeShippingFrom] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    client.auth.getUser().then(({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.user));
      setName(data.user?.user_metadata?.full_name?.trim()?.split(/\s+/)[0] || null);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedIn(Boolean(session?.user));
      setName(session?.user?.user_metadata?.full_name?.trim()?.split(/\s+/)[0] || null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAdmin || !pathname?.startsWith('/produto/')) {
      setFreeShippingFrom(null);
      return;
    }
    let active = true;
    fetch('/api/entrega/cotacao', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        const value = Number(data?.freeShippingFrom);
        setFreeShippingFrom(Number.isFinite(value) && value > 0 ? value : null);
      })
      .catch(() => {
        if (active) setFreeShippingFrom(null);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, pathname]);

  async function signOut() {
    const client = supabase;
    if (client) await client.auth.signOut();
    toast.success('Sessão encerrada', 'Você saiu da sua conta com segurança.');
    window.location.assign(isAdmin ? '/admin/login' : '/');
  }

  const accountLabel = name || 'Minha conta';

  return (
    <>
      {showTopbar && (
        <div className="sh-topbar">
          {isAdmin ? (
            <>
              <span>2P BOX</span>
              <b>•</b>
              <span>PAINEL ADMINISTRATIVO</span>
            </>
          ) : (
            <>
              <span>QUALIDADE</span>
              <b>•</b>
              <span>VARIEDADE</span>
              <b>•</b>
              <span>CONFIANÇA</span>
            </>
          )}
        </div>
      )}

      <header className={`sh-header ${sticky ? 'is-sticky' : ''} ${isAdmin ? 'is-admin' : ''}`}>
        <div className="sh-inner">
          <Link href={isAdmin ? '/admin' : '/'} className="sh-brand" aria-label={isAdmin ? '2P Box, painel' : '2P Box, início'}>
            <span className="sh-logo">
              <img src="/logo.pnh.png" alt="2P Box" width={112} height={70} />
            </span>
            <span className="sh-brand-copy">
              <strong>2P BOX</strong>
              <small>{subtitle || (isAdmin ? 'ADMINISTRAÇÃO' : 'TUDO QUE VOCÊ PRECISA')}</small>
            </span>
          </Link>

          <nav className={`sh-nav ${menuOpen ? 'is-open' : ''}`}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/" className="sh-nav-external" onClick={() => setMenuOpen(false)}>
                Ver loja <ArrowUpRight size={14} />
              </Link>
            )}
          </nav>

          <div className="sh-actions">
            {!isAdmin && signedIn && (
              <Link href="/conta" className="sh-account">
                <UserRound size={16} />
                <span>{accountLabel}</span>
              </Link>
            )}
            {!isAdmin && showCart && <CartButton />}
            {signedIn ? (
              <button type="button" className="sh-signout" onClick={signOut}>
                <LogOut size={15} />
                <span>Sair</span>
              </button>
            ) : (
              <Link href={isAdmin ? '/admin/login' : '/conta'} className="sh-signin">
                <LogIn size={15} />
                <span>Entrar</span>
              </Link>
            )}
            <button type="button" className="sh-burger" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menu" aria-expanded={menuOpen}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {!isAdmin && pathname?.startsWith('/produto/') && freeShippingFrom != null && (
        <div className="product-free-shipping-notice">
          <strong>Frete grátis na entrega padrão</strong>
          <span>A partir de R$ {freeShippingFrom.toFixed(2).replace('.', ',')} em compras.</span>
        </div>
      )}

      <style jsx global>{`
        .product-free-shipping-notice{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;background:#fff7d6;border-bottom:1px solid #f0d65b;color:#5c5000;font:700 12px Inter,Arial,sans-serif;text-align:center}
        .product-free-shipping-notice strong{font-weight:900}
        .product-free-shipping-notice span{font-weight:600}
        @media(max-width:520px){.product-free-shipping-notice{flex-direction:column;gap:2px;padding:9px 14px;font-size:11px}}
      `}</style>
    </>
  );
}

function CartButton() {
  const { items } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Link href="/carrinho" className="sh-cart" aria-label={`Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`}>
      <ShoppingBag size={17} strokeWidth={1.9} />
      <span>Carrinho</span>
      {count > 0 && <b>{count}</b>}
    </Link>
  );
}
