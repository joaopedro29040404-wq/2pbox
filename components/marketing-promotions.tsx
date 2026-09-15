'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function money(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
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
          if (link.dataset.marketingPromotionApplied === 'true') continue;
          link.dataset.marketingPromotionApplied = 'true';
          const card = link.classList.contains('home-product-card') ? link : (link.closest('[class*="product-card"]') as HTMLElement | null) || link;
          if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

          const badge = document.createElement('span');
          badge.textContent = 'OFERTA';
          badge.style.cssText = 'position:absolute;top:10px;left:10px;z-index:3;background:#ffc400;color:#111;border-radius:999px;padding:5px 8px;font:900 9px Inter,Arial,sans-serif;letter-spacing:.08em;box-shadow:0 3px 10px rgba(0,0,0,.12)';
          card.appendChild(badge);

          const price = document.createElement('div');
          price.style.cssText = 'margin-top:5px;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap';
          const old = document.createElement('s');
          old.textContent = money(original);
          old.style.cssText = 'color:#999;font:600 11px Inter,Arial,sans-serif';
          const current = document.createElement('strong');
          current.textContent = money(promo);
          current.style.cssText = 'color:#138a43;font-weight:900';
          price.append(old, current);
          const existingPrice = Array.from(card.querySelectorAll<HTMLElement>('strong')).find((element) => element.textContent?.trim() === money(original));
          if (existingPrice) existingPrice.replaceWith(price);
          else card.appendChild(price);
        }
      }

      const match = window.location.pathname.match(/^\/produto\/([^/]+)$/);
      if (match) {
        const slug = decodeURIComponent(match[1]);
        const row = rows.find((item) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          return product?.slug === slug;
        });
        if (row) {
          const product = Array.isArray(row.products) ? row.products[0] : row.products;
          const priceNode = document.querySelector<HTMLElement>('.product-price');
          if (priceNode && priceNode.dataset.marketingPromotionApplied !== 'true') {
            priceNode.dataset.marketingPromotionApplied = 'true';
            priceNode.innerHTML = `<s style="color:#999;font-size:.6em;margin-right:8px">${money(Number(product.price))}</s><strong style="color:#138a43">${money(Number(row.promotional_price))}</strong>`;
          }
        }
      }
    }

    async function load() {
      if (!supabase) return;
      const { data } = await supabase.from('promotions').select('product_id,promotional_price,products(slug,name,price)').eq('active', true).lte('starts_at', new Date().toISOString()).gte('ends_at', new Date().toISOString());
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
