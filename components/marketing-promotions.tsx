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

function renderHomePromotions(rows: PromotionRow[]) {
  const categorySection = document.querySelector<HTMLElement>('#categorias');
  if (!categorySection) return;

  let section = document.querySelector<HTMLElement>('#home-promotions');
  if (!section) {
    section = document.createElement('section');
    section.id = 'home-promotions';
    section.className = 'home-section home-promotions-section';
    categorySection.insertAdjacentElement('afterend', section);
  }

  const products = rows
    .map((row) => {
      const product = row.product;
      const original = Number(product?.price);
      const promo = Number(row.promotional_price);
      if (!product || !Number.isFinite(original) || !Number.isFinite(promo) || promo <= 0 || promo >= original) return null;
      return { ...row, product, original, promo };
    })
    .filter(Boolean) as Array<PromotionRow & { product: PromotionProduct; original: number; promo: number }>;

  if (!products.length) {
    section.remove();
    return;
  }

  section.innerHTML = `
    <div class="home-container">
      <div class="home-section-head home-promotions-head">
        <div>
          <p class="home-eyebrow">OFERTAS ESPECIAIS</p>
          <h2>PROMOÇÕES</h2>
          <p class="home-promotions-subtitle">Aproveite os produtos com preços especiais por tempo limitado.</p>
        </div>
        <span class="home-promotions-count">${products.length} ${products.length === 1 ? 'oferta ativa' : 'ofertas ativas'}</span>
      </div>
      <div class="home-promotions-grid">
        ${products.map(({ product, original, promo }) => {
          const discount = Math.round(((original - promo) / original) * 100);
          const image = product.images?.[0] || product.image_url || '';
          return `
            <a href="/produto/${encodeURIComponent(product.slug)}" class="home-promotion-card">
              <div class="home-promotion-image">
                ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" />` : '<div class="home-promotion-placeholder">2P BOX</div>'}
                <span class="home-promotion-badge">OFERTA</span>
                <span class="home-promotion-discount">-${discount}%</span>
              </div>
              <div class="home-promotion-info">
                <small>2P BOX</small>
                <h3>${escapeHtml(product.name)}</h3>
                <div class="home-promotion-prices">
                  <s>${money(original)}</s>
                  <strong>${money(promo)}</strong>
                </div>
              </div>
            </a>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function MarketingPromotions() {
  useEffect(() => {
    let cancelled = false;
    let rows: PromotionRow[] = [];

    function applyPromotions() {
      if (cancelled) return;

      renderHomePromotions(rows);
      if (!rows.length) return;

      for (const row of rows) {
        const product = row.product;
        const slug = String(product?.slug || '').trim();
        const original = Number(product?.price);
        const promo = Number(row.promotional_price);
        if (!slug || !Number.isFinite(original) || !Number.isFinite(promo) || promo <= 0 || promo >= original) continue;

        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href="/produto/${slug}"]`));
        for (const link of links) {
          const card = link.classList.contains('home-product-card') || link.classList.contains('home-promotion-card')
            ? link
            : (link.closest('.product') as HTMLElement | null) ||
              (link.closest('[class*="product-card"]') as HTMLElement | null) ||
              null;
          if (!card) continue;

          constrainPromotionCard(card);

          if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

          if (!card.querySelector('[data-marketing-promotion-badge]') && !card.classList.contains('home-promotion-card')) {
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

          if (card.classList.contains('home-promotion-card')) continue;

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
      if (cancelled || error || !Array.isArray(promotions) || promotions.length === 0) {
        renderHomePromotions([]);
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

      applyPromotions();
      const observer = new MutationObserver(() => applyPromotions());
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    let cleanup: (() => void) | undefined;
    void load().then((dispose) => { cleanup = dispose; });
    return () => { cancelled = true; cleanup?.(); document.querySelector('#home-promotions')?.remove(); };
  }, []);

  return (
    <style jsx global>{`
      .home-promotions-section{background:#fff;border-top:1px solid #e7e7e7;border-bottom:1px solid #e7e7e7;padding:72px 0}
      .home-promotions-head{margin-bottom:28px;align-items:flex-end}
      .home-promotions-subtitle{margin:10px 0 0;color:#777;font-size:13px;line-height:1.5}
      .home-promotions-count{display:inline-flex;align-items:center;min-height:34px;padding:0 13px;border:1px solid #e5e5e5;border-radius:999px;color:#777;background:#fff;font-size:10px;font-weight:800;letter-spacing:.04em;white-space:nowrap}
      .home-promotions-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
      .home-promotion-card{position:relative;display:flex;min-width:0;overflow:hidden;flex-direction:column;background:#fff;border:1px solid #e1e1e1;border-radius:14px;color:#111;text-decoration:none;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
      .home-promotion-card:hover{transform:translateY(-3px);border-color:#d7c170;box-shadow:0 12px 28px rgba(0,0,0,.08)}
      .home-promotion-image{position:relative;aspect-ratio:1/1;overflow:hidden;background:#f5f5f3}
      .home-promotion-image img{display:block;width:100%;height:100%;object-fit:contain;transition:transform .25s ease}
      .home-promotion-card:hover .home-promotion-image img{transform:scale(1.035)}
      .home-promotion-placeholder{display:grid;width:100%;height:100%;place-items:center;color:#aaa;font-size:13px;font-weight:900;letter-spacing:.12em}
      .home-promotion-badge,.home-promotion-discount{position:absolute;z-index:2;top:11px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.05em}
      .home-promotion-badge{left:11px;padding:7px 10px;background:#ffc400;color:#111;box-shadow:0 3px 10px rgba(0,0,0,.12)}
      .home-promotion-discount{right:11px;padding:7px 9px;background:#111;color:#fff}
      .home-promotion-info{display:flex;min-width:0;flex:1;flex-direction:column;padding:16px}
      .home-promotion-info small{color:#999;font-size:8px;font-weight:900;letter-spacing:.08em}
      .home-promotion-info h3{display:-webkit-box;min-height:42px;margin:7px 0 13px;overflow:hidden;font-family:'Barlow Condensed',sans-serif;font-size:22px;line-height:.96;font-weight:800;text-transform:uppercase;-webkit-box-orient:vertical;-webkit-line-clamp:2}
      .home-promotion-prices{display:flex;flex-direction:column;gap:2px;margin-top:auto;line-height:1}
      .home-promotion-prices s{color:#999;font-size:11px;font-weight:700}
      .home-promotion-prices strong{color:#111;font-size:20px;font-weight:900;letter-spacing:-.02em}
      @media(max-width:900px){
        .home-promotions-section{padding:58px 0}
        .home-promotions-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
        .home-promotions-head{align-items:flex-start}
        .home-promotions-count{margin-top:3px}
      }
      @media(max-width:520px){
        .home-promotions-section{padding:48px 0}
        .home-promotions-head{display:block}
        .home-promotions-head h2{font-size:38px}
        .home-promotions-count{margin-top:14px}
        .home-promotions-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .home-promotion-info{padding:12px}
        .home-promotion-info h3{min-height:38px;font-size:18px;margin:6px 0 10px}
        .home-promotion-prices strong{font-size:17px}
        .home-promotion-badge,.home-promotion-discount{top:8px;font-size:8px}
        .home-promotion-badge{left:8px;padding:6px 8px}
        .home-promotion-discount{right:8px;padding:6px 7px}
      }
    `}</style>
  );
}
