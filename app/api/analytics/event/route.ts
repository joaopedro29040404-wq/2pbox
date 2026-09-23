import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
import { getSessionUser, requireAdminUser } from '@/lib/server/auth';
import { checkRateLimit, clientIp } from '@/lib/server/rate-limit';

const EVENTS = new Set(['page_view','product_view','add_to_cart','remove_from_cart','begin_checkout','payment_started','purchase']);
const DEVICES = new Set(['mobile','tablet','desktop','unknown']);
const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_METADATA_BYTES = 8 * 1024;

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
    const body = await request.json();
    const eventName = String(body?.event_name || '').trim();
    const sessionId = String(body?.session_id || '').trim().slice(0, 160);
    if (!EVENTS.has(eventName) || !sessionId) return NextResponse.json({ ok: false }, { status: 400 });

    const ip = clientIp(request);
    const [ipAllowed, sessionAllowed] = await Promise.all([
      checkRateLimit('analytics-ip', ip || 'unknown', 500, 60),
      checkRateLimit('analytics-session', sessionId, 180, 60),
    ]);
    if (!ipAllowed || !sessionAllowed) return NextResponse.json({ ok: true, ignored: true });
    if (await requireAdminUser()) return NextResponse.json({ ok: true, ignored: true });

    const client = getAdminSupabase();
    if (!client) return NextResponse.json({ ok: false }, { status: 503 });
    const [{ data: excludedDevice }, { data: blockedIp }] = await Promise.all([
      client.from('analytics_excluded_devices').select('session_id').eq('session_id', sessionId).maybeSingle(),
      ip ? client.from('analytics_excluded_ips').select('ip_address').eq('ip_address', ip).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (excludedDevice || blockedIp) return NextResponse.json({ ok: true, ignored: true });

    const user = await getSessionUser();
    let productId = String(body?.product_id || '').trim() || null;
    let metadata: Record<string, unknown> = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};
    try { if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) metadata = {}; } catch { metadata = {}; }
    if (!productId && eventName === 'product_view' && metadata.slug) {
      const { data } = await client.from('products').select('id').eq('slug', String(metadata.slug)).eq('active', true).maybeSingle();
      productId = data?.id || null;
    }
    const source = String(body?.utm_source || '').trim().toLowerCase().slice(0, 120) || null;
    const medium = String(body?.utm_medium || '').trim().toLowerCase().slice(0, 120) || null;
    const campaign = String(body?.utm_campaign || '').trim().slice(0, 180) || null;
    const device = String(body?.device_type || 'unknown').trim().toLowerCase();
    const pagePath = String(body?.page_path || '').trim().slice(0, 500) || null;
    const value = Number(body?.value);
    const { error } = await client.from('analytics_events').insert({
      event_name: eventName, session_id: sessionId, user_id: user?.id || null, product_id: productId,
      page_path: pagePath, utm_source: source, utm_medium: medium, utm_campaign: campaign,
      referrer: String(body?.referrer || '').trim().slice(0, 1000) || null,
      device_type: DEVICES.has(device) ? device : 'unknown', value: Number.isFinite(value) ? value : null,
      metadata, ip_address: ip,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Analytics event failed.' }, { status: 500 });
  }
}
