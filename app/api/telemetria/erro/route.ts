import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/server/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACCEPTED = { ok: true };
const MAX_FIELD = 400;
const RATE_LIMIT_PER_MINUTE = 30;

const SCOPES = new Set(['payment-brick', 'checkout', 'pix', 'delivery']);

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD);
}

async function withinRateLimit(ip: string) {
  const redis = getRedis();
  if (!redis) return true;

  try {
    const key = `telemetry:error:${ip}`;
    const total = await redis.incr(key);
    if (total === 1) await redis.expire(key, 60);
    return total <= RATE_LIMIT_PER_MINUTE;
  } catch {
    return true;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json(ACCEPTED);

  const scope = clean(body.scope);
  if (!SCOPES.has(scope)) return NextResponse.json(ACCEPTED);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconhecido';
  if (!(await withinRateLimit(ip))) return NextResponse.json(ACCEPTED);

  console.error(
    `[cliente:${scope}]`,
    JSON.stringify({
      orderId: clean(body.orderId) || null,
      type: clean(body.type) || null,
      cause: clean(body.cause) || null,
      message: clean(body.message) || null,
      url: clean(body.url) || null,
      userAgent: clean(request.headers.get('user-agent')),
      ip,
      at: new Date().toISOString(),
    }),
  );

  return NextResponse.json(ACCEPTED);
}
