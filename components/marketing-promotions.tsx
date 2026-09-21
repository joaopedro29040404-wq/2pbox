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
  card.classList.add('promotion-offer-card');
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

function renderCatalogPromotionSeal(card: HTMLElement, discount: number) {
  const image = card.querySelector<HTMLElement>('.product-image');
  if (!image || image.querySelector('[data-promotion-discount-seal]')) return;

  const seal = document.createElement('span');
  seal.dataset.promotionDiscountSeal = 'true';
  seal.className = 'promotion-discount-seal';
  seal.innerHTML = `<span class="promotion-discount-value">${discount}%</span><span class="promotion-discount-label">OFF</span>`;
  image.appendChild(seal);
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
      <a href="/produto/${encodeURIComponent(product.slug)}" class="home-product-card home-promotion-product-card promotion-offer-card">
        <div class="home-product-image home-promotion-product-image">
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="eager" />` : '<div class="home-promotion-placeholder">2P BOX</div>'}
          <span class="home-promotion-badge">OFERTA</span>
          <span class="home-promotion-discount"><span class="promotion-discount-value">${discount}%</span><span class="promotion-discount-label">OFF</span></span>
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

      const existingOfferCards = Array.from(grid.querySelectorAll<HTMLElement>('.home-promotion-product-card'));
      const nativeCards = Array.from(grid.children).filter(
        (child) => !(child as HTMLElement).classList.contains('home-promotion-product-card')
      ) as HTMLElement[];

      if (view === 'offers') {
        nativeCards.forEach((card) => {
          card.hidden = true;
        });
        existingOfferCards.forEach((card) => card.remove());
        grid.insertAdjacentHTML(
          'beforeend',
          promotions.length
            ? renderHomePromotionCards(promotions)
            : '<div class="home-promotions-empty home-promotion-product-card promotion-offer-card">Nenhuma oferta ativa no momento.</div>'
        );
        grid.querySelectorAll<HTMLElement>('.home-promotion-product-card').forEach((card) => {
          card.hidden = false;
        });
      } else {
        existingOfferCards.forEach((card) => card.remove());
        nativeCards.forEach((card) => {
          card.hidden = false;
        });
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
    const discount = Math.round(((original - promo) / original) * 100);

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
        renderCatalogPromotionSeal(card, discount);
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


}

export function MarketingPromotions() {
  useEffect(() => {
    let cancelled = false;
    let rows: PromotionRow[] = [];
    let cleanup: (() => void) | undefined;
    let frame = 0;

    function apply() {
      if (cancelled) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!cancelled) {
          setupHomeProductTabs(rows);
          applyPromotionStyling(rows);
        }
      });
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
      const observer = new MutationObserver(() => apply());
      observer.observe(document.body, { childList: true, subtree: true });
      cleanup = () => {
        observer.disconnect();
        if (frame) cancelAnimationFrame(frame);
      };
    }

    void load();
    return () => {
      cancelled = true;
      cleanup?.();
      if (frame) cancelAnimationFrame(frame);
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

      .promotion-offer-card{border:2px solid #e7ad00!important;border-radius:20px!important;background:#fff!important;box-shadow:0 8px 24px rgba(0,0,0,.05)!important}
      .promotion-offer-card:hover{border-color:#d59f00!important;box-shadow:0 12px 30px rgba(0,0,0,.08)!important}

      .home-promotion-product-image{position:relative}
      .home-promotion-product-image img{display:block;width:100%;height:100%;object-fit:contain}
      .home-promotion-badge,.home-promotion-discount{position:absolute;z-index:2;font-weight:900;letter-spacing:.04em}
      .home-promotion-badge{left:13px;top:13px;padding:10px 15px;background:${PROMO_YELLOW};color:#111;border-radius:999px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.12)}
      .home-promotion-discount{left:13px;bottom:13px;width:82px;height:82px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:#ef1f2f;color:#fff;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.16);clip-path:polygon(50% 0%,58% 7%,68% 3%,74% 13%,85% 12%,87% 23%,97% 28%,93% 39%,100% 50%,93% 61%,97% 72%,87% 77%,85% 88%,74% 87%,68% 97%,58% 93%,50% 100%,42% 93%,32% 97%,26% 87%,15% 88%,13% 77%,3% 72%,7% 61%,0% 50%,7% 39%,3% 28%,13% 23%,15% 12%,26% 13%,32% 3%,42% 7%)}
      .promotion-discount-value{display:block;font:900 23px/1 Inter,Arial,sans-serif;letter-spacing:-.03em}
      .promotion-discount-label{display:block;margin-top:3px;font:900 13px/1 Inter,Arial,sans-serif;letter-spacing:.02em}
      .home-promotion-prices{display:flex;flex-direction:column;gap:3px;margin-top:auto;line-height:1}
      .home-promotion-prices s{color:#888;font-size:13px;font-weight:700}
      .home-promotion-prices strong{color:${PROMO_YELLOW};font-size:26px;font-weight:900;letter-spacing:-.02em}

      .promotion-offer-card.product .product-image{position:relative}
      .promotion-offer-card.product .product-image-wrap{background:#f7f7f7}
      .promotion-offer-card.product .product-body{padding:16px 16px 15px}
      .promotion-offer-card.product .product-info-link small{color:#a37b00}
      .promotion-offer-card.product .product-info-link h2{font-weight:900}
      .promotion-offer-card.product .product-buy{align-items:flex-end;gap:14px}
      .promotion-offer-card.product [data-marketing-promotion-price]{flex:1;min-width:0}
      .promotion-offer-card.product [data-marketing-promotion-price] s{color:#888!important;font-size:13px!important}
      .promotion-offer-card.product [data-marketing-promotion-price] strong{color:${PROMO_YELLOW}!important;font-size:26px!important;font-weight:900!important}
      .promotion-offer-card.product .catalog-add-button{min-height:52px;padding:0 22px;border-radius:10px;background:${PROMO_YELLOW};color:#111;font-size:13px;font-weight:900;box-shadow:0 4px 10px rgba(0,0,0,.08)}

      .promotion-discount-seal{position:absolute;left:12px;bottom:12px;z-index:4;width:82px;height:82px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10px;box-sizing:border-box;background:#ef1f2f;color:#fff;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.16);clip-path:polygon(50% 0%,58% 7%,68% 3%,74% 13%,85% 12%,87% 23%,97% 28%,93% 39%,100% 50%,93% 61%,97% 72%,87% 77%,85% 88%,74% 87%,68% 97%,58% 93%,50% 100%,42% 93%,32% 97%,26% 87%,15% 88%,13% 77%,3% 72%,7% 61%,0% 50%,7% 39%,3% 28%,13% 23%,15% 12%,26% 13%,32% 3%,42% 7%)}
      .promotion-discount-seal .promotion-discount-value{font-size:23px}
      .promotion-discount-seal .promotion-discount-label{font-size:13px}

      .home-promotions-empty{grid-column:1/-1;padding:38px 20px;border:1px dashed #ddd;border-radius:14px;background:#fff;text-align:center;color:#777;font-size:13px}
      @media(max-width:900px){
        .home-product-tabs{margin-top:13px}
        .promotion-offer-card.product .catalog-add-button{min-height:46px}
      }
      @media(max-width:520px){
        .home-product-tabs{gap:5px}
        .home-product-tab{padding:8px 11px;font-size:8px}
        .home-promotion-badge{left:8px;top:8px;padding:7px 10px;font-size:9px}
        .home-promotion-discount{left:8px;bottom:8px;width:64px;height:64px}
        .home-promotion-discount .promotion-discount-value{font-size:17px}
        .home-promotion-discount .promotion-discount-label{font-size:10px;margin-top:2px}
        .home-promotion-prices strong{font-size:20px}
        .promotion-discount-seal{left:8px;bottom:8px;width:64px;height:64px;padding:7px}
        .promotion-discount-seal .promotion-discount-value{font-size:17px}
        .promotion-discount-seal .promotion-discount-label{font-size:10px;margin-top:2px}
        .promotion-offer-card.product .product-body{padding:11px}
        .promotion-offer-card.product .product-buy{display:block;padding-top:12px}
        .promotion-offer-card.product [data-marketing-promotion-price] strong{font-size:21px!important}
        .promotion-offer-card.product .catalog-add-button{width:100%;margin-top:10px;min-height:46px}
      }
    `}</style>
  );
}
