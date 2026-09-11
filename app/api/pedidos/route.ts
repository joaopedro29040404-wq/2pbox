import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/server/auth';
import { ORDER_ACCESS_COOKIE, readAccessToken } from '@/lib/server/order-access';
import { queryOrders } from '@/lib/server/orders';
import { supabaseRest } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, s-maxage=0' };
const PAGE_SIZE = 200;

type Identity = { email: string; source: 'session' | 'verified_code' };

/** Sessao autenticada dispensa codigo; convidado precisa do cookie verificado. */
async function resolveIdentity(): Promise<Identity | null> {
  const user = await getSessionUser().catch(() => null);
  if (user?.email) return { email: user.email.trim().toLowerCase(), source: 'session' };

  const store = await cookies();
  const email = readAccessToken(store.get(ORDER_ACCESS_COOKIE)?.value);
  return email ? { email, source: 'verified_code' } : null;
}

async function readItemCounts(orderIds: string[]) {
  if (!orderIds.length) return new Map<string, number>();
  const query = new URLSearchParams({ select: 'order_id,quantity' });
  query.set('order_id', `in.(${orderIds.join(',')})`);
  const rows = await supabaseRest(`order_items?${query.toString()}`).catch(() => []);

  const counts = new Map<string, number>();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const id = String(row.order_id);
      counts.set(id, (counts.get(id) || 0) + Number(row.quantity || 0));
    }
  }
  return counts;
}

export async function GET() {
  try {
    const identity = await resolveIdentity();
    if (!identity) {
      return NextResponse.json({ error: 'Verificação necessária.', requiresVerification: true }, { status: 401 });
    }

    const params = new URLSearchParams({ limit: String(PAGE_SIZE), order: 'created_at.desc' });
    params.set('customer_email', `ilike.${identity.email}`);
    const rows = await queryOrders(params);
    const orders = Array.isArray(rows) ? rows : [];

    const counts = await readItemCounts(orders.map((order) => String(order.id)));

    return NextResponse.json(
      {
        email: identity.email,
        source: identity.source,
        total: orders.length,
        orders: orders.map((order) => ({
          id: order.id,
          status: String(order.status || 'pending').toLowerCase(),
          payment_status: String(order.payment_status || 'pending').toLowerCase(),
          total: order.total,
          created_at: order.created_at,
          delivery_type: order.delivery_type,
          payment_method: order.payment_method ?? null,
          payment_type: order.payment_type ?? null,
          paid_at: order.paid_at ?? null,
          item_count: counts.get(String(order.id)) || 0,
        })),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error('[pedidos] erro:', error);
    return NextResponse.json({ error: 'Não foi possível carregar seus pedidos.' }, { status: 500 });
  }
}
