import { supabaseRest } from './supabase-admin';
import { DEFAULT_PRICE_TABLE, businessHoursFromLegacy, normalizeBusinessHours, normalizePriceTable, openDays, type BusinessHours, type DeliveryTier } from '../store-operations';

export type StoreOperations = {
  id: string | null;
  name: string;
  whatsapp: string;
  businessHours: BusinessHours;
  businessDays: string[];
  shippingMode: string;
  pickupMode: string;
  serviceFeePercent: number;
  serviceFeeFixed: number;
  minOrderTotal: number;
  freeShippingFrom: number | null;
  address: {
    line: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    zip: string;
    placeId: string | null;
    lat: number | null;
    lng: number | null;
  };
  pickupEnabled: boolean;
  ownDeliveryEnabled: boolean;
  appDeliveryEnabled: boolean;
  subsidyPercent: number;
  maxKm: number;
  priceTable: DeliveryTier[];
  cycleHour: number;
};

const OPERATIONS_FIELDS =
  'id,name,whatsapp,business_hours,business_days,opens_at,closes_at,shipping_mode,pickup_mode,service_fee_percent,service_fee_fixed,min_order_total,free_shipping_from,address_line,address_number,address_complement,address_district,address_city,address_state,address_zip,address_place_id,address_lat,address_lng,delivery_pickup_enabled,delivery_own_enabled,delivery_app_enabled,delivery_subsidy_percent,delivery_max_km,delivery_price_table,delivery_cycle_hour';

const FALLBACK_FIELDS = 'id,name,whatsapp,hours,pickup,shipping';

let cache: { value: StoreOperations; at: number } | null = null;
const CACHE_MS = 30_000;

export async function readStoreOperations(options: { fresh?: boolean } = {}): Promise<StoreOperations> {
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const row = await fetchRow();
  const value = mapRow(row);
  cache = { value, at: Date.now() };
  return value;
}

export function invalidateStoreOperations() {
  cache = null;
}

async function fetchRow() {
  const query = (fields: string) => `store_settings?select=${fields}&order=updated_at.desc.nullslast&limit=1`;
  const primary = await supabaseRest(query(OPERATIONS_FIELDS)).catch(() => null);
  if (Array.isArray(primary)) return primary[0] || null;

  const fallback = await supabaseRest(query(FALLBACK_FIELDS)).catch(() => null);
  return Array.isArray(fallback) ? fallback[0] || null : null;
}

function mapRow(row: any): StoreOperations {
  const data = row || {};
  const table = normalizePriceTable(data.delivery_price_table);
  const stored = normalizeBusinessHours(data.business_hours);
  const hours = Object.keys(stored).length
    ? stored
    : businessHoursFromLegacy(
        Array.isArray(data.business_days) && data.business_days.length ? data.business_days : ['mon', 'tue', 'wed', 'thu', 'fri'],
        data.opens_at,
        data.closes_at,
      );

  return {
    id: data.id ? String(data.id) : null,
    name: String(data.name || '2P Box'),
    whatsapp: String(data.whatsapp || ''),
    businessHours: hours,
    businessDays: openDays(hours),
    shippingMode: String(data.shipping_mode || 'whatsapp'),
    pickupMode: String(data.pickup_mode || 'store'),
    serviceFeePercent: num(data.service_fee_percent, 0),
    serviceFeeFixed: num(data.service_fee_fixed, 0),
    minOrderTotal: num(data.min_order_total, 0),
    freeShippingFrom: data.free_shipping_from == null ? null : num(data.free_shipping_from, 0),
    address: {
      line: String(data.address_line || ''),
      number: String(data.address_number || ''),
      complement: String(data.address_complement || ''),
      district: String(data.address_district || ''),
      city: String(data.address_city || ''),
      state: String(data.address_state || ''),
      zip: String(data.address_zip || ''),
      placeId: data.address_place_id ? String(data.address_place_id) : null,
      lat: data.address_lat == null ? null : num(data.address_lat, 0),
      lng: data.address_lng == null ? null : num(data.address_lng, 0),
    },
    pickupEnabled: data.delivery_pickup_enabled !== false,
    ownDeliveryEnabled: Boolean(data.delivery_own_enabled),
    appDeliveryEnabled: Boolean(data.delivery_app_enabled),
    subsidyPercent: num(data.delivery_subsidy_percent, 30),
    maxKm: num(data.delivery_max_km, 12),
    priceTable: table.length ? table : DEFAULT_PRICE_TABLE,
    cycleHour: Math.min(23, Math.max(0, Math.round(num(data.delivery_cycle_hour, 16)))),
  };
}

export function storeOrigin(operations: StoreOperations) {
  const { lat, lng } = operations.address;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function num(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
