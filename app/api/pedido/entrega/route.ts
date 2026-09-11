import { NextResponse } from 'next/server';
import { isGeoAvailable, resolvePlace, routeDistance } from '@/lib/server/geo';
import { readOrder, readOrderItems } from '@/lib/server/orders';
import { readStoreOperations, storeOrigin } from '@/lib/server/store-settings';
import { supabaseRest } from '@/lib/server/supabase-admin';
import { cycleStartFor, quoteOwnDelivery } from '@/lib/store-operations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROVIDERS = new Set(['pickup', 'own', 'app']);

const DELIVERY_TYPE: Record<string, string> = {
  pickup: 'pickup',
  own: 'own_delivery',
  app: 'app_delivery',
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  const orderId = String(body.orderId || '').trim();
  const provider = String(body.provider || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  if (!orderId || !PROVIDERS.has(provider)) return NextResponse.json({ error: 'Modalidade de entrega inválida.' }, { status: 400 });

  const order = await readOrder(orderId);
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

  // Sem a conferencia do e-mail qualquer um poderia reconfigurar a entrega de
  // um pedido alheio ainda em aberto.
  const orderEmail = String(order.customer_email || '').trim().toLowerCase();
  if (!email || !orderEmail || email !== orderEmail) {
    return NextResponse.json({ error: 'Não foi possível confirmar o pedido.' }, { status: 403 });
  }
  if (String(order.payment_status || '') === 'paid') {
    return NextResponse.json({ error: 'Este pedido já está pago.' }, { status: 409 });
  }

  const operations = await readStoreOperations();
  if (provider === 'own' && !operations.ownDeliveryEnabled) return NextResponse.json({ error: 'A entrega própria está desativada.' }, { status: 409 });
  if (provider === 'app' && !operations.appDeliveryEnabled) return NextResponse.json({ error: 'O motofrete está desativado.' }, { status: 409 });
  if (provider === 'pickup' && !operations.pickupEnabled) return NextResponse.json({ error: 'A retirada está desativada.' }, { status: 409 });

  const items = await readOrderItems(orderId);
  const subtotal = round(
    Number(order.items_subtotal) > 0
      ? Number(order.items_subtotal)
      : items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0) || Number(order.total || 0),
  );

  let distanceKm: number | null = null;
  let fee = 0;
  let subsidy = 0;

  if (provider === 'own') {
    const origin = storeOrigin(operations);
    if (!origin) return NextResponse.json({ error: 'O endereço da loja não está configurado.' }, { status: 409 });

    const destination = await destinationFor(body);
    if (!destination) return NextResponse.json({ error: 'Selecione o endereço de entrega na busca para calcular a distância.' }, { status: 400 });

    const distance = await routeDistance(origin, destination);
    distanceKm = distance.km;
    if (distance.km > operations.maxKm) {
      return NextResponse.json({ error: `Endereço fora do raio de atendimento (${operations.maxKm} km).`, distanceKm: distance.km }, { status: 422 });
    }

    const quote = quoteOwnDelivery(distance.km, operations.priceTable, operations.subsidyPercent);
    if (!quote) return NextResponse.json({ error: 'Nenhuma faixa de preço cobre essa distância.', distanceKm: distance.km }, { status: 422 });

    fee = quote.customerFee;
    subsidy = quote.subsidy;
  }

  const freeFrom = operations.freeShippingFrom;
  const freeShipping = freeFrom != null && freeFrom > 0 && subtotal >= freeFrom;
  if (freeShipping && fee > 0) {
    subsidy = round(subsidy + fee);
    fee = 0;
  }

  const serviceFee = round(subtotal * (operations.serviceFeePercent / 100) + operations.serviceFeeFixed);
  const total = round(subtotal + fee + serviceFee);

  const payload: Record<string, unknown> = {
    delivery_type: DELIVERY_TYPE[provider],
    delivery_provider: provider,
    delivery_distance_km: distanceKm,
    delivery_fee: fee,
    delivery_fee_subsidy: subsidy,
    delivery_cycle_start: cycleStartFor(new Date(), operations.cycleHour).toISOString(),
    items_subtotal: subtotal,
    total,
    updated_at: new Date().toISOString(),
  };
  if (body.address && typeof body.address === 'object') payload.delivery_address = body.address;

  try {
    await patch(orderId, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!/column|PGRST204|schema cache|orders_delivery_type/i.test(message)) throw error;

    // Sem as migrations de operacao, ao menos o total cobrado fica correto.
    await patch(orderId, { total, updated_at: new Date().toISOString() });
    return NextResponse.json({
      total,
      subtotal,
      fee,
      serviceFee,
      subsidy,
      distanceKm,
      freeShipping,
      warning: 'As migrations de entrega ainda não foram aplicadas: apenas o total foi atualizado.',
    });
  }

  return NextResponse.json({ total, subtotal, fee, serviceFee, subsidy, distanceKm, freeShipping });
}

async function destinationFor(body: any) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return { lat, lng };

  const placeId = String(body?.placeId || '').trim();
  if (!placeId || !isGeoAvailable()) return null;

  const address = await resolvePlace(placeId).catch(() => null);
  if (!address || address.lat == null || address.lng == null) return null;
  return { lat: address.lat, lng: address.lng };
}

function patch(orderId: string, payload: Record<string, unknown>) {
  return supabaseRest(`orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
}

function round(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}
