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
  expressEnabled: boolean;
  expressFee: number;
  appDeliveryEnabled: boolean;
  subsidyPercent: number;
  maxKm: number;
  priceTable: DeliveryTier[];
  cycleHour: number;
};

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
  const rows = await supabaseRest('store_settings?select=*&order=updated_at.desc.nullslast&limit=1').catch(() => null);
  return Array.isArray(rows) ? rows[0] || null : null;
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
    expressEnabled: Boolean(data.delivery_express_enabled),
    expressFee: num(data.delivery_express_fee, 0),
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
