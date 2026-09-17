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
  const [{ data: exclusions, error: exclusionsError }, { data: blockedIps, error: blockedIpsError }, { data: events, error: eventsError }] = await Promise.all([
    client.from('analytics_excluded_devices').select('session_id,label,excluded_at').order('excluded_at', { ascending: false }),
    client.from('analytics_excluded_ips').select('ip_address,label,blocked_at').order('blocked_at', { ascending: false }),
    client.from('analytics_events').select('session_id,device_type,created_at,referrer,utm_source,ip_address').order('created_at', { ascending: false }).range(0, 9999),
  ]);
  if (exclusionsError) return NextResponse.json({ error: exclusionsError.message }, { status: 500 });
  if (blockedIpsError) return NextResponse.json({ error: blockedIpsError.message }, { status: 500 });
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  const excluded = new Set((exclusions || []).map((row) => row.session_id));
  const blocked = new Set((blockedIps || []).map((row) => row.ip_address));
  const detected = new Map<string, { session_id: string; device_type: string; last_seen: string; source: string | null; ip_address: string | null }>();
  for (const event of events || []) {
    if (!event.session_id || detected.has(event.session_id)) continue;
    detected.set(event.session_id, { session_id: event.session_id, device_type: event.device_type || 'unknown', last_seen: event.created_at, source: event.utm_source || event.referrer || null, ip_address: event.ip_address || null });
  }
  const current = detected.get(sessionId);
  return NextResponse.json({ current_session_id: sessionId || null, current_ip: current?.ip_address || null, excluded: sessionId ? excluded.has(sessionId) : false, excluded_devices: exclusions || [], blocked_ips: blockedIps || [], detected_devices: Array.from(detected.values()).slice(0, 50) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const client = getAdminSupabase();
  if (!client) return NextResponse.json({ error: 'Supabase backend não configurado.' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.session_id || '').trim().slice(0, 160);
  const label = String(body?.label || '').trim().slice(0, 120) || null;
  const action = String(body?.action || 'exclude');
  if (action === 'block_ip') {
    const ip = String(body?.ip_address || '').trim().slice(0, 120);
    if (!ip) return NextResponse.json({ error: 'Não foi possível identificar o IP deste dispositivo.' }, { status: 400 });
    const { error } = await client.from('analytics_excluded_ips').upsert({ ip_address: ip, label: label || 'Rede bloqueada', blocked_by: admin.id, blocked_at: new Date().toISOString() }, { onConflict: 'ip_address' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: sessions } = await client.from('analytics_events').select('session_id').eq('ip_address', ip).not('session_id', 'is', null);
    const ids = Array.from(new Set((sessions || []).map((row) => row.session_id).filter(Boolean)));
    if (ids.length) await client.from('orders').update({ analytics_excluded: true }).in('analytics_session_id', ids);
    return NextResponse.json({ ok: true });
  }
  if (!sessionId) return NextResponse.json({ error: 'Dispositivo inválido.' }, { status: 400 });
  if (action === 'exclude') {
    const { error } = await client.from('analytics_excluded_devices').upsert({ session_id: sessionId, label, excluded_by: admin.id, excluded_at: new Date().toISOString() }, { onConflict: 'session_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await client.from('orders').update({ analytics_excluded: true }).eq('analytics_session_id', sessionId);
  } else if (action === 'include') {
    const { error } = await client.from('analytics_excluded_devices').delete().eq('session_id', sessionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await client.from('orders').update({ analytics_excluded: false }).eq('analytics_session_id', sessionId);
  } else if (action === 'unblock_ip') {
    const ip = String(body?.ip_address || '').trim().slice(0, 120);
    if (!ip) return NextResponse.json({ error: 'IP inválido.' }, { status: 400 });
    const { error } = await client.from('analytics_excluded_ips').delete().eq('ip_address', ip);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
