'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const PROMO_YELLOW = '#ffc400';

type PromotionProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image_url?: string | null;
  images?: string[] | null;
};

type PromotionRow = {
  product_id: string;
  promotional_price: number;
  product?: PromotionProduct | null;
};

function money(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

function validPromotions(rows: PromotionRow[]) {
  return rows
    .map((row) => {
      const product = row.product;
      const original = Number(product?.price);
      const promo = Number(row.promotional_price);
      if (!product || !Number.isFinite(original) || !Number.isFinite(promo) || promo <= 0 || promo >= original) return null;
      return { ...row, product, original, promo };
    })
    .filter(Boolean) as Array<PromotionRow & { product: PromotionProduct; original: number; promo: number }>;
}

function renderHomePromotionCards(products: Array<PromotionRow & { product: PromotionProduct; original: number; promo: number }>) {
  return products.map(({ product, original, promo }) => {
    const discount = Math.round(((original - promo) / original) * 100);
    const image = product.images?.[0] || product.image_url || '';
    return `
      <a href="/produto/${encodeURIComponent(product.slug)}" class="home-product-card home-promotion-product-card">
        <div class="home-product-image home-promotion-product-image">
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" />` : '<div class="home-promotion-placeholder">2P BOX</div>'}
          <span class="home-promotion-badge">OFERTA</span>
          <span class="home-promotion-discount">-${discount}%</span>
        </div>
        <div class="home-product-info">
          <small>2P BOX</small>
          <h3>${escapeHtml(product.name)}</h3>
          <div class="home-promotion-prices">
            <s>${money(original)}</s>
            <strong>${money(promo)}</strong>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

function setupHomeProductTabs(rows: PromotionRow[]) {
  const catalog = document.querySelector<HTMLElement>('#catalogo');
  const head = catalog?.querySelector<HTMLElement>('.home-section-head');
  const grid = catalog?.querySelector<HTMLElement>('.home-product-grid');
  if (!catalog || !head || !grid) return;

  const promotions = validPromotions(rows);
  let tabs = head.querySelector<HTMLElement>('[data-home-product-tabs]');
  if (!tabs) {
    tabs = document.createElement('div');
    tabs.dataset.homeProductTabs = 'true';
    tabs.className = 'home-product-tabs';
    const heading = head.firstElementChild;
    if (heading) heading.appendChild(tabs);
  }

  if (tabs.dataset.ready !== 'true') {
    grid.dataset.allProductsHtml = grid.innerHTML;
    tabs.dataset.ready = 'true';
    tabs.innerHTML = `
      <button type="button" class="home-product-tab is-active" data-product-view="all">TODOS</button>
      <button type="button" class="home-product-tab" data-product-view="offers">🔥 OFERTAS <span data-offers-count></span></button>
    `;

    tabs.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('[data-product-view]');
      if (!button || !tabs) return;

      const view = button.dataset.productView === 'offers' ? 'offers' : 'all';
      tabs.dataset.active = view;
      tabs.querySelectorAll<HTMLButtonElement>('.home-product-tab').forEach((item) => {
        item.classList.toggle('is-active', item === button);
      });

      if (view === 'offers') {
        grid.innerHTML = promotions.length
          ? renderHomePromotionCards(promotions)
          : '<div class="home-promotions-empty">Nenhuma oferta ativa no momento.</div>';
      } else {
        grid.innerHTML = grid.dataset.allProductsHtml || '';
      }

      applyPromotionStyling(rows);
    });
  }

  const count = tabs.querySelector<HTMLElement>('[data-offers-count]');
  if (count) count.textContent = promotions.length ? String(promotions.length) : '';

  const active = tabs.dataset.active === 'offers' ? 'offers' : 'all';
  tabs.querySelectorAll<HTMLButtonElement>('.home-product-tab').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.productView === active);
  });
}

function applyPromotionStyling(rows: PromotionRow[]) {
  if (!rows.length) return;

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

      if (!card.querySelector('[data-marketing-promotion-badge]') && !card.classList.contains('home-promotion-product-card')) {
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

      if (card.classList.contains('home-promotion-product-card')) continue;

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

export function MarketingPromotions() {
  useEffect(() => {
    let cancelled = false;
    let rows: PromotionRow[] = [];
    let cleanup: (() => void) | undefined;

    function apply() {
      if (cancelled) return;
      setupHomeProductTabs(rows);
      applyPromotionStyling(rows);
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

      if (cancelled) return;
      if (error || !Array.isArray(promotions) || promotions.length === 0) {
        rows = [];
        apply();
        return;
      }

      const ids = promotions.map((row) => String(row.product_id));
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id,slug,name,price,image_url,images')
        .in('id', ids)
        .eq('active', true);
      if (cancelled || productsError || !Array.isArray(products)) return;

      const byId = new Map(products.map((product) => [String(product.id), product]));
      rows = promotions
        .map((row) => ({ ...row, product: byId.get(String(row.product_id)) || null }))
        .filter((row) => row.product) as PromotionRow[];

      apply();
      let scheduled = false;
      const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          apply();
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      cleanup = () => observer.disconnect();
    }

    void load();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <style jsx global>{`
      .home-product-tabs{display:flex;align-items:center;gap:6px;margin-top:16px}
      .home-product-tab{appearance:none;border:1px solid #dedede;background:#fff;color:#666;border-radius:999px;padding:9px 14px;cursor:pointer;font:900 9px Inter,Arial,sans-serif;letter-spacing:.09em;transition:all .18s ease}
      .home-product-tab:hover{border-color:#111;color:#111}
      .home-product-tab.is-active{background:#111;border-color:#111;color:#fff}
      .home-product-tab.is-active[data-product-view="offers"]{background:${PROMO_YELLOW};border-color:${PROMO_YELLOW};color:#111}
      .home-product-tab span{margin-left:3px;opacity:.72}
      .home-promotion-product-image{position:relative}
      .home-promotion-product-image img{display:block;width:100%;height:100%;object-fit:contain}
      .home-promotion-badge,.home-promotion-discount{position:absolute;z-index:2;top:11px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.05em}
      .home-promotion-badge{left:11px;padding:7px 10px;background:${PROMO_YELLOW};color:#111;box-shadow:0 3px 10px rgba(0,0,0,.12)}
      .home-promotion-discount{right:11px;padding:7px 9px;background:#111;color:#fff}
      .home-promotion-prices{display:flex;flex-direction:column;gap:2px;margin-top:auto;line-height:1}
      .home-promotion-prices s{color:#999;font-size:11px;font-weight:700}
      .home-promotion-prices strong{color:${PROMO_YELLOW};font-size:20px;font-weight:900;letter-spacing:-.02em}
      .home-promotions-empty{grid-column:1/-1;padding:38px 20px;border:1px dashed #ddd;border-radius:14px;background:#fff;text-align:center;color:#777;font-size:13px}
      @media(max-width:900px){
        .home-product-tabs{margin-top:13px}
      }
      @media(max-width:520px){
        .home-product-tabs{gap:5px}
        .home-product-tab{padding:8px 11px;font-size:8px}
        .home-promotion-badge,.home-promotion-discount{top:8px;font-size:8px}
        .home-promotion-badge{left:8px;padding:6px 8px}
        .home-promotion-discount{right:8px;padding:6px 7px}
        .home-promotion-prices strong{font-size:17px}
      }
    `}</style>
  );
}