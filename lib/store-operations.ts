export type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export const WEEK_DAYS: Array<{ value: WeekDay; label: string; short: string }> = [
  { value: 'sun', label: 'Domingo', short: 'Dom' },
  { value: 'mon', label: 'Segunda', short: 'Seg' },
  { value: 'tue', label: 'Terça', short: 'Ter' },
  { value: 'wed', label: 'Quarta', short: 'Qua' },
  { value: 'thu', label: 'Quinta', short: 'Qui' },
  { value: 'fri', label: 'Sexta', short: 'Sex' },
  { value: 'sat', label: 'Sábado', short: 'Sáb' },
];

const DAY_INDEX: Record<WeekDay, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export const SHIPPING_MODES = [
  { value: 'whatsapp', label: 'Combinar pelo WhatsApp' },
  { value: 'own', label: 'Entrega própria (motoboy da loja)' },
  { value: 'app', label: 'Aplicativo de motofrete' },
  { value: 'pickup_only', label: 'Somente retirada' },
] as const;

export const PICKUP_MODES = [
  { value: 'store', label: 'Retirada no balcão da loja' },
  { value: 'locker', label: 'Retirada em armário/locker' },
  { value: 'scheduled', label: 'Retirada com horário agendado' },
  { value: 'disabled', label: 'Sem retirada' },
] as const;

export const DELIVERY_PROVIDERS = [
  { value: 'pickup', label: 'Retirada na loja' },
  { value: 'own', label: 'Motoboy da loja' },
  { value: 'app', label: 'Motofrete por aplicativo' },
] as const;

export type ShippingMode = (typeof SHIPPING_MODES)[number]['value'];
export type PickupMode = (typeof PICKUP_MODES)[number]['value'];
export type DeliveryProvider = (typeof DELIVERY_PROVIDERS)[number]['value'];

export type DeliveryTier = { upToKm: number; price: number };

export function normalizePriceTable(value: unknown): DeliveryTier[] {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item: any) => ({ upToKm: Number(item?.upToKm ?? item?.up_to_km ?? 0), price: Number(item?.price ?? 0) }))
    .filter((tier) => Number.isFinite(tier.upToKm) && tier.upToKm > 0 && Number.isFinite(tier.price) && tier.price >= 0)
    .sort((a, b) => a.upToKm - b.upToKm);
}

export const DEFAULT_PRICE_TABLE: DeliveryTier[] = [
  { upToKm: 2, price: 8 },
  { upToKm: 4, price: 12 },
  { upToKm: 7, price: 18 },
  { upToKm: 12, price: 26 },
];

/**
 * O cliente paga o valor da faixa menos o subsidio da loja. Sem faixa que
 * cubra a distancia, a entrega propria nao atende o endereco.
 */
export function quoteOwnDelivery(distanceKm: number, table: DeliveryTier[], subsidyPercent: number) {
  const tiers = table.length ? table : DEFAULT_PRICE_TABLE;
  const tier = tiers.find((item) => distanceKm <= item.upToKm);
  if (!tier) return null;

  const subsidy = Math.max(0, Math.min(100, Number(subsidyPercent) || 0));
  const discount = Math.round(tier.price * (subsidy / 100) * 100) / 100;
  const customerFee = Math.round((tier.price - discount) * 100) / 100;
  return { tierKm: tier.upToKm, listPrice: tier.price, subsidy: discount, customerFee };
}

export function isStoreOpen(days: string[] | null | undefined, opensAt?: string | null, closesAt?: string | null, now = new Date()) {
  const active = Array.isArray(days) ? days : [];
  if (!active.length) return false;

  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now).toLowerCase().slice(0, 3);
  const today = WEEK_DAYS.find((day) => day.value === weekday);
  if (!today || !active.includes(today.value)) return false;

  const parts = zonedParts(now);
  const minutes = parts.hour * 60 + parts.minute;
  const open = toMinutes(opensAt) ?? 0;
  const close = toMinutes(closesAt) ?? 24 * 60;
  return minutes >= open && minutes < close;
}

function toMinutes(value?: string | null) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

export function describeHours(days: string[] | null | undefined, opensAt?: string | null, closesAt?: string | null) {
  const active = WEEK_DAYS.filter((day) => (days || []).includes(day.value));
  if (!active.length) return '';

  const indexes = active.map((day) => DAY_INDEX[day.value]).sort((a, b) => a - b);
  const sequential = indexes.every((value, position) => position === 0 || value === indexes[position - 1] + 1);
  const label = sequential && active.length > 2 ? `${active[0].short}–${active[active.length - 1].short}` : active.map((day) => day.short).join(', ');
  const hours = opensAt && closesAt ? `${opensAt} às ${closesAt}` : '';
  return hours ? `${label} • ${hours}` : label;
}

const TZ = 'America/Sao_Paulo';

const TZ_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function zonedParts(date: Date) {
  const parts: Record<string, number> = {};
  for (const part of TZ_PARTS.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute, second: parts.second };
}

function offsetMinutes(date: Date) {
  const parts = zonedParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/** Instante UTC que corresponde ao horario de parede informado em Sao Paulo. */
function zonedTimeToInstant(year: number, month: number, day: number, hour: number) {
  const naive = Date.UTC(year, month - 1, day, hour, 0, 0);
  let instant = new Date(naive - offsetMinutes(new Date(naive)) * 60000);
  // Uma segunda passada acerta a borda de mudanca de offset.
  instant = new Date(naive - offsetMinutes(instant) * 60000);
  return instant;
}

/**
 * O dia operacional da entrega vira as 16h: um pedido feito as 15h59 sai no
 * ciclo do dia; as 16h01 entra no ciclo seguinte. O calculo e sempre no fuso da
 * loja, para o painel nao trocar de ciclo por causa do fuso do servidor.
 */
export function cycleStartFor(date: Date, cycleHour = 16) {
  const parts = zonedParts(date);
  const day = parts.hour < cycleHour ? shiftDay(parts, -1) : parts;
  return zonedTimeToInstant(day.year, day.month, day.day, cycleHour);
}

export function cycleRange(date: Date, cycleHour = 16) {
  const start = cycleStartFor(date, cycleHour);
  return { start, end: shiftCycle(start, 1, cycleHour) };
}

export function shiftCycle(start: Date, days: number, cycleHour = 16) {
  const parts = zonedParts(start);
  const target = shiftDay(parts, days);
  return zonedTimeToInstant(target.year, target.month, target.day, cycleHour);
}

function shiftDay(parts: { year: number; month: number; day: number }, days: number) {
  const moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  moved.setUTCDate(moved.getUTCDate() + days);
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

export function describeCycle(start: Date, cycleHour = 16) {
  const end = shiftCycle(start, 1, cycleHour);
  const day = (value: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(value);
  const hour = String(cycleHour).padStart(2, '0');
  return `${day(start)} ${hour}h → ${day(end)} ${hour}h`;
}

export function haversineKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}
