import { getMercadoPagoAccessToken } from './env';
import { fetchJson } from './http';
import { cacheGet, cacheSet } from './redis';
import { supabaseRest, supabaseRpc } from './supabase-admin';

const API = 'https://api.mercadopago.com';

const APPROVED = new Set(['approved', 'processed', 'accredited']);
const REJECTED = new Set(['rejected', 'failed']);
const CANCELLED = new Set(['cancelled', 'canceled']);
const REFUNDED = new Set(['refunded', 'charged_back']);
const IN_PROGRESS = new Set(['pending', 'in_process', 'authorized', 'processing', 'action_required', 'created']);

export const TERMINAL_PAYMENT_STATUSES = new Set(['paid', 'failed', 'refunded']);

export type StorePaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export function toStorePaymentStatus(mercadoPagoStatus: string): StorePaymentStatus {
  switch (String(mercadoPagoStatus || '').toLowerCase()) {
    case 'approved':
      return 'paid';
    case 'rejected':
    case 'cancelled':
      return 'failed';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending';
  }
}

export const STATUS_PRIORITY: Record<string, number> = {
  processed: 100,
  approved: 100,
  accredited: 100,
  authorized: 80,
  in_process: 60,
  pending: 40,
  failed: 20,
  rejected: 20,
  canceled: 10,
  cancelled: 10,
  refunded: 5,
  charged_back: 5,
};

export type SyncedPayment = {
  paymentStatus: StorePaymentStatus | string;
  normalizedStatus: string;
  orderStatus: string;
  mpStatus: string;
  paymentId: string;
  statusDetail: string | null;
  paymentMethod: string | null;
  paymentType: string | null;
  installments: number | null;
  paymentAmount: number | null;
  paidAt: string | null;
  paymentUpdatedAt: string | null;
  updatedAt: string | null;
  changed: boolean;
};

export function normalizePaymentStatus(payment: any) {
  const mpStatus = String(payment?.status || '').toLowerCase();
  const mpOrderStatus = String(payment?.order_status || '').toLowerCase();
  const mpDetail = String(payment?.status_detail || payment?.order_status_detail || '').toLowerCase();
  const effective = mpOrderStatus || mpStatus;

  if (APPROVED.has(effective) || APPROVED.has(mpStatus) || mpDetail === 'accredited') return 'approved';
  if (REFUNDED.has(effective) || REFUNDED.has(mpStatus)) return 'refunded';
  if (REJECTED.has(effective) || REJECTED.has(mpStatus)) return 'rejected';
  if (CANCELLED.has(effective) || CANCELLED.has(mpStatus)) return 'cancelled';
  if (IN_PROGRESS.has(effective)) {
    if (effective === 'processing' || effective === 'action_required' || effective === 'created') return 'pending';
    return effective;
  }
  return 'pending';
}

function authHeaders() {
  const accessToken = getMercadoPagoAccessToken();
  if (!accessToken) throw new Error('Mercado Pago não configurado.');
  return { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
}

export function isMercadoPagoConfigured() {
  return Boolean(getMercadoPagoAccessToken());
}

export async function fetchMercadoPagoResource(type: 'payment' | 'order', resourceId: string) {
  const endpoint = type === 'order' ? `/v1/orders/${encodeURIComponent(resourceId)}` : `/v1/payments/${encodeURIComponent(resourceId)}`;
  const { ok, status, data } = await fetchJson(`${API}${endpoint}`, { headers: authHeaders() });
  return { ok, status, resource: data };
}

export function normalizeOrderResource(order: any, fallbackOrderId: string) {
  const payment = order?.transactions?.payments?.[0];
  if (!payment) return null;
  const orderStatus = String(order?.status || '').toLowerCase();
  const paymentStatus = String(payment?.status || '').toLowerCase();
  const effective = APPROVED.has(orderStatus) ? orderStatus : APPROVED.has(paymentStatus) ? paymentStatus : paymentStatus || orderStatus || 'pending';
  return {
    ...payment,
    id: payment?.id || payment?.reference_id || order?.id,
    external_reference: String(order?.external_reference || fallbackOrderId),
    status: effective,
    status_detail: payment?.status_detail || order?.status_detail || null,
    order_status: orderStatus || null,
    order_status_detail: order?.status_detail || null,
  };
}

export async function searchMercadoPagoOrder(externalReference: string) {
  const now = new Date();
  const begin = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    begin_date: begin.toISOString(),
    end_date: now.toISOString(),
    external_reference: externalReference,
    type: 'online',
    page: '1',
    page_size: '50',
    sort_by: 'created_date',
    sort_order: 'desc',
  });
  const { ok, data } = await fetchJson(`${API}/v1/orders?${params.toString()}`, { headers: authHeaders() });
  if (!ok) return null;
  const orders = Array.isArray(data?.data) ? data.data : [];
  return sortByRelevance(orders.filter((item: any) => String(item?.external_reference || '').trim() === externalReference))[0] || null;
}

export async function searchMercadoPagoPayment(externalReference: string) {
  const { ok, data } = await fetchJson(
    `${API}/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=20`,
    { headers: authHeaders() },
  );
  if (!ok) return null;
  const payments = Array.isArray(data?.results) ? data.results : [];
  return sortByRelevance(payments)[0] || null;
}

function sortByRelevance(list: any[]) {
  return [...list].sort((a, b) => {
    const pa = STATUS_PRIORITY[String(a?.status || '').toLowerCase()] || 0;
    const pb = STATUS_PRIORITY[String(b?.status || '').toLowerCase()] || 0;
    if (pb !== pa) return pb - pa;
    const da = new Date(String(a?.last_updated_date || a?.date_last_updated || a?.created_date || a?.date_created || 0)).getTime();
    const db = new Date(String(b?.last_updated_date || b?.date_last_updated || b?.created_date || b?.date_created || 0)).getTime();
    return db - da;
  });
}

export async function resolveMercadoPagoPayment(orderId: string, hints: { paymentId?: string; mpOrderId?: string } = {}) {
  if (!isMercadoPagoConfigured()) return null;

  if (hints.mpOrderId) {
    const result = await fetchMercadoPagoResource('order', hints.mpOrderId);
    if (result.ok) {
      const normalized = normalizeOrderResource(result.resource, orderId);
      if (normalized && String(normalized.external_reference).trim() === orderId) return normalized;
    }
  }

  if (hints.paymentId) {
    const result = await fetchMercadoPagoResource('payment', hints.paymentId);
    if (result.ok && String((result.resource as any)?.external_reference || '').trim() === orderId) return result.resource;
  }

  const mpOrder = await searchMercadoPagoOrder(orderId).catch(() => null);
  const fromOrder = normalizeOrderResource(mpOrder, orderId);
  if (fromOrder && String(fromOrder.external_reference).trim() === orderId) return fromOrder;

  const legacy = await searchMercadoPagoPayment(orderId).catch(() => null);
  if (legacy && String(legacy.external_reference || '').trim() === orderId) return legacy;

  return null;
}

function extractPaymentMethod(payment: any) {
  const method = payment?.payment_method || {};
  const id = String(method?.id || payment?.payment_method_id || '').trim();
  const type = String(method?.type || payment?.payment_type_id || '').trim();
  const installments = Number(method?.installments ?? payment?.installments ?? 0);
  const amount = Number(payment?.amount ?? payment?.transaction_amount ?? 0);
  return {
    id: id || null,
    type: type || null,
    installments: Number.isFinite(installments) && installments > 0 ? installments : null,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
  };
}

const EXTENDED_ORDER_COLUMNS =
  'status,payment_status,payment_status_detail,payment_id,payment_method,payment_type,payment_installments,payment_amount,paid_at,payment_updated_at,updated_at';
const BASE_ORDER_COLUMNS = 'status,payment_status,payment_status_detail,payment_id,payment_updated_at,updated_at';

export type PaymentBilling = {
  paymentMethod: string | null;
  paymentType: string | null;
  installments: number | null;
  paymentAmount: number | null;
  paidAt: string | null;
};

const billingMemo = new Map<string, { value: PaymentBilling; expiresAt: number }>();
const BILLING_MEMO_MS = 60_000;
const BILLING_CACHE_SECONDS = 60 * 30;

/**
 * Dados de faturamento a partir do proprio Mercado Pago. Serve enquanto as
 * colunas payment_method/payment_type/paid_at nao existirem em orders.
 */
export async function fetchPaymentBilling(paymentId: string): Promise<PaymentBilling | null> {
  const id = String(paymentId || '').trim();
  if (!id || !isMercadoPagoConfigured()) return null;

  const memo = billingMemo.get(id);
  if (memo && memo.expiresAt > Date.now()) return memo.value;

  const cached = await cacheGet<PaymentBilling>(`billing:${id}`);
  if (cached) {
    billingMemo.set(id, { value: cached, expiresAt: Date.now() + BILLING_MEMO_MS });
    return cached;
  }

  const result = await fetchMercadoPagoResource('payment', id).catch(() => null);
  if (!result?.ok) return null;

  const payment = result.resource as any;
  const method = extractPaymentMethod(payment);
  const value: PaymentBilling = {
    paymentMethod: method.id,
    paymentType: method.type,
    installments: method.installments,
    paymentAmount: method.amount,
    paidAt: payment?.date_approved || payment?.money_release_date || null,
  };

  billingMemo.set(id, { value, expiresAt: Date.now() + BILLING_MEMO_MS });
  await cacheSet(`billing:${id}`, value, BILLING_CACHE_SECONDS);
  return value;
}

async function readPersistedOrder(orderId: string) {
  const read = async (select: string) => {
    const query = new URLSearchParams({ select, id: `eq.${orderId}`, limit: '1' });
    const payload = await supabaseRest(`orders?${query.toString()}`);
    return Array.isArray(payload) ? payload[0] : null;
  };

  let persisted = await read(EXTENDED_ORDER_COLUMNS).catch(() => null);
  if (!persisted) persisted = await read(BASE_ORDER_COLUMNS);
  if (!persisted) throw new Error('Pedido não foi encontrado após a sincronização.');
  return persisted;
}

function isMissingFunction(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /could not find|does not exist|schema cache|PGRST202|404/i.test(message);
}

async function patchOrderPayment(
  orderId: string,
  storeStatus: StorePaymentStatus,
  paymentId: string,
  statusDetail: string | null,
  method: ReturnType<typeof extractPaymentMethod>,
  current: any,
) {
  const currentPayment = String(current?.payment_status || 'pending').toLowerCase();
  const currentOrder = String(current?.status || 'pending').toLowerCase();

  if (currentPayment === 'paid' && storeStatus !== 'paid') {
    return { payment_status: currentPayment, order_status: currentOrder, changed: false };
  }

  const now = new Date().toISOString();
  const base: Record<string, unknown> = {
    payment_status: storeStatus,
    payment_status_detail: statusDetail,
    payment_updated_at: now,
    updated_at: now,
  };
  if (paymentId) base.payment_id = paymentId;
  if (storeStatus === 'paid' && currentOrder === 'pending') base.status = 'confirmed';

  const extended: Record<string, unknown> = { ...base };
  if (method.id) extended.payment_method = method.id;
  if (method.type) extended.payment_type = method.type;
  if (method.installments) extended.payment_installments = method.installments;
  if (method.amount) extended.payment_amount = method.amount;
  if (storeStatus === 'paid') extended.paid_at = current?.paid_at || now;

  const write = (payload: Record<string, unknown>) =>
    supabaseRest(`orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    });

  try {
    await write(extended);
  } catch (error) {
    if (!/column|schema cache|PGRST204/i.test(error instanceof Error ? error.message : String(error))) throw error;
    await write(base);
  }

  return {
    payment_status: storeStatus,
    order_status: base.status || currentOrder,
    changed: currentPayment !== storeStatus,
  };
}

async function callSyncRpc(
  orderId: string,
  storeStatus: StorePaymentStatus,
  paymentId: string,
  statusDetail: string | null,
  method: ReturnType<typeof extractPaymentMethod>,
  current: any,
) {
  try {
    return await supabaseRpc('sync_order_payment_state_v2', {
      p_order_id: orderId,
      p_payment_id: paymentId || null,
      p_payment_status: storeStatus,
      p_status_detail: statusDetail,
      p_payment_method: method.id,
      p_payment_type: method.type,
      p_installments: method.installments,
      p_payment_amount: method.amount,
    });
  } catch (error) {
    if (!isMissingFunction(error)) throw error;
    console.warn('[mercadopago] sync_order_payment_state_v2 ausente, aplicando escrita direta.');
    return patchOrderPayment(orderId, storeStatus, paymentId, statusDetail, method, current);
  }
}

export async function syncOrderPayment(orderId: string, payment: any): Promise<SyncedPayment> {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) throw new Error('Pedido é obrigatório.');

  const externalReference = String(payment?.external_reference || '').trim();
  if (!externalReference || externalReference !== normalizedOrderId) {
    throw new Error('Pagamento não pertence ao pedido informado.');
  }

  const normalizedStatus = normalizePaymentStatus(payment);
  const storeStatus = toStorePaymentStatus(normalizedStatus);
  const paymentId = payment?.id ? String(payment.id) : '';
  const statusDetail = String(payment?.status_detail || payment?.order_status_detail || '').trim() || null;
  const method = extractPaymentMethod(payment);

  const previous = await readPersistedOrder(normalizedOrderId).catch(() => null);
  const rpcResult = await callSyncRpc(normalizedOrderId, storeStatus, paymentId, statusDetail, method, previous);

  const persisted = await readPersistedOrder(normalizedOrderId);
  const persistedPaymentStatus = String(persisted.payment_status || 'pending').toLowerCase();
  const persistedOrderStatus = String(persisted.status || 'pending').toLowerCase();
  const previousPaymentStatus = String(previous?.payment_status || '').toLowerCase();

  if (storeStatus === 'paid' && persistedPaymentStatus !== 'paid') {
    throw new Error(`Sincronização incompleta: payment_status=${persistedPaymentStatus}, status=${persistedOrderStatus}.`);
  }

  return {
    paymentStatus: persistedPaymentStatus,
    normalizedStatus,
    orderStatus: persistedOrderStatus,
    mpStatus: String(payment?.status || '').toLowerCase(),
    paymentId: String(persisted.payment_id || paymentId || ''),
    statusDetail: persisted.payment_status_detail || statusDetail,
    paymentMethod: persisted.payment_method || method.id,
    paymentType: persisted.payment_type || method.type,
    installments: persisted.payment_installments ?? method.installments,
    paymentAmount: persisted.payment_amount ?? method.amount,
    paidAt: persisted.paid_at || null,
    paymentUpdatedAt: persisted.payment_updated_at || null,
    updatedAt: persisted.updated_at || null,
    changed:
      typeof (rpcResult as any)?.changed === 'boolean'
        ? Boolean((rpcResult as any).changed)
        : previousPaymentStatus !== persistedPaymentStatus,
  };
}
