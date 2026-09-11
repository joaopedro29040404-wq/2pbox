import { enqueueEmail, paymentEmailTemplate } from './notifications';
import { supabaseRest } from './supabase-admin';
import type { SyncedPayment } from './mercadopago';

export const ORDER_FIELDS =
  'id,customer_id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,status,payment_status,payment_status_detail,payment_id,payment_method,payment_type,payment_installments,payment_amount,paid_at,payment_updated_at,total,created_at,updated_at';

export const ORDER_FIELDS_FALLBACK =
  'id,customer_id,customer_name,customer_phone,customer_email,delivery_type,delivery_address,notes,status,payment_status,payment_status_detail,payment_id,payment_updated_at,total,created_at,updated_at';

export type OrderRecord = Record<string, any>;
export type OrderItemRecord = { product_id: string; product_name: string; quantity: number; unit_price: number };

export async function queryOrders(params: URLSearchParams) {
  const attempt = async (select: string) => {
    const query = new URLSearchParams(params);
    query.set('select', select);
    return supabaseRest(`orders?${query.toString()}`);
  };

  const rows = await attempt(ORDER_FIELDS).catch(() => null);
  return Array.isArray(rows) ? rows : ((await attempt(ORDER_FIELDS_FALLBACK)) as OrderRecord[]);
}

export async function readOrder(orderId: string): Promise<OrderRecord | null> {
  const rows = await queryOrders(new URLSearchParams({ id: `eq.${orderId}`, limit: '1' }));
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function readOrderItems(orderId: string): Promise<OrderItemRecord[]> {
  const query = new URLSearchParams({
    select: 'product_id,product_name,quantity,unit_price',
    order_id: `eq.${orderId}`,
    order: 'product_name.asc',
  });
  const rows = await supabaseRest(`order_items?${query.toString()}`);
  return Array.isArray(rows) ? (rows as OrderItemRecord[]) : [];
}

export async function readOrderWithItems(orderId: string) {
  const order = await readOrder(orderId);
  if (!order) return null;
  const items = await readOrderItems(orderId).catch(() => []);
  return { order, items };
}

export async function readOrderHistory(orderId: string) {
  const query = new URLSearchParams({
    select: 'id,status,payment_status,note,source,created_at',
    order_id: `eq.${orderId}`,
    order: 'created_at.asc',
  });
  const rows = await supabaseRest(`order_status_history?${query.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

/** Registra o rateio no pedido. Tolera a ausencia das colunas antes da migracao. */
export async function recordSplit(
  orderId: string,
  split: { platformFee: number; sellerAmount: number; mpSellerUserId?: string | null },
) {
  try {
    await supabaseRest(`orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        platform_fee: split.platformFee,
        seller_amount: split.sellerAmount,
        mp_seller_user_id: split.mpSellerUserId ?? null,
      }),
    });
  } catch (error) {
    console.warn('[orders] nao foi possivel gravar o rateio:', error instanceof Error ? error.message : error);
  }
}

export async function notifyPaymentChange(orderId: string, synced: SyncedPayment) {
  const template = paymentEmailTemplate(synced.normalizedStatus);
  if (!template) return;

  const context = await readOrderWithItems(orderId);
  if (!context?.order?.customer_email) return;

  const stamp = synced.paymentUpdatedAt || synced.updatedAt || '';
  await enqueueEmail({
    template,
    to: String(context.order.customer_email),
    data: { order: context.order, items: context.items, statusDetail: synced.statusDetail },
    dedupeKey: `payment:${orderId}:${synced.normalizedStatus}:${synced.paymentId || 'none'}:${stamp}`,
  });
}

export async function notifyOrderStatusChange(orderId: string, status: string, previousStatus?: string | null, changedAt?: string | null) {
  const context = await readOrderWithItems(orderId);
  if (!context?.order?.customer_email) return;

  await enqueueEmail({
    template: 'order_status_updated',
    to: String(context.order.customer_email),
    data: { order: context.order, items: context.items, status, previousStatus, changedAt: changedAt || new Date().toISOString() },
    dedupeKey: `status:${orderId}:${status}:${changedAt || ''}`,
  });
}
