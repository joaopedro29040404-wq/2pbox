import { NextResponse } from 'next/server';
import { geocodeAddress, isGeoAvailable, resolvePlace, routeDistance } from '@/lib/server/geo';
import { readStoreOperations, storeOrigin, type StoreOperations } from '@/lib/server/store-settings';
import { DELIVERY_PROVIDERS, getStandardDeliveryDateLabel, getStandardDeliveryMessage, quoteOwnDelivery, type DeliveryProvider } from '@/lib/store-operations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Option = { provider: DeliveryProvider; label: string; description: string; fee: number | null; baseFee: number | null; subsidy: number | null; distanceKm: number | null; minutes: number | null; needsAddress: boolean; available: boolean; reason?: string };

function isExpressAvailableNow(operations: StoreOperations) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const current = hour * 60 + minute;
  const start = timeToMinutes(operations.expressStartTime);
  const end = timeToMinutes(operations.expressEndTime);
  return current >= start && current < end;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function enabledProviders(operations: StoreOperations): DeliveryProvider[] {
  const active: DeliveryProvider[] = [];
  if (operations.pickupEnabled && operations.pickupMode !== 'disabled') active.push('pickup');
  if (operations.ownDeliveryEnabled) active.push('own');
  if (operations.expressEnabled && isExpressAvailableNow(operations)) active.push('express');
  if (operations.appDeliveryEnabled) active.push('app');
  return active;
}

function describe(provider: DeliveryProvider) { return DELIVERY_PROVIDERS.find((item) => item.value === provider)!; }

function freeShippingActive(value: number | null | undefined, subtotal: number | null) {
  return value != null && subtotal != null && subtotal >= Number(value);
}

function readCartSubtotal(request: Request) {
  const raw = request.headers.get('cookie')?.match(/(?:^|;\s*)2pbox-cart-subtotal=([^;]+)/)?.[1];
  const value = raw ? Number(decodeURIComponent(raw)) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function GET(request: Request) {
  const operations = await readStoreOperations();
  const providers = enabledProviders(operations);
  const standardMessage = getStandardDeliveryMessage(operations.sameDayCutoff);
  const cartSubtotal = readCartSubtotal(request);
  const freeStandardDelivery = freeShippingActive(operations.freeShippingFrom, cartSubtotal);
  const isProductRequest = request.headers.get('referer')?.includes('/produto/') ?? false;
  return NextResponse.json({
    sameDay: {
      enabled: operations.sameDayEnabled,
      cutoff: operations.sameDayCutoff,
      message: standardMessage,
      window: getStandardDeliveryDateLabel(operations.sameDayCutoff),
    },
    freeShippingFrom: operations.freeShippingFrom,
    address: storeAddressLabel(operations),
    options: providers.filter((provider) => provider !== 'express' || operations.expressPriceTable.length > 0).map((provider) => {
      const meta = describe(provider);
      const isOwn = provider === 'own';
      return {
        provider,
        label: meta.label,
        description: isOwn ? standardMessage : meta.description,
        fee: provider === 'pickup' ? 0 : isOwn && (isProductRequest || freeStandardDelivery) ? 0 : null,
        needsAddress: meta.needsAddress,
      };
    }),
    storeConfigured: Boolean(storeOrigin(operations)),
  });
}

export async function POST(request: Request) {
  const operations = await readStoreOperations();
  const body = await request.json().catch(() => ({}));
  const origin = storeOrigin(operations);
  const providers = enabledProviders(operations);
  const destination = await resolveDestination(body);
  const cartSubtotal = Number.isFinite(Number(body?.subtotal)) ? Number(body.subtotal) : readCartSubtotal(request);
  const freeStandardDelivery = freeShippingActive(operations.freeShippingFrom, cartSubtotal);
  const options: Option[] = [];

  for (const provider of providers) {
    const meta = describe(provider);
    if (provider === 'pickup') {
      options.push({ provider, label: meta.label, description: meta.description, fee: 0, baseFee: 0, subsidy: 0, distanceKm: null, minutes: null, needsAddress: false, available: true });
      continue;
    }
    if (!origin) { options.push(unavailable(provider, meta.label, 'Endereço da loja não configurado.')); continue; }
    if (!destination) { options.push(unavailable(provider, meta.label, 'Informe o endereço de entrega para calcular o frete.')); continue; }

    const distance = await routeDistance(origin, destination);
    const maxKm = provider === 'express' ? operations.expressMaxKm : operations.maxKm;
    const table = provider === 'express' ? operations.expressPriceTable : operations.priceTable;
    const subsidy = provider === 'own' ? operations.subsidyPercent : 0;
    const quote = distance.km > maxKm ? null : quoteOwnDelivery(distance.km, table, subsidy);

    options.push(quote ? {
      provider,
      label: meta.label,
      description: provider === 'own'
        ? getStandardDeliveryMessage(operations.sameDayCutoff)
        : `${distance.km.toFixed(1)} km`,
      fee: provider === 'own' && freeStandardDelivery ? 0 : quote.customerFee,
      baseFee: quote.baseFee,
      subsidy: provider === 'own' && freeStandardDelivery ? quote.baseFee : quote.subsidy,
      distanceKm: distance.km,
      minutes: distance.minutes,
      needsAddress: true,
      available: true,
    } : {
      ...unavailable(provider, meta.label, table.length === 0 ? 'A tabela de preços desta modalidade ainda não foi configurada pela loja.' : `Fora do raio de atendimento (${maxKm} km).`),
      distanceKm: distance.km,
    });
  }

  return NextResponse.json({ options, geoAvailable: isGeoAvailable(), storeConfigured: Boolean(origin), subsidyPercent: operations.subsidyPercent, freeShippingFrom: operations.freeShippingFrom });
}

async function resolveDestination(body: any) {
  const lat = Number(body?.lat); const lng = Number(body?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return { lat, lng };
  if (!isGeoAvailable()) return null;
  const placeId = String(body?.placeId || '').trim();
  if (placeId) {
    const address = await resolvePlace(placeId).catch(() => null);
    if (address?.lat != null && address?.lng != null) return { lat: address.lat, lng: address.lng };
  }
  const typed = body?.address;
  if (typed && typeof typed === 'object') return geocodeAddress({ street: typed.street ?? typed.line, number: typed.number, district: typed.neighborhood ?? typed.district, city: typed.city, state: typed.state, zip: typed.postal_code ?? typed.zip });
  return null;
}

function unavailable(provider: DeliveryProvider, label: string, reason: string): Option {
  return { provider, label, description: reason, fee: null, baseFee: null, subsidy: null, distanceKm: null, minutes: null, needsAddress: true, available: false, reason };
}

function storeAddressLabel(operations: StoreOperations) {
  const { line, number, district, city, state, zip } = operations.address;
  if (!line && !city) return '';
  const street = [line, number].filter(Boolean).join(', ');
  const region = [district, [city, state].filter(Boolean).join('/')].filter(Boolean).join(', ');
  return [street, region, zip].filter(Boolean).join(' · ');
}
