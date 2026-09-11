import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { isGoogleMapsConfigured } from '@/lib/server/env';
import { supabaseRest } from '@/lib/server/supabase-admin';
import { invalidateStoreOperations, readStoreOperations } from '@/lib/server/store-settings';
import { WEEK_DAYS, describeHours, normalizePriceTable } from '@/lib/store-operations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_DAYS = new Set(WEEK_DAYS.map((day) => day.value));

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });

  const operations = await readStoreOperations({ fresh: true });
  return NextResponse.json({ operations, geoAvailable: isGoogleMapsConfigured(), operationsSchema: await hasOperationsSchema() });
}

export async function PUT(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  const current = await readStoreOperations({ fresh: true });
  const days = Array.isArray(body.businessDays) ? body.businessDays.filter((day: unknown) => VALID_DAYS.has(String(day) as never)) : current.businessDays;
  const opensAt = time(body.opensAt, current.opensAt);
  const closesAt = time(body.closesAt, current.closesAt);

  const legacy = {
    name: text(body.name, current.name) || '2P Box',
    whatsapp: text(body.whatsapp, current.whatsapp),
    hours: describeHours(days, opensAt, closesAt),
    pickup: text(body.pickupLabel, '') || 'Retirada na loja',
    shipping: text(body.shippingLabel, '') || 'Frete via WhatsApp',
    updated_at: new Date().toISOString(),
  };

  const operations = {
    business_days: days,
    opens_at: opensAt,
    closes_at: closesAt,
    shipping_mode: text(body.shippingMode, current.shippingMode),
    pickup_mode: text(body.pickupMode, current.pickupMode),
    service_fee_percent: bounded(body.serviceFeePercent, 0, 100, current.serviceFeePercent),
    service_fee_fixed: bounded(body.serviceFeeFixed, 0, 10000, current.serviceFeeFixed),
    min_order_total: bounded(body.minOrderTotal, 0, 100000, current.minOrderTotal),
    free_shipping_from: body.freeShippingFrom == null || body.freeShippingFrom === '' ? null : bounded(body.freeShippingFrom, 0, 100000, 0),
    address_line: text(body.address?.line, current.address.line),
    address_number: text(body.address?.number, current.address.number),
    address_complement: text(body.address?.complement, current.address.complement),
    address_district: text(body.address?.district, current.address.district),
    address_city: text(body.address?.city, current.address.city),
    address_state: text(body.address?.state, current.address.state).toUpperCase().slice(0, 2),
    address_zip: text(body.address?.zip, current.address.zip),
    address_place_id: text(body.address?.placeId, current.address.placeId || '') || null,
    address_lat: coordinate(body.address?.lat),
    address_lng: coordinate(body.address?.lng),
    delivery_pickup_enabled: bool(body.pickupEnabled, current.pickupEnabled),
    delivery_own_enabled: bool(body.ownDeliveryEnabled, current.ownDeliveryEnabled),
    delivery_app_enabled: bool(body.appDeliveryEnabled, current.appDeliveryEnabled),
    delivery_subsidy_percent: bounded(body.subsidyPercent, 0, 100, current.subsidyPercent),
    delivery_max_km: bounded(body.maxKm, 0.5, 200, current.maxKm),
    delivery_price_table: normalizePriceTable(body.priceTable),
    delivery_cycle_hour: Math.round(bounded(body.cycleHour, 0, 23, current.cycleHour)),
  };

  try {
    await persist(current.id, { ...legacy, ...operations });
    invalidateStoreOperations();
    return NextResponse.json({ ok: true, operationsSchema: true, operations: await readStoreOperations({ fresh: true }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // Antes da migration de operacoes so os campos antigos existem: o admin
    // continua conseguindo salvar o essencial em vez de ver um erro seco.
    if (!/column|schema cache/i.test(message)) {
      return NextResponse.json({ error: message || 'Não foi possível salvar as configurações.' }, { status: 500 });
    }

    try {
      await persist(current.id, legacy);
      invalidateStoreOperations();
      return NextResponse.json({
        ok: true,
        operationsSchema: false,
        warning: 'As configurações de operação exigem a migration 20260913_store_operations.sql. Apenas os dados básicos foram salvos.',
        operations: await readStoreOperations({ fresh: true }),
      });
    } catch (fallbackError) {
      const detail = fallbackError instanceof Error ? fallbackError.message : 'Falha ao salvar.';
      return NextResponse.json({ error: detail }, { status: 500 });
    }
  }
}

async function persist(id: string | null, payload: Record<string, unknown>) {
  if (id) {
    await supabaseRest(`store_settings?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    });
    return;
  }
  await supabaseRest('store_settings', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([payload]),
  });
}

async function hasOperationsSchema() {
  try {
    await supabaseRest('store_settings?select=delivery_cycle_hour&limit=1');
    return true;
  } catch {
    return false;
  }
}

function time(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : fallback;
}

function text(value: unknown, fallback: string) {
  if (value == null) return fallback;
  return String(value).trim();
}

function bounded(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function coordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}
