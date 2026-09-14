import { NextResponse } from 'next/server';
import { isGeoAvailable, resolvePlace, routeDistance } from '@/lib/server/geo';
import { readStoreOperations, storeOrigin, type StoreOperations } from '@/lib/server/store-settings';
import { DELIVERY_PROVIDERS, quoteOwnDelivery, type DeliveryProvider } from '@/lib/store-operations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Option = {
  provider: DeliveryProvider;
  label: string;
  description: string;
  fee: number | null;
  distanceKm: number | null;
  needsAddress: boolean;
  available: boolean;
  reason?: string;
};

function enabledProviders(operations: StoreOperations): DeliveryProvider[] {
  const active: DeliveryProvider[] = [];
  if (operations.pickupEnabled && operations.pickupMode !== 'disabled') active.push('pickup');
  if (operations.ownDeliveryEnabled) active.push('own');
  if (operations.expressEnabled) active.push('express');
  if (operations.appDeliveryEnabled) active.push('app');
  return active;
}

function describe(provider: DeliveryProvider) {
  return DELIVERY_PROVIDERS.find((item) => item.value === provider)!;
}

export async function GET() {
  const operations = await readStoreOperations();
  const providers = enabledProviders(operations);

  return NextResponse.json({
    options: providers.map((provider) => {
      const meta = describe(provider);
      const fee = provider === 'pickup' ? 0 : provider === 'express' ? operations.expressFee : null;
      return {
        provider,
        label: meta.label,
        description: provider === 'express' && operations.expressFee > 0 ? `${meta.description}` : meta.description,
        fee,
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
  const options: Option[] = [];

  for (const provider of providers) {
    const meta = describe(provider);

    if (provider === 'pickup') {
      options.push({ provider, label: meta.label, description: meta.description, fee: 0, distanceKm: null, needsAddress: false, available: true });
      continue;
    }

    if (provider === 'express') {
      options.push({
        provider,
        label: meta.label,
        description: operations.expressFee > 0 ? `Frete fixo de ${currency(operations.expressFee)}` : meta.description,
        fee: operations.expressFee,
        distanceKm: null,
        needsAddress: true,
        available: true,
      });
      continue;
    }

    if (provider === 'own') {
      if (!origin) {
        options.push(unavailable(provider, meta.label, 'Endereço da loja não configurado.'));
        continue;
      }
      if (!destination) {
        options.push(unavailable(provider, meta.label, 'Selecione o endereço de entrega para calcular.'));
        continue;
      }

      const distance = await routeDistance(origin, destination);
      const quote = distance.km > operations.maxKm ? null : quoteOwnDelivery(distance.km, operations.priceTable, operations.subsidyPercent);
      options.push(
        quote
          ? {
              provider,
              label: meta.label,
              description: `${distance.km.toFixed(1)} km${distance.minutes ? ` · ~${distance.minutes} min` : ''}`,
              fee: quote.customerFee,
              distanceKm: distance.km,
              needsAddress: true,
              available: true,
            }
          : { ...unavailable(provider, meta.label, `Fora do raio de atendimento (${operations.maxKm} km).`), distanceKm: distance.km },
      );
      continue;
    }

    options.push({
      provider,
      label: meta.label,
      description: meta.description,
      fee: null,
      distanceKm: origin && destination ? (await routeDistance(origin, destination)).km : null,
      needsAddress: true,
      available: true,
    });
  }

  return NextResponse.json({
    options,
    geoAvailable: isGeoAvailable(),
    storeConfigured: Boolean(origin),
    subsidyPercent: operations.subsidyPercent,
  });
}

async function resolveDestination(body: any) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return { lat, lng };

  const placeId = String(body?.placeId || '').trim();
  if (!placeId || !isGeoAvailable()) return null;

  const address = await resolvePlace(placeId).catch(() => null);
  if (!address || address.lat == null || address.lng == null) return null;
  return { lat: address.lat, lng: address.lng };
}

function unavailable(provider: DeliveryProvider, label: string, reason: string): Option {
  return { provider, label, description: reason, fee: null, distanceKm: null, needsAddress: true, available: false, reason };
}

function currency(value: number) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}
