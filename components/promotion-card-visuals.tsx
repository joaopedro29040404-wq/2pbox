'use client';

import { useEffect } from 'react';

const PROMOTION_CARD_CLASS = 'promotion-card';

function parseMoney(value: string) {
  return Number(value.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.'));
}

function findProductCard(node: Element): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  if (node.matches('.home-promotion-product-card')) return node;
  if (node.matches('.product')) return node;
  return (node.closest('.product') as HTMLElement | null) || (node.closest('.home-product-card') as HTMLElement | null);
}

function ensureFavorite(card: HTMLElement) {
  const imageWrap = card.querySelector<HTMLElement>('.product-image-wrap, .home-promotion-product-image, .home-product-image');
  if (!imageWrap || card.querySelector('.promotion-card-favorite')) return;

  const existingFavorite = card.querySelector<HTMLElement>('.product-favorite');
  if (existingFavorite) {
    existingFavorite.classList.add('promotion-card-favorite');
    return;
  }

  const favorite = document.createElement('span');
  favorite.className = 'promotion-card-favorite promotion-card-fake-favorite';
  favorite.setAttribute('aria-hidden', 'true');
  favorite.textContent = '♡';
  imageWrap.appendChild(favorite);
}

function ensureDiscountSeal(card: HTMLElement, original: number, promo: number) {
  const imageWrap = card.querySelector<HTMLElement>('.product-image-wrap, .home-promotion-product-image, .home-product-image');
  if (!imageWrap) return;

  const discount = Math.max(1, Math.round(((original - promo) / original) * 100));
  const existing = imageWrap.querySelector<HTMLElement>('.home-promotion-discount');
  const seal = existing || document.createElement('span');
  seal.className = 'promotion-card-discount';
  seal.innerHTML = `<strong>${discount}%</strong><span>OFF</span>`;
  if (!existing) imageWrap.appendChild(seal);
}

function moveOfferBadge(card: HTMLElement) {
  const badge = card.querySelector<HTMLElement>('[data-marketing-promotion-badge]');
  if (!badge) return;
  badge.classList.add('promotion-card-offer-badge');
  const imageWrap = card.querySelector<HTMLElement>('.product-image-wrap, .home-promotion-product-image, .home-product-image');
  if (imageWrap && !imageWrap.contains(badge)) imageWrap.appendChild(badge);
}

function markAndStyle(card: HTMLElement) {
  if (card.dataset.promotionCardReady === 'true') return;

  const price = card.querySelector<HTMLElement>('[data-marketing-promotion-price], .home-promotion-prices');
  const oldPrice = price?.querySelector('s')?.textContent || '';
  const currentPrice = price?.querySelector('strong')?.textContent || '';
  const original = parseMoney(oldPrice);
  const promo = parseMoney(currentPrice);
  if (!Number.isFinite(original) || !Number.isFinite(promo) || promo <= 0 || promo >= original) return;

  card.classList.add(PROMOTION_CARD_CLASS);
  card.dataset.promotionCardReady = 'true';
  moveOfferBadge(card);
  ensureFavorite(card);
  ensureDiscountSeal(card, original, promo);
}

export function PromotionCardVisuals() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    const process = () => {
      if (cancelled) return;
      document.querySelectorAll<HTMLElement>('[data-marketing-promotion-badge], .home-promotion-product-card').forEach((node) => {
        const card = findProductCard(node);
        if (card) markAndStyle(card);
      });
    };

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      process();
      observer = new MutationObserver(process);
      observer.observe(document.body, { childList: true, subtree: true });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  return (
    <style jsx global>{`
      .promotion-card{position:relative!important;overflow:hidden!important;min-width:0!important;max-width:100%!important;background:#fff!important;border:1px solid #e6b900!important;border-radius:14px!important;box-shadow:0 8px 24px rgba(17,17,17,.045)!important;color:#111!important;transition:border-color .18s,box-shadow .18s,transform .18s!important}
      .promotion-card:hover{border-color:#d8aa00!important;box-shadow:0 12px 30px rgba(17,17,17,.09)!important;transform:translateY(-1px)}
      .promotion-card .product-image-wrap,.promotion-card .product-image,.promotion-card .home-product-image,.promotion-card .home-promotion-product-image{position:relative!important;overflow:hidden!important;background:#f6f6f6!important}
      .promotion-card .product-image img,.promotion-card .home-product-image img,.promotion-card .home-promotion-product-image img{display:block;width:100%;height:100%;object-fit:contain!important}
      .promotion-card .product-body,.promotion-card .home-product-info{min-width:0!important;max-width:100%!important;overflow:hidden!important;padding:16px!important;background:#fff!important}
      .promotion-card .product-info-link small,.promotion-card .home-product-info small{display:block!important;margin:0 0 7px!important;color:#b18400!important;font-size:9px!important;font-weight:900!important;letter-spacing:.08em!important;line-height:1.2!important;text-transform:uppercase!important}
      .promotion-card .product-info-link h2,.promotion-card .home-product-info h3{margin:0!important;color:#111!important;font-size:17px!important;font-weight:900!important;line-height:1.12!important;letter-spacing:-.02em!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;overflow:hidden!important;overflow-wrap:anywhere!important}
      .promotion-card .product-info-link p{margin:10px 0 0!important;color:#777!important;font-size:11px!important;line-height:1.45!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;overflow:hidden!important}
      .promotion-card .product-buy{display:flex!important;align-items:flex-end!important;justify-content:space-between!important;gap:10px!important;margin-top:auto!important;padding-top:15px!important}
      .promotion-card [data-marketing-promotion-price],.promotion-card .home-promotion-prices{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;margin:0!important;line-height:1!important}
      .promotion-card [data-marketing-promotion-price] s,.promotion-card .home-promotion-prices s{color:#8b8b8b!important;font:700 12px Inter,Arial,sans-serif!important;line-height:1.1!important;white-space:nowrap!important}
      .promotion-card [data-marketing-promotion-price] strong,.promotion-card .home-promotion-prices strong{color:#f2ad00!important;font:900 22px Inter,Arial,sans-serif!important;line-height:1!important;letter-spacing:-.03em!important;white-space:nowrap!important}
      .promotion-card .catalog-add-button{flex:0 0 auto!important;min-height:40px!important;height:40px!important;padding:0 14px!important;border:0!important;border-radius:8px!important;background:#ffc400!important;color:#111!important;font:900 11px Inter,Arial,sans-serif!important;box-shadow:none!important}
      .promotion-card .catalog-add-button:hover{background:#f4b900!important}
      .promotion-card .product-favorite,.promotion-card .promotion-card-favorite{position:absolute!important;right:10px!important;top:10px!important;z-index:8!important;width:32px!important;height:32px!important;min-width:32px!important;max-width:32px!important;min-height:32px!important;max-height:32px!important;padding:0!important;margin:0!important;box-sizing:border-box!important;border:1px solid rgba(17,17,17,.08)!important;border-radius:9px!important;background:rgba(255,255,255,.88)!important;color:#555!important;box-shadow:0 2px 8px rgba(0,0,0,.07)!important;display:grid!important;place-items:center!important;font:400 25px Arial,sans-serif!important;line-height:1!important}
      .promotion-card .promotion-card-offer-badge,.promotion-card .home-promotion-badge{position:absolute!important;left:10px!important;top:10px!important;right:auto!important;z-index:7!important;padding:7px 11px!important;border-radius:999px!important;background:#ffc400!important;color:#111!important;font:900 10px Inter,Arial,sans-serif!important;letter-spacing:.05em!important;line-height:1!important;box-shadow:0 3px 10px rgba(0,0,0,.10)!important}
      .promotion-card .promotion-card-discount{position:absolute!important;left:10px!important;bottom:10px!important;z-index:7!important;width:64px!important;height:64px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;padding:4px!important;background:#ef2834!important;color:#fff!important;clip-path:polygon(50% 0%,61% 7%,75% 5%,83% 16%,95% 22%,93% 36%,100% 50%,93% 63%,95% 78%,83% 84%,75% 95%,61% 93%,50% 100%,39% 93%,25% 95%,17% 84%,5% 78%,7% 63%,0% 50%,7% 36%,5% 22%,17% 16%,25% 5%,39% 7%)!important;filter:drop-shadow(0 3px 7px rgba(0,0,0,.16));text-align:center!important}
      .promotion-card .promotion-card-discount strong{font:900 20px/1 Inter,Arial,sans-serif!important}
      .promotion-card .promotion-card-discount span{font:900 12px/1 Inter,Arial,sans-serif!important;margin-top:3px!important}
      .promotion-card.home-promotion-product-card .home-promotion-prices{padding-right:90px!important}
      .promotion-card.home-promotion-product-card::after{content:'Adicionar';position:absolute;right:16px;bottom:16px;min-width:76px;height:40px;padding:0 12px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#ffc400;color:#111;font:900 11px Inter,Arial,sans-serif;pointer-events:none}
      @media (max-width:700px){
        .promotion-card .product-body,.promotion-card .home-product-info{padding:12px!important}
        .promotion-card .product-info-link h2,.promotion-card .home-product-info h3{font-size:14px!important}
        .promotion-card .product-info-link p{font-size:10px!important}
        .promotion-card [data-marketing-promotion-price] strong,.promotion-card .home-promotion-prices strong{font-size:19px!important}
        .promotion-card .catalog-add-button{min-height:38px!important;height:38px!important;padding:0 11px!important;font-size:10px!important}
        .promotion-card .promotion-card-discount{width:56px!important;height:56px!important}
        .promotion-card .promotion-card-discount strong{font-size:17px!important}
        .promotion-card .promotion-card-discount span{font-size:10px!important}
        .promotion-card.home-promotion-product-card::after{right:12px;bottom:12px;height:38px;min-width:68px;font-size:10px}
        .promotion-card.home-promotion-product-card .home-promotion-prices{padding-right:80px!important}
      }
    `}</style>
  );
}
