import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

const sourceLabel = (source: string | null) => {
  const value = String(source || '').toLowerCase();
  if (value === 'whatsapp') return 'WhatsApp';
  if (value === 'instagram') return 'Instagram';
  if (value === 'tiktok') return 'TikTok';
  if (value === 'google') return 'Google';
  if (!value || value === 'direct') return 'Acesso direto';
  return 'Outros';
};
const dayKey = (value: string) => new Date(value).toISOString().slice(0, 10);
const hourKey = (value: string) => new Date(value).getHours();
const uniqueSessions = (rows: any[]) => new Set(rows.map((row) => row.session_id).filter(Boolean));
const round = (value: number) => Math.round(value * 100) / 100;

const privateIp = (ip: string) => /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);

async function geolocateIps(ips: string[]) {
  const unique = Array.from(new Set(ips.map((ip) => ip.trim()).filter((ip) => ip && !privateIp(ip))));
  const results = new Map<string, { city: string; region: string; country: string }>();

  const request = async (url: string) => {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return response.json();
  };

  await Promise.all(unique.slice(0, 80).map(async (ip) => {
    try {
      let data = await request(`https://ipwho.is/${encodeURIComponent(ip)}`);
      if (!data?.success) data = await request(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
      if (!data) return;
      const city = String(data?.city || '').trim();
      const region = String(data?.region_code || data?.region || '').trim();
      const country = String(data?.country_code || '').trim().toUpperCase();
      if (city || region || country) results.set(ip, { city: city || 'Localização desconhecida', region, country });
    } catch {}
  }));

  return results;
}

export async function GET(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });
  const url = new URL(request.url);
  const end = new Date(url.searchParams.get('end') || new Date().toISOString());
  const start = new Date(url.searchParams.get('start') || new Date(Date.now() - 6 * 86400000).toISOString());
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 });

  const [{ data: events, error: eventsError }, { data: orders, error: ordersError }, { data: excludedDevices, error: excludedError }, { data: blockedIps, error: blockedIpsError }] = await Promise.all([
    client.from('analytics_events').select('event_name,session_id,user_id,product_id,order_id,page_path,utm_source,utm_medium,utm_campaign,referrer,device_type,value,metadata,created_at,ip_address').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).order('created_at', { ascending: true }).range(0, 49999),
    client.from('orders').select('id,total,status,payment_status,created_at,paid_at,is_test,analytics_excluded,analytics_session_id,analytics_utm_source,analytics_utm_medium,analytics_utm_campaign').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).order('created_at', { ascending: false }).range(0, 9999),
    client.from('analytics_excluded_devices').select('session_id'),
    client.from('analytics_excluded_ips').select('ip_address'),
  ]);
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  if (excludedError) return NextResponse.json({ error: excludedError.message }, { status: 500 });
  if (blockedIpsError) return NextResponse.json({ error: blockedIpsError.message }, { status: 500 });

  const excludedSessions = new Set((excludedDevices || []).map((row) => row.session_id));
  const blocked = new Set((blockedIps || []).map((row) => row.ip_address));
  const allEvents = ((events || []) as any[]).filter((event) => !excludedSessions.has(event.session_id) && !blocked.has(event.ip_address));
  const locationByIp = await geolocateIps(allEvents.map((event) => String(event.ip_address || '')));
  const locationMap = new Map<string, { location: string; visits: Set<string>; events: number }>();
  for (const event of allEvents) {
    const geo = locationByIp.get(String(event.ip_address || ''));
    if (!geo) continue;
    const location = geo.city && geo.region ? `${geo.city} — ${geo.region}` : geo.city || geo.region || 'Localização desconhecida';
    if (!locationMap.has(location)) locationMap.set(location, { location, visits: new Set(), events: 0 });
    const row = locationMap.get(location)!;
    if (event.session_id) row.visits.add(event.session_id);
    row.events += 1;
  }
  const locations = Array.from(locationMap.values()).map((row) => ({ location: row.location, visitors: row.visits.size, events: row.events })).sort((a, b) => b.visitors - a.visitors || b.events - a.events).slice(0, 20);
  const allOrders = ((orders || []) as any[]).filter((order) => !order.analytics_excluded && !excludedSessions.has(order.analytics_session_id));
  const realOrders = allOrders.filter((order) => !order.is_test);
  const paidOrders = realOrders.filter((order) => String(order.payment_status || '').toLowerCase() === 'paid');
  const canceledOrders = realOrders.filter((order) => ['cancelled', 'canceled'].includes(String(order.status || '').toLowerCase()) || ['failed', 'refunded'].includes(String(order.payment_status || '').toLowerCase()));
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const byName = (name: string) => allEvents.filter((event) => event.event_name === name);
  const pageViews = byName('page_view');
  const printPageViews = pageViews.filter((event) => event.page_path === '/impressao' || event.metadata?.page_type === 'print_center');
  const printPageVisitors = uniqueSessions(printPageViews);
  const productViews = byName('product_view');
  const cartAdds = byName('add_to_cart');
  const checkouts = byName('begin_checkout');
  const payments = byName('payment_started');
  const purchases = byName('purchase');
  const visitors = uniqueSessions(pageViews);
  const productViewSessions = uniqueSessions(productViews);
  const cartSessions = uniqueSessions(cartAdds);
  const checkoutSessions = uniqueSessions(checkouts);
  const paymentSessions = uniqueSessions(payments);
  const purchaseSessions = uniqueSessions(purchases);
  const funnelStages = [
    { key: 'visitors', label: 'Visitantes', count: visitors.size },
    { key: 'products', label: 'Visualizaram produtos', count: productViewSessions.size },
    { key: 'carts', label: 'Adicionaram ao carrinho', count: cartSessions.size },
    { key: 'checkouts', label: 'Iniciaram checkout', count: checkoutSessions.size },
    { key: 'payments', label: 'Iniciaram pagamento', count: paymentSessions.size },
    { key: 'purchases', label: 'Compraram', count: paidOrders.length },
  ].map((stage, index, list) => ({ ...stage, percent: visitors.size ? round((stage.count / visitors.size) * 100) : 0, nextConversion: index < list.length - 1 && stage.count ? round((list[index + 1].count / stage.count) * 100) : null, abandonment: index < list.length - 1 ? Math.max(0, stage.count - list[index + 1].count) : 0 }));
  const sessionSource = new Map<string, string>();
  for (const event of pageViews) if (!sessionSource.has(event.session_id)) sessionSource.set(event.session_id, sourceLabel(event.utm_source));
  for (const event of allEvents) if (!sessionSource.has(event.session_id)) sessionSource.set(event.session_id, sourceLabel(event.utm_source));
  const orderSource = (order: any) => sourceLabel(order.analytics_utm_source || sessionSource.get(order.analytics_session_id || '') || null);
  const trafficMap = new Map<string, { source: string; visits: Set<string>; carts: Set<string>; checkouts: Set<string>; orders: number; revenue: number }>();
  const ensureTraffic = (source: string) => { if (!trafficMap.has(source)) trafficMap.set(source, { source, visits: new Set(), carts: new Set(), checkouts: new Set(), orders: 0, revenue: 0 }); return trafficMap.get(source)!; };
  for (const event of pageViews) ensureTraffic(sessionSource.get(event.session_id) || 'Acesso direto').visits.add(event.session_id);
  for (const event of cartAdds) ensureTraffic(sessionSource.get(event.session_id) || 'Acesso direto').carts.add(event.session_id);
  for (const event of checkouts) ensureTraffic(sessionSource.get(event.session_id) || 'Acesso direto').checkouts.add(event.session_id);
  for (const order of paidOrders) { const row = ensureTraffic(orderSource(order)); row.orders += 1; row.revenue += Number(order.total || 0); }
  const traffic = Array.from(trafficMap.values()).map((row) => ({ source: row.source, visits: row.visits.size, carts: row.carts.size, checkouts: row.checkouts.size, orders: row.orders, revenue: round(row.revenue) })).sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);
  const productIds = Array.from(new Set([...productViews, ...cartAdds].map((event) => event.product_id).filter(Boolean).concat(realOrders.length ? [] : [])));
  const { data: itemRows } = paidOrders.length ? await client.from('order_items').select('order_id,product_id,product_name,quantity,total,print_job_id').in('order_id', paidOrders.map((order) => order.id)).range(0, 19999) : { data: [] as any[] };
  const items = (itemRows || []) as any[];
  const printItems = items.filter((item) => item.print_job_id);
  const printRevenue = printItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const printOrders = new Set(printItems.map((item) => item.order_id).filter(Boolean));
  const itemProductIds = items.map((item) => item.product_id).filter(Boolean);
  const lookupIds = Array.from(new Set([...productIds, ...itemProductIds]));
  const { data: productRows } = lookupIds.length ? await client.from('products').select('id,name,slug').in('id', lookupIds) : { data: [] as any[] };
  const names = new Map((productRows || []).map((product: any) => [product.id, product.name]));
  const productMap = new Map<string, { id: string; name: string; views: number; carts: number; sales: number; revenue: number }>();
  const ensureProduct = (id: string) => { if (!productMap.has(id)) productMap.set(id, { id, name: names.get(id) || 'Produto', views: 0, carts: 0, sales: 0, revenue: 0 }); return productMap.get(id)!; };
  for (const event of productViews) if (event.product_id) ensureProduct(event.product_id).views += 1;
  for (const event of cartAdds) if (event.product_id) ensureProduct(event.product_id).carts += 1;
  for (const item of items) if (item.product_id) { const row = ensureProduct(item.product_id); row.sales += Number(item.quantity || 0); row.revenue += Number(item.total || 0); }
  const products = Array.from(productMap.values()).map((row) => ({ ...row, revenue: round(row.revenue), conversion: row.views ? round((row.sales / row.views) * 100) : 0 })).sort((a, b) => b.views - a.views);
  const evolutionMap = new Map<string, { date: string; visitors: Set<string>; carts: number; orders: number; revenue: number }>();
  const ensureDay = (date: string) => { if (!evolutionMap.has(date)) evolutionMap.set(date, { date, visitors: new Set(), carts: 0, orders: 0, revenue: 0 }); return evolutionMap.get(date)!; };
  for (const event of pageViews) ensureDay(dayKey(event.created_at)).visitors.add(event.session_id);
  for (const event of cartAdds) ensureDay(dayKey(event.created_at)).carts += 1;
  for (const order of paidOrders) { const row = ensureDay(dayKey(order.paid_at || order.created_at)); row.orders += 1; row.revenue += Number(order.total || 0); }
  const evolution = Array.from(evolutionMap.values()).sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({ date: row.date, visitors: row.visitors.size, carts: row.carts, orders: row.orders, revenue: round(row.revenue) }));
  const deviceMap = new Map<string, Set<string>>();
  for (const event of pageViews) { const key = event.device_type || 'unknown'; if (!deviceMap.has(key)) deviceMap.set(key, new Set()); deviceMap.get(key)!.add(event.session_id); }
  const devices = Array.from(deviceMap.entries()).map(([device, sessions]) => ({ device, visitors: sessions.size })).sort((a, b) => b.visitors - a.visitors);
  const hourMap = new Map<number, { visitors: Set<string>; orders: number }>();
  for (let hour = 0; hour < 24; hour++) hourMap.set(hour, { visitors: new Set(), orders: 0 });
  for (const event of pageViews) hourMap.get(hourKey(event.created_at))!.visitors.add(event.session_id);
  for (const order of paidOrders) hourMap.get(hourKey(order.paid_at || order.created_at))!.orders += 1;
  const hours = Array.from(hourMap.entries()).map(([hour, row]) => ({ hour, visitors: row.visitors.size, orders: row.orders }));
  const latestCartBySession = new Map<string, number>();
  for (const event of [...cartAdds, ...byName('remove_from_cart')]) latestCartBySession.set(event.session_id, Math.max(0, Number(event.value || 0)));
  const abandonedSessions = Array.from(latestCartBySession.entries()).filter(([sessionId]) => !purchaseSessions.has(sessionId));
  const abandonedValue = abandonedSessions.reduce((sum, [, value]) => sum + value, 0);
  const cartCreatedSessions = cartSessions.size;
  const abandonedRate = cartCreatedSessions ? round((abandonedSessions.length / cartCreatedSessions) * 100) : 0;
  const conversionRate = visitors.size ? round((paidOrders.length / visitors.size) * 100) : 0;
  const testOrders = allOrders.filter((order) => order.is_test).slice(0, 50).map((order) => ({ id: order.id, total: Number(order.total || 0), status: order.status, payment_status: order.payment_status, created_at: order.created_at, is_test: true }));
  return NextResponse.json({ period: { start: start.toISOString(), end: end.toISOString() }, locations, cards: { visitors: visitors.size, productViews: productViews.length, printPageViews: printPageViews.length, printPageVisitors: printPageVisitors.size, cartAdds: cartAdds.length, checkouts: checkoutSessions.size, payments: paymentSessions.size, approvedOrders: paidOrders.length, orders: realOrders.length, canceledOrders: canceledOrders.length, revenue: round(revenue), averageTicket: paidOrders.length ? round(revenue / paidOrders.length) : 0, conversionRate, productsSold: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) }, evolution, funnel: funnelStages, traffic, products, abandoned: { carts: cartCreatedSessions, abandoned: abandonedSessions.length, rate: abandonedRate, value: round(abandonedValue) }, devices, hours, sales: { orders: realOrders.length, approved: paidOrders.length, canceled: canceledOrders.length, revenue: round(revenue), averageTicket: paidOrders.length ? round(revenue / paidOrders.length) : 0, productsSold: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), printOrders: printOrders.size, printRevenue: round(printRevenue) }, testOrders });
}
