'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = '2p-analytics-session';
const ATTRIBUTION_KEY = '2p-analytics-attribution';
const CART_KEY = '2pbox-cart';
const LAST_CHECKOUT_KEY = '2p-analytics-last-checkout';

type Attribution = { source: string | null; medium: string | null; campaign: string | null; referrer: string | null };
type CartItem = { id: string; name: string; price: number; quantity: number };
type EventPayload = { event_name: string; page_path?: string; product_id?: string; order_id?: string; value?: number; metadata?: Record<string, unknown> };

function getSessionId() {
  try {
    let value = localStorage.getItem(SESSION_KEY);
    if (!value) { value = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, value); }
    return value;
  } catch { return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function getAttribution(): Attribution {
  try {
    const params = new URLSearchParams(window.location.search);
    const current: Attribution = { source: params.get('utm_source')?.trim().toLowerCase() || null, medium: params.get('utm_medium')?.trim().toLowerCase() || null, campaign: params.get('utm_campaign')?.trim() || null, referrer: document.referrer || null };
    const saved = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || 'null') as Attribution | null;
    if (!saved && (current.source || current.medium || current.campaign || current.referrer)) localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(current));
    return saved || current;
  } catch { return { source: null, medium: null, campaign: null, referrer: null }; }
}

function deviceType() { const width = window.innerWidth; if (width < 768) return 'mobile'; if (width < 1024) return 'tablet'; return 'desktop'; }
function readCart(): CartItem[] { try { const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(parsed) ? parsed.map((item) => ({ id: String(item.id), name: String(item.name || ''), price: Number(item.price || 0), quantity: Number(item.quantity || 0) })) : []; } catch { return []; } }
function cartTotal(items: CartItem[]) { return items.reduce((sum, item) => sum + item.price * item.quantity, 0); }

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let lastCart = readCart();
    let cartInitialized = false;
    let stopped = false;
    let excludedPromise: Promise<boolean> | null = null;

    async function isExcluded() {
      if (!excludedPromise) {
        excludedPromise = originalFetch(`/api/admin/analytics/devices?session_id=${encodeURIComponent(getSessionId())}`, { cache: 'no-store' })
          .then((response) => response.ok ? response.json() : { excluded: false })
          .then((result) => Boolean(result?.excluded))
          .catch(() => false);
      }
      return excludedPromise;
    }

    async function send(payload: EventPayload) {
      if (stopped || await isExcluded()) return;
      const attribution = getAttribution();
      try {
        await originalFetch('/api/analytics/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, session_id: getSessionId(), utm_source: attribution.source, utm_medium: attribution.medium, utm_campaign: attribution.campaign, referrer: attribution.referrer, device_type: deviceType() }), keepalive: true });
      } catch {}
    }

    const currentPath = pathname || window.location.pathname;
    void send({ event_name: 'page_view', page_path: currentPath });
    if (currentPath.startsWith('/produto/')) {
      const slug = decodeURIComponent(currentPath.split('/').filter(Boolean)[1] || '');
      if (slug) void send({ event_name: 'product_view', page_path: currentPath, metadata: { slug } });
    }
    if (currentPath === '/checkout') {
      const items = readCart();
      if (items.length) {
        const marker = `${getSessionId()}:${currentPath}`;
        try {
          if (sessionStorage.getItem(LAST_CHECKOUT_KEY) !== marker) { sessionStorage.setItem(LAST_CHECKOUT_KEY, marker); void send({ event_name: 'begin_checkout', page_path: currentPath, value: cartTotal(items) }); }
        } catch { void send({ event_name: 'begin_checkout', page_path: currentPath, value: cartTotal(items) }); }
      }
    }

    const interval = window.setInterval(() => {
      const nextCart = readCart();
      if (!cartInitialized) { lastCart = nextCart; cartInitialized = true; return; }
      if (JSON.stringify(nextCart) === JSON.stringify(lastCart)) return;
      const before = new Map(lastCart.map((item) => [item.id, item]));
      const after = new Map(nextCart.map((item) => [item.id, item]));
      for (const item of nextCart) {
        const previous = before.get(item.id);
        if (!previous || item.quantity > previous.quantity) void send({ event_name: 'add_to_cart', product_id: item.id, value: cartTotal(nextCart), metadata: { quantity: Math.max(1, item.quantity - (previous?.quantity || 0)), name: item.name } });
      }
      for (const item of lastCart) {
        const current = after.get(item.id);
        if (!current || current.quantity < item.quantity) void send({ event_name: 'remove_from_cart', product_id: item.id, value: cartTotal(nextCart), metadata: { quantity: item.quantity - (current?.quantity || 0), name: item.name } });
      }
      lastCart = nextCart;
    }, 500);

    const previousFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/mercadopago/create-payment')) {
        let orderId: string | undefined;
        let amount = 0;
        try { const raw = typeof init?.body === 'string' ? JSON.parse(init.body) : null; orderId = raw?.orderId ? String(raw.orderId) : undefined; amount = Number(raw?.total || 0); } catch {}
        void send({ event_name: 'payment_started', page_path: window.location.pathname, order_id: orderId, value: Number.isFinite(amount) ? amount : 0, metadata: { endpoint: '/api/mercadopago/create-payment' } });
      }
      return previousFetch(input, init);
    };

    const orderAttributionInterval = window.setInterval(() => {
      try {
        const orderId = localStorage.getItem('2p_last_order_id');
        const sentKey = `2p-analytics-order:${orderId}`;
        if (!orderId || sessionStorage.getItem(sentKey)) return;
        sessionStorage.setItem(sentKey, '1');
        const attribution = getAttribution();
        void originalFetch('/api/analytics/order-attribution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId, session_id: getSessionId(), utm_source: attribution.source, utm_medium: attribution.medium, utm_campaign: attribution.campaign }), keepalive: true }).catch(() => undefined);
      } catch {}
    }, 500);

    return () => { stopped = true; window.clearInterval(interval); window.clearInterval(orderAttributionInterval); window.fetch = previousFetch; };
  }, [pathname]);

  return null;
}
