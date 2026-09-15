import { NextResponse } from 'next/server';
import { geocodeAddress, isGeoAvailable, resolvePlace, routeDistance } from '@/lib/server/geo';
import { readStoreOperations, storeOrigin, type StoreOperations } from '@/lib/server/store-settings';
import { DELIVERY_PROVIDERS, applySubsidy, quoteOwnDelivery, type DeliveryProvider } from '@/lib/store-operations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Option = { provider: DeliveryProvider; label: string; description: string; fee: number | null; baseFee: number | null; subsidy: number | null; distanceKm: number | null; minutes: number | null; needsAddress: boolean; available: boolean; reason?: string };

function enabledProviders(operations: StoreOperations): DeliveryProvider[] {
  const active: DeliveryProvider[] = [];
  if (operations.pickupEnabled && operations.pickupMode !== 'disabled') active.push('pickup');
  if (operations.ownDeliveryEnabled) active.push('own');
  if (operations.expressEnabled) active.push('express');
  if (operations.appDeliveryEnabled) active.push('app');
  return active;
}

function describe(provider: DeliveryProvider) { return DELIVERY_PROVIDERS.find((item) => item.value === provider)!; }

export async function GET() {
  const operations = await readStoreOperations();
  const providers = enabledProviders(operations);
  return NextResponse.json({
    sameDay: { enabled: operations.sameDayEnabled, cutoff: operations.sameDayCutoff },
    address: storeAddressLabel(operations),
    options: providers.filter((provider) => provider !== 'express' || operations.expressPriceTable.length > 0).map((provider) => {
      const meta = describe(provider);
      return { provider, label: meta.label, description: meta.description, fee: provider === 'pickup' ? 0 : null, needsAddress: meta.needsAddress };
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
      options.push({ provider, label: meta.label, description: meta.description, fee: 0, baseFee: 0, subsidy: 0, distanceKm: null, minutes: null, needsAddress: false, available: true });
      continue;
    }

    if (!origin) {
      options.push(unavailable(provider, meta.label, 'Endereço da loja não configurado.'));
      continue;
    }
    if (!destination) {
      options.push(unavailable(provider, meta.label, 'Informe o endereço de entrega para calcular o frete.'));
      continue;
    }

    const distance = await routeDistance(origin, destination);
    const maxKm = provider === 'express' ? operations.expressMaxKm : operations.maxKm;
    const table = provider === 'express' ? operations.expressPriceTable : operations.priceTable;
    const subsidy = provider === 'own' ? operations.subsidyPercent : 0;
    const quote = distance.km > maxKm ? null : quoteOwnDelivery(distance.km, table, subsidy);

    options.push(
      quote
        ? {
            provider,
            label: meta.label,
            description: `${distance.km.toFixed(1)} km${distance.minutes ? ` · ~${distance.minutes} min` : ''}`,
            fee: quote.customerFee,
            baseFee: quote.baseFee,
            subsidy: quote.subsidy,
            distanceKm: distance.km,
            minutes: distance.minutes,
            needsAddress: true,
            available: true,
          }
        : {
            ...unavailable(
              provider,
              meta.label,
              table.length === 0
                ? 'A tabela de preços desta modalidade ainda não foi configurada pela loja.'
                : `Fora do raio de atendimento (${maxKm} km).`,
            ),
            distanceKm: distance.km,
          },
    );
  }

  return NextResponse.json({ options, geoAvailable: isGeoAvailable(), storeConfigured: Boolean(origin), subsidyPercent: operations.subsidyPercent });
}

async function resolveDestination(body: any) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return { lat, lng };
  if (!isGeoAvailable()) return null;
  const placeId = String(body?.placeId || '').trim();
  if (placeId) {
    const address = await resolvePlace(placeId).catch(() => null);
    if (address?.lat != null && address?.lng != null) return { lat: address.lat, lng: address.lng };
  }
  const typed = body?.address;
  if (typed && typeof typed === 'object') {
    return geocodeAddress({ street: typed.street ?? typed.line, number: typed.number, district: typed.neighborhood ?? typed.district, city: typed.city, state: typed.state, zip: typed.postal_code ?? typed.zip });
  }
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
