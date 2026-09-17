import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

const round = (value: number) => Math.round(value * 100) / 100;
const dayStart = (value: Date) => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; };

export async function GET(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const now = new Date();
  const end = new Date(url.searchParams.get('end') || now.toISOString());
  const start = new Date(url.searchParams.get('start') || dayStart(new Date(now.getTime() - 6 * 86400000)).toISOString());
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = 20;
  const sort = url.searchParams.get('sort') || 'views';
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 });

  const [{ data: products, error: productsError }, { data: events, error: eventsError }, { data: orders, error: ordersError }] = await Promise.all([
    client.from('products').select('id,name,slug,price,active').order('name', { ascending: true }).range(0, 19999),
    client.from('analytics_events').select('event_name,session_id,product_id,order_id,value,created_at').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).not('product_id', 'is', null).range(0, 49999),
    client.from('orders').select('id,total,payment_status,is_test,analytics_excluded,analytics_session_id').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).range(0, 9999),
  ]);
  if (productsError) return NextResponse.json({ error: productsError.message }, { status: 500 });
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  const { data: excludedDevices, error: excludedError } = await client.from('analytics_excluded_devices').select('session_id');
  if (excludedError) return NextResponse.json({ error: excludedError.message }, { status: 500 });
  const excludedSessions = new Set((excludedDevices || []).map((row) => row.session_id));
  const validEvents = ((events || []) as any[]).filter((event) => !excludedSessions.has(event.session_id));
  const validOrders = ((orders || []) as any[]).filter((order) => !order.analytics_excluded && !order.is_test && !excludedSessions.has(order.analytics_session_id));
  const paidOrders = validOrders.filter((order) => String(order.payment_status || '').toLowerCase() === 'paid');

  const { data: items } = paidOrders.length
    ? await client.from('order_items').select('order_id,product_id,quantity,total').in('order_id', paidOrders.map((order) => order.id)).range(0, 19999)
    : { data: [] as any[] };
  const paidOrderIds = new Set(paidOrders.map((order) => order.id));
  const map = new Map<string, any>();
  for (const product of (products || []) as any[]) {
    map.set(product.id, { id: product.id, name: product.name, slug: product.slug, price: Number(product.price || 0), active: Boolean(product.active), views: 0, carts: 0, checkouts: 0, orders: new Set<string>(), units: 0, revenue: 0 });
  }
  for (const event of validEvents) {
    if (!event.product_id || !map.has(event.product_id)) continue;
    const row = map.get(event.product_id);
    if (event.event_name === 'product_view') row.views += 1;
    if (event.event_name === 'add_to_cart') row.carts += 1;
    if (event.event_name === 'begin_checkout') row.checkouts += 1;
  }
  for (const item of (items || []) as any[]) {
    if (!item.product_id || !map.has(item.product_id) || !paidOrderIds.has(item.order_id)) continue;
    const row = map.get(item.product_id);
    row.orders.add(item.order_id);
    row.units += Number(item.quantity || 0);
    row.revenue += Number(item.total || 0);
  }

  const rows = Array.from(map.values()).map((row) => {
    const ordersCount = row.orders.size;
    const conversion = row.views ? (ordersCount / row.views) * 100 : 0;
    const cartRate = row.views ? (row.carts / row.views) * 100 : 0;
    const interestLowConversion = row.views >= 5 && row.carts >= 2 && ordersCount === 0;
    return { id: row.id, name: row.name, slug: row.slug, price: row.price, active: row.active, views: row.views, carts: row.carts, checkouts: row.checkouts, orders: ordersCount, units: row.units, revenue: round(row.revenue), conversion: round(conversion), cartRate: round(cartRate), interestLowConversion };
  });
  const sorters: Record<string, (a: any, b: any) => number> = {
    views: (a, b) => b.views - a.views || b.carts - a.carts,
    carts: (a, b) => b.carts - a.carts || b.views - a.views,
    orders: (a, b) => b.orders - a.orders || b.units - a.units,
    revenue: (a, b) => b.revenue - a.revenue || b.orders - a.orders,
    conversion: (a, b) => b.conversion - a.conversion || b.views - a.views,
  };
  rows.sort(sorters[sort] || sorters.views);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const summary = rows.reduce((acc, row) => ({ views: acc.views + row.views, carts: acc.carts + row.carts, orders: acc.orders + row.orders, units: acc.units + row.units, revenue: acc.revenue + row.revenue }), { views: 0, carts: 0, orders: 0, units: 0, revenue: 0 });

  return NextResponse.json({ period: { start: start.toISOString(), end: end.toISOString() }, page: currentPage, pageSize, total, totalPages, sort, summary: { ...summary, revenue: round(summary.revenue) }, products: paginated });
}
