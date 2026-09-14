type Scope = 'payment-brick' | 'checkout' | 'pix' | 'delivery';

type Detail = {
  orderId?: string | null;
  type?: unknown;
  cause?: unknown;
  message?: unknown;
};

export function reportClientError(scope: Scope, detail: Detail) {
  if (typeof window === 'undefined') return;

  console.error(`[${scope}]`, detail);

  const payload = JSON.stringify({
    scope,
    orderId: detail.orderId ?? null,
    type: detail.type == null ? null : String(detail.type),
    cause: detail.cause == null ? null : String(detail.cause),
    message: detail.message == null ? null : String(detail.message),
    url: window.location.pathname,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/telemetria/erro', new Blob([payload], { type: 'application/json' }));
      return;
    }
  } catch {
  }

  fetch('/api/telemetria/erro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
