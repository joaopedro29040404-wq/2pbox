import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
import { requireAdminUser } from '@/lib/server/auth';

export async function GET(request: Request) {
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const sessionId = String(url.searchParams.get('session_id') || '').trim().slice(0, 160);

  if (sessionId && !(await requireAdminUser())) {
    const { data } = await client.from('analytics_excluded_devices').select('session_id').eq('session_id', sessionId).maybeSingle();
    return NextResponse.json({ excluded: Boolean(data) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const [{ data: exclusions, error: exclusionsError }, { data: events, error: eventsError }] = await Promise.all([
    client.from('analytics_excluded_devices').select('session_id,label,excluded_at').order('excluded_at', { ascending: false }),
    client.from('analytics_events').select('session_id,device_type,created_at,referrer,utm_source').order('created_at', { ascending: false }).range(0, 9999),
  ]);
  if (exclusionsError) return NextResponse.json({ error: exclusionsError.message }, { status: 500 });
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  const excluded = new Set((exclusions || []).map((row) => row.session_id));
  const detected = new Map<string, { session_id: string; device_type: string; last_seen: string; source: string | null }>();
  for (const event of events || []) {
    if (!event.session_id || detected.has(event.session_id)) continue;
    detected.set(event.session_id, {
      session_id: event.session_id,
      device_type: event.device_type || 'unknown',
      last_seen: event.created_at,
      source: event.utm_source || event.referrer || null,
    });
  }

  return NextResponse.json({
    current_session_id: sessionId || null,
    excluded: sessionId ? excluded.has(sessionId) : false,
    excluded_devices: exclusions || [],
    detected_devices: Array.from(detected.values()).slice(0, 50),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.session_id || '').trim().slice(0, 160);
  const label = String(body?.label || '').trim().slice(0, 120) || null;
  const action = body?.action === 'include' ? 'include' : 'exclude';
  if (!sessionId) return NextResponse.json({ error: 'Dispositivo inválido.' }, { status: 400 });

  if (action === 'exclude') {
    const { error } = await client.from('analytics_excluded_devices').upsert({
      session_id: sessionId,
      label,
      excluded_by: admin.id,
      excluded_at: new Date().toISOString(),
    }, { onConflict: 'session_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: ordersError } = await client.from('orders').update({ analytics_excluded: true }).eq('analytics_session_id', sessionId);
    if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  } else {
    const { error } = await client.from('analytics_excluded_devices').delete().eq('session_id', sessionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: ordersError } = await client.from('orders').update({ analytics_excluded: false }).eq('analytics_session_id', sessionId);
    if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
