'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const PROMO_YELLOW = '#ffc400';

type PromotionRow = {
  product_id: string;
  promotional_price: number;
  product?: { slug: string; name: string; price: number } | null;
};

function money(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function renderPrice(container: HTMLElement, original: number, promo: number) {
  if (container.querySelector('[data-marketing-promotion-price]')) return;
  const nativePrice = container.querySelector<HTMLElement>('strong');
  if (nativePrice) nativePrice.remove();

  const price = document.createElement('div');
  price.dataset.marketingPromotionPrice = 'true';
  price.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:1px;margin-top:8px;line-height:1.05;min-width:0;max-width:100%';

  const old = document.createElement('s');
  old.textContent = money(original);
  old.style.cssText = 'color:#999;font:700 12px Inter,Arial,sans-serif;white-space:nowrap';

  const current = document.createElement('strong');
  current.textContent = money(promo);
  current.style.cssText = `color:${PROMO_YELLOW};font:900 30px Inter,Arial,sans-serif;letter-spacing:-.02em;white-space:nowrap`;

  price.append(old, current);
  container.appendChild(price);
}

function renderCatalogPrice(container: HTMLElement, original: number, promo: number) {
  if (container.querySelector('[data-marketing-promotion-price]')) return;

  const nativePrice = container.querySelector<HTMLElement>(':scope > strong');
  if (nativePrice) nativePrice.remove();

  const price = document.createElement('div');
  price.dataset.marketingPromotionPrice = 'true';
  price.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:1px;line-height:1.05;min-width:0;max-width:100%';

  const old = document.createElement('s');
  old.textContent = money(original);
  old.style.cssText = 'color:#999;font:700 11px Inter,Arial,sans-serif;white-space:nowrap';

  const current = document.createElement('strong');
  current.textContent = money(promo);
  current.style.cssText = `color:${PROMO_YELLOW};font:900 19px Inter,Arial,sans-serif;letter-spacing:-.02em;white-space:nowrap`;

  price.append(old, current);
  const button = container.querySelector<HTMLElement>('.catalog-add-button');
  if (button) container.insertBefore(price, button);
  else container.appendChild(price);
}

function constrainPromotionCard(card: HTMLElement) {
  card.style.minWidth = '0';
  card.style.maxWidth = '100%';
  card.style.overflow = 'hidden';

  card.querySelectorAll<HTMLElement>('.low-stock').forEach((badge) => badge.remove());

  const info = card.querySelector<HTMLElement>('.product-body, .home-product-info, [class*="product-info"]');
  if (info) {
    info.style.minWidth = '0';
    info.style.maxWidth = '100%';
    info.style.overflow = 'hidden';
  }

  const title = card.querySelector<HTMLElement>('.product-info-link h2, .home-product-info h3, [class*="product-info"] h2, [class*="product-info"] h3');
  if (title) {
    title.style.minWidth = '0';
    title.style.maxWidth = '100%';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.style.display = '-webkit-box';
    title.style.webkitBoxOrient = 'vertical';
    title.style.webkitLineClamp = '2';
    title.style.overflowWrap = 'anywhere';
    title.style.wordBreak = 'break-word';
  }
}

export function MarketingPromotions() {
  useEffect(() => {
    let cancelled = false;
    let rows: PromotionRow[] = [];

    function applyPromotions() {
      if (cancelled || !rows.length) return;

      for (const row of rows) {
        const product = row.product;
        const slug = String(product?.slug || '').trim();
        const original = Number(product?.price);
        const promo = Number(row.promotional_price);
        if (!slug || !Number.isFinite(original) || !Number.isFinite(promo) || promo <= 0 || promo >= original) continue;

        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href="/produto/${slug}"]`));
        for (const link of links) {
          const card = link.classList.contains('home-product-card')
            ? link
            : (link.closest('.product') as HTMLElement | null) ||
              (link.closest('[class*="product-card"]') as HTMLElement | null) ||
              null;
          if (!card) continue;

          constrainPromotionCard(card);

          if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

          if (!card.querySelector('[data-marketing-promotion-badge]')) {
            const badge = document.createElement('span');
            badge.dataset.marketingPromotionBadge = 'true';
            badge.textContent = 'OFERTA';
            badge.style.cssText = `position:absolute;top:10px;left:10px;z-index:3;background:${PROMO_YELLOW};color:#111;border-radius:999px;padding:7px 11px;font:900 10px Inter,Arial,sans-serif;letter-spacing:.06em;box-shadow:0 3px 10px rgba(0,0,0,.12)`;
            card.appendChild(badge);
          }

          if (card.classList.contains('product')) {
            const info = card.querySelector<HTMLElement>('.product-buy');
            if (info) {
              info.style.minWidth = '0';
              info.style.maxWidth = '100%';
              renderCatalogPrice(info, original, promo);
            }
            continue;
          }

          const info = card.querySelector<HTMLElement>('.home-product-info') || card.querySelector<HTMLElement>('[class*="product-info"]');
          if (!info) continue;
          renderPrice(info, original, promo);
        }
      }

      const match = window.location.pathname.match(/^\/produto\/([^/]+)$/);
      if (match) {
        const slug = decodeURIComponent(match[1]);
        const row = rows.find((item) => item.product?.slug === slug);
        const priceNode = document.querySelector<HTMLElement>('.product-price');
        if (row && priceNode && priceNode.dataset.marketingPromotionApplied !== 'true') {
          const product = row.product;
          if (!product) return;
          priceNode.dataset.marketingPromotionApplied = 'true';
          priceNode.innerHTML = '';
          priceNode.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:1px;margin-bottom:18px;line-height:1.05';

          const old = document.createElement('s');
          old.textContent = money(Number(product.price));
          old.style.cssText = 'color:#999;font:700 14px Inter,Arial,sans-serif;white-space:nowrap';

          const current = document.createElement('strong');
          current.textContent = money(Number(row.promotional_price));
          current.style.cssText = `color:${PROMO_YELLOW};font:900 36px Inter,Arial,sans-serif;letter-spacing:-.02em;white-space:nowrap`;

          priceNode.append(old, current);
        }
      }
    }

    async function load() {
      if (!supabase) return;
      const now = new Date().toISOString();
      const { data: promotions, error } = await supabase
        .from('promotions')
        .select('product_id,promotional_price')
        .eq('active', true)
        .lte('starts_at', now)
        .gte('ends_at', now);
      if (cancelled || error || !Array.isArray(promotions) || promotions.length === 0) return;

      const ids = promotions.map((row) => String(row.product_id));
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id,slug,name,price')
        .in('id', ids)
        .eq('active', true);
      if (cancelled || productsError || !Array.isArray(products)) return;

      const byId = new Map(products.map((product) => [String(product.id), product]));
      rows = promotions
        .map((row) => ({ ...row, product: byId.get(String(row.product_id)) || null }))
        .filter((row) => row.product) as PromotionRow[];

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
