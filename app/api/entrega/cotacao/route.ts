import { NextResponse } from 'next/server';
import { isGeoAvailable, resolvePlace, routeDistance } from '@/lib/server/geo';
import { readStoreOperations, storeOrigin } from '@/lib/server/store-settings';
import { quoteOwnDelivery } from '@/lib/store-operations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Option = {
  provider: 'pickup' | 'own' | 'app';
  label: string;
  description: string;
  fee: number | null;
  distanceKm: number | null;
  available: boolean;
  reason?: string;
};

export async function POST(request: Request) {
  const operations = await readStoreOperations();
  const body = await request.json().catch(() => ({}));
  const origin = storeOrigin(operations);

  const options: Option[] = [];

  if (operations.pickupEnabled && operations.pickupMode !== 'disabled') {
    options.push({
      provider: 'pickup',
      label: 'Retirar na loja',
      description: 'Sem custo de entrega',
      fee: 0,
      distanceKm: null,
      available: true,
    });
  }

  const destination = await resolveDestination(body);

  if (operations.ownDeliveryEnabled) {
    if (!origin) {
      options.push(unavailable('own', 'Motoboy da loja', 'Endereço da loja não configurado.'));
    } else if (!destination) {
      options.push(unavailable('own', 'Motoboy da loja', 'Selecione o endereço de entrega para calcular.'));
    } else {
      const distance = await routeDistance(origin, destination);
      const quote = distance.km > operations.maxKm ? null : quoteOwnDelivery(distance.km, operations.priceTable, operations.subsidyPercent);
      options.push(
        quote
          ? {
              provider: 'own',
              label: 'Motoboy da loja',
              description: `${distance.km.toFixed(1)} km${distance.minutes ? ` • ~${distance.minutes} min` : ''}`,
              fee: quote.customerFee,
              distanceKm: distance.km,
              available: true,
            }
          : {
              ...unavailable('own', 'Motoboy da loja', `Fora do raio de atendimento (${operations.maxKm} km).`),
              distanceKm: distance.km,
            },
      );
    }
  }

  if (operations.appDeliveryEnabled) {
    options.push({
      provider: 'app',
      label: 'Motofrete por aplicativo',
      description: 'A loja chama o motofrete e informa o valor no WhatsApp',
      fee: null,
      distanceKm: destination && origin ? (await routeDistance(origin, destination)).km : null,
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
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  const placeId = String(body?.placeId || '').trim();
  if (!placeId || !isGeoAvailable()) return null;

  const address = await resolvePlace(placeId).catch(() => null);
  if (!address || address.lat == null || address.lng == null) return null;
  return { lat: address.lat, lng: address.lng };
}

function unavailable(provider: Option['provider'], label: string, reason: string): Option {
  return { provider, label, description: reason, fee: null, distanceKm: null, available: false, reason };
}
