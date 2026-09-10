'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/toast';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  image_url?: string;
};

type AddOptions = { quantity?: number; silent?: boolean };
type AddOutcome = 'added' | 'updated' | 'limited';

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  add: (product: Omit<CartItem, 'quantity'>, options?: AddOptions) => void;
  remove: (id: string) => void;
  setQty: (id: string, quantity: number) => void;
  clear: (options?: { silent?: boolean }) => void;
};

const STORAGE_KEY = '2pbox-cart';
const CartContext = createContext<CartContextValue | null>(null);

function money(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const toast = useToast();
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);

    snapshotTimer.current = setTimeout(async () => {
      let email = '';
      let name = '';
      try {
        email = localStorage.getItem('2p_guest_order_email')?.trim().toLowerCase() || '';
        name = localStorage.getItem('2p_checkout_name') || '';
      } catch {}

      if (!email && supabase) {
        const { data } = await supabase.auth.getUser();
        email = data.user?.email?.trim().toLowerCase() || '';
        name = name || data.user?.user_metadata?.full_name || '';
      }
      if (!email) return;

      await fetch('/api/carrinho/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          items: items.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
        }),
        keepalive: true,
      }).catch(() => undefined);
    }, 2500);

    return () => {
      if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    };
  }, [items, hydrated]);

  const add = useCallback(
    (product: Omit<CartItem, 'quantity'>, options: AddOptions = {}) => {
      const requested = Math.max(1, Number(options.quantity || 1));
      const result: { outcome: AddOutcome; quantity: number } = { outcome: 'added', quantity: requested };

      setItems((current) => {
        const existing = current.find((item) => item.id === product.id);
        if (!existing) {
          const quantity = Math.min(requested, Math.max(1, product.stock));
          result.quantity = quantity;
          result.outcome = quantity < requested ? 'limited' : 'added';
          return [...current, { ...product, quantity }];
        }
        const target = Math.min(existing.quantity + requested, product.stock);
        result.quantity = target;
        result.outcome = target === existing.quantity ? 'limited' : 'updated';
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: target, stock: product.stock, image_url: product.image_url ?? item.image_url } : item,
        );
      });

      if (options.silent) return;
      if (result.outcome === 'limited') {
        toast.warning('Estoque máximo atingido', `Só temos ${product.stock} unidade(s) de ${product.name}.`);
        return;
      }
      toast.success(
        result.outcome === 'added' ? 'Adicionado ao carrinho' : 'Quantidade atualizada',
        `${product.name} · ${result.quantity}× · ${money(product.price * result.quantity)}`,
      );
    },
    [toast],
  );

  const remove = useCallback(
    (id: string) => {
      setItems((current) => {
        const target = current.find((item) => item.id === id);
        if (target) toast.info('Item removido', `${target.name} saiu do seu carrinho.`);
        return current.filter((item) => item.id !== id);
      });
    },
    [toast],
  );

  const setQty = useCallback((id: string, quantity: number) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stock)) } : item)),
    );
  }, []);

  const clear = useCallback(
    (options: { silent?: boolean } = {}) => {
      setItems([]);
      if (!options.silent) toast.info('Carrinho esvaziado', 'Todos os itens foram removidos.');
    },
    [toast],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      add,
      remove,
      setQty,
      clear,
    }),
    [items, add, remove, setQty, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart precisa estar dentro de CartProvider');
  return context;
}
