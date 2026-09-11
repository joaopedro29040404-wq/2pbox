import { getGoogleMapsKey } from './env';
import { fetchJson } from './http';
import { haversineKm } from '../store-operations';
import { getRedis } from './redis';

export type AddressSuggestion = { placeId: string; label: string; secondary: string };

export type ResolvedAddress = {
  placeId: string | null;
  formatted: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
};

const PLACES = 'https://maps.googleapis.com/maps/api/place';
const DISTANCE = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

export function isGeoAvailable() {
  return Boolean(getGoogleMapsKey());
}

export async function suggestAddresses(query: string, sessionToken?: string): Promise<AddressSuggestion[]> {
  const key = getGoogleMapsKey();
  const term = query.trim();
  if (!key || term.length < 4) return [];

  const url = new URL(`${PLACES}/autocomplete/json`);
  url.searchParams.set('input', term);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('components', 'country:br');
  url.searchParams.set('types', 'address');
  if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

  const { data } = await fetchJson<any>(url.toString(), { cache: 'no-store' });
  const status = String(data?.status || '');
  if (status !== 'OK' && status !== 'ZERO_RESULTS') throw new Error(data?.error_message || `Google Places: ${status || 'sem resposta'}`);

  return (data?.predictions || []).slice(0, 8).map((item: any) => ({
    placeId: String(item?.place_id || ''),
    label: String(item?.structured_formatting?.main_text || item?.description || ''),
    secondary: String(item?.structured_formatting?.secondary_text || ''),
  }));
}

export async function resolvePlace(placeId: string, sessionToken?: string): Promise<ResolvedAddress> {
  const key = getGoogleMapsKey();
  if (!key) throw new Error('Google Maps nao configurado.');

  const url = new URL(`${PLACES}/details/json`);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('fields', 'place_id,formatted_address,address_component,geometry');
  if (sessionToken) url.searchParams.set('sessiontoken', sessionToken);

  const { data } = await fetchJson<any>(url.toString(), { cache: 'no-store' });
  if (String(data?.status) !== 'OK') throw new Error(data?.error_message || `Google Places: ${data?.status || 'sem resposta'}`);

  const result = data.result || {};
  const components: any[] = result.address_components || [];
  const pick = (type: string) => components.find((item) => (item?.types || []).includes(type))?.long_name || '';
  const pickShort = (type: string) => components.find((item) => (item?.types || []).includes(type))?.short_name || '';

  return {
    placeId: String(result.place_id || placeId),
    formatted: String(result.formatted_address || ''),
    street: pick('route'),
    number: pick('street_number'),
    district: pick('sublocality_level_1') || pick('sublocality') || pick('neighborhood'),
    city: pick('administrative_area_level_2') || pick('locality'),
    state: pickShort('administrative_area_level_1'),
    zip: pick('postal_code'),
    lat: Number(result.geometry?.location?.lat ?? NaN) || null,
    lng: Number(result.geometry?.location?.lng ?? NaN) || null,
  };
}

export type DistanceResult = { km: number; minutes: number | null; source: 'route' | 'straight-line' };

export async function routeDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DistanceResult> {
  const straight = { km: haversineKm(origin, destination), minutes: null, source: 'straight-line' as const };
  const key = getGoogleMapsKey();
  if (!key) return straight;

  const cacheKey = `geo:route:${round(origin.lat)},${round(origin.lng)}:${round(destination.lat)},${round(destination.lng)}`;
  const redis = getRedis();
  if (redis) {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as DistanceResult;
      } catch {
      }
    }
  }

  const url = new URL(DISTANCE);
  url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destinations', `${destination.lat},${destination.lng}`);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('units', 'metric');

  const { data } = await fetchJson<any>(url.toString(), { cache: 'no-store' });
  const element = data?.rows?.[0]?.elements?.[0];
  if (String(data?.status) !== 'OK' || String(element?.status) !== 'OK') return straight;

  const result: DistanceResult = {
    km: Math.round((Number(element.distance?.value || 0) / 1000) * 100) / 100,
    minutes: element.duration?.value ? Math.round(Number(element.duration.value) / 60) : null,
    source: 'route',
  };
  if (redis) await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS).catch(() => null);
  return result;
}

function round(value: number) {
  return Math.round(Number(value) * 10000) / 10000;
}
