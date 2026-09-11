import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { supabaseRest } from '@/lib/server/supabase-admin';
import { readStoreOperations } from '@/lib/server/store-settings';
import { cycleRange, cycleStartFor, describeCycle } from '@/lib/store-operations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FIELDS =
  'id,created_at,status,payment_status,customer_name,customer_phone,customer_email,total,delivery_type,delivery_address,delivery_distance_km,delivery_fee,delivery_fee_subsidy,delivery_provider,delivery_cycle_start,delivery_notes,dispatched_at,delivered_at';

const FIELDS_FALLBACK =
  'id,created_at,status,payment_status,customer_name,customer_phone,customer_email,total,delivery_type,delivery_address';

const LOGISTICS_STATUSES = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed'];

export async function GET(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });

  const operations = await readStoreOperations();
  const url = new URL(request.url);
  const reference = parseReference(url.searchParams.get('cycle'));
  const { start, end } = cycleRange(reference, operations.cycleHour);

  const rows = await readCycleOrders(start, end);
  const orders = rows
    .filter((order) => String(order.payment_status || '') === 'paid' || String(order.status || '') !== 'pending')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return NextResponse.json({
    cycle: {
      start: start.toISOString(),
      end: end.toISOString(),
      hour: operations.cycleHour,
      label: describeCycle(start, operations.cycleHour),
      isCurrent: start.getTime() === cycleStartFor(new Date(), operations.cycleHour).getTime(),
    },
    totals: summarize(orders),
    orders,
    operations: {
      pickupEnabled: operations.pickupEnabled,
      ownDeliveryEnabled: operations.ownDeliveryEnabled,
      appDeliveryEnabled: operations.appDeliveryEnabled,
      subsidyPercent: operations.subsidyPercent,
      maxKm: operations.maxKm,
      addressConfigured: operations.address.lat != null && operations.address.lng != null,
    },
  });
}

async function readCycleOrders(start: Date, end: Date) {
  const window = `created_at=gte.${start.toISOString()}&created_at=lt.${end.toISOString()}`;
  const byWindow = await query(`orders?select=${FIELDS}&${window}&limit=400`);
  if (byWindow === null) {
    const legacy = await query(`orders?select=${FIELDS_FALLBACK}&${window}&limit=400`);
    return legacy || [];
  }

  // Um pedido remarcado para outro ciclo carrega delivery_cycle_start proprio e
  // precisa aparecer no ciclo em que sera entregue, nao no da compra.
  const assigned = await query(`orders?select=${FIELDS}&delivery_cycle_start=eq.${start.toISOString()}&limit=400`);
  const merged = new Map<string, any>();
  for (const order of [...byWindow, ...(assigned || [])]) merged.set(String(order.id), order);

  return [...merged.values()].filter((order) => {
    const assignedCycle = order.delivery_cycle_start ? new Date(order.delivery_cycle_start).getTime() : null;
    return assignedCycle == null || assignedCycle === start.getTime();
  });
}

async function query(path: string): Promise<any[] | null> {
  try {
    const data = await supabaseRest(path);
    return Array.isArray(data) ? data : [];
  } catch {
    return null;
  }
}

function summarize(orders: any[]) {
  const byStatus: Record<string, number> = {};
  for (const status of LOGISTICS_STATUSES) byStatus[status] = 0;

  let revenue = 0;
  let fees = 0;
  let subsidy = 0;
  let pickups = 0;
  let deliveries = 0;

  for (const order of orders) {
    const status = String(order.status || 'pending');
    byStatus[status] = (byStatus[status] || 0) + 1;
    revenue += Number(order.total || 0);
    fees += Number(order.delivery_fee || 0);
    subsidy += Number(order.delivery_fee_subsidy || 0);
    if (String(order.delivery_type || '') === 'pickup') pickups += 1;
    else deliveries += 1;
  }

  return {
    count: orders.length,
    byStatus,
    revenue: round(revenue),
    fees: round(fees),
    subsidy: round(subsidy),
    pickups,
    deliveries,
    open: orders.filter((order) => !['delivered', 'completed', 'cancelled'].includes(String(order.status || ''))).length,
  };
}

function parseReference(value: string | null) {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  // O parametro chega como inicio de ciclo: uma hora depois cai com folga
  // dentro da propria janela.
  return new Date(parsed.getTime() + 60 * 60 * 1000);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
