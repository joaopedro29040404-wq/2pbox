'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const PROMO_YELLOW = '#ffc400';

function money(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function renderPrice(container: HTMLElement, original: number, promo: number) {
  container.querySelectorAll('[data-marketing-promotion-price]').forEach((node) => node.remove());
  const nativePrice = container.querySelector<HTMLElement>('[data-product-price]');
  if (nativePrice) nativePrice.remove();

  const price = document.createElement('div');
  price.dataset.marketingPromotionPrice = 'true';
  price.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:1px;margin-top:8px;line-height:1.05';

  const old = document.createElement('s');
  old.textContent = money(original);
  old.style.cssText = 'color:#999;font:700 12px Inter,Arial,sans-serif';

  const current = document.createElement('strong');
  current.textContent = money(promo);
  current.style.cssText = `color:${PROMO_YELLOW};font:900 30px Inter,Arial,sans-serif;letter-spacing:-.02em`;

  price.append(old, current);
  container.appendChild(price);
}

export function MarketingPromotions() {
  useEffect(() => {
    let cancelled = false;
    let rows: any[] = [];

    function applyPromotions() {
      if (cancelled || !rows.length) return;

      for (const row of rows) {
        const product = Array.isArray(row.products) ? row.products[0] : row.products;
        const slug = String(product?.slug || '').trim();
        const original = Number(product?.price);
        const promo = Number(row.promotional_price);
        if (!slug || !Number.isFinite(original) || !Number.isFinite(promo) || promo <= 0 || promo >= original) continue;

        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href="/produto/${slug}"]`));
        for (const link of links) {
          const card = link.classList.contains('home-product-card')
            ? link
            : (link.closest('[class*="product-card"]') as HTMLElement | null) || null;
          if (!card) continue;

          if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

          if (!card.querySelector('[data-marketing-promotion-badge]')) {
            const badge = document.createElement('span');
            badge.dataset.marketingPromotionBadge = 'true';
            badge.textContent = 'OFERTA';
            badge.style.cssText = `position:absolute;top:10px;left:10px;z-index:3;background:${PROMO_YELLOW};color:#111;border-radius:999px;padding:7px 11px;font:900 10px Inter,Arial,sans-serif;letter-spacing:.06em;box-shadow:0 3px 10px rgba(0,0,0,.12)`;
            card.appendChild(badge);
          }

          const info = card.querySelector<HTMLElement>('.home-product-info') || card.querySelector<HTMLElement>('[class*="product-info"]');
          if (!info) continue;

          info.querySelectorAll('[data-marketing-promotion-price]').forEach((node) => node.remove());
          const nativeStrong = info.querySelector<HTMLElement>('strong');
          if (nativeStrong) {
            nativeStrong.dataset.productPrice = 'true';
          }
          renderPrice(info, original, promo);
        }
      }

      const match = window.location.pathname.match(/^\/produto\/([^/]+)$/);
      if (match) {
        const slug = decodeURIComponent(match[1]);
        const row = rows.find((item) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          return product?.slug === slug;
        });

        const priceNode = document.querySelector<HTMLElement>('.product-price');
        if (row && priceNode) {
          const product = Array.isArray(row.products) ? row.products[0] : row.products;
          priceNode.dataset.marketingPromotionApplied = 'true';
          priceNode.innerHTML = '';
          priceNode.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:1px;margin-bottom:18px;line-height:1.05';

          const old = document.createElement('s');
          old.textContent = money(Number(product.price));
          old.style.cssText = 'color:#999;font:700 14px Inter,Arial,sans-serif';

          const current = document.createElement('strong');
          current.textContent = money(Number(row.promotional_price));
          current.style.cssText = `color:${PROMO_YELLOW};font:900 36px Inter,Arial,sans-serif;letter-spacing:-.02em`;

          priceNode.append(old, current);
        }
      }
    }

    async function load() {
      if (!supabase) return;
      const { data } = await supabase
        .from('promotions')
        .select('product_id,promotional_price,products(slug,name,price)')
        .eq('active', true)
        .lte('starts_at', new Date().toISOString())
        .gte('ends_at', new Date().toISOString());
      if (cancelled || !Array.isArray(data)) return;
      rows = data as any[];
      applyPromotions();
      const observer = new MutationObserver(() => applyPromotions());
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    let cleanup: (() => void) | undefined;
    void load().then((dispose) => { cleanup = dispose; });
    return () => { cancelled = true; cleanup?.(); };
  }, []);

  return null;
}
