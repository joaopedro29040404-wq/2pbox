import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
import { getSessionUser } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = String(body?.order_id || '').trim();
    const sessionId = String(body?.session_id || '').trim().slice(0, 160);
    if (!orderId || !sessionId) return NextResponse.json({ ok: false }, { status: 400 });
    const client = getAdminSupabase();
    if (!client) return NextResponse.json({ ok: false }, { status: 503 });
    const user = await getSessionUser();
    if (user) { const { data } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle(); if (data) return NextResponse.json({ ok: true, ignored: true }); }

    const { data: order, error: orderError } = await client.from('orders').select('id,created_at,customer_id,payment_status,analytics_session_id').eq('id', orderId).maybeSingle();
    if (orderError || !order) return NextResponse.json({ ok: false }, { status: 404 });
    const createdAt = new Date(order.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 60 * 60 * 1000) return NextResponse.json({ ok: false }, { status: 410 });
    if (order.customer_id && user && order.customer_id !== user.id) return NextResponse.json({ ok: false }, { status: 403 });

    const attribution = {
      analytics_session_id: order.analytics_session_id || sessionId,
      analytics_utm_source: String(body?.utm_source || '').trim().toLowerCase().slice(0, 120) || null,
      analytics_utm_medium: String(body?.utm_medium || '').trim().toLowerCase().slice(0, 120) || null,
      analytics_utm_campaign: String(body?.utm_campaign || '').trim().slice(0, 180) || null,
    };
    const { error } = await client.from('orders').update(attribution).eq('id', orderId);
    if (error) throw new Error(error.message);

    await client.from('analytics_events').update({ session_id: attribution.analytics_session_id, utm_source: attribution.analytics_utm_source, utm_medium: attribution.analytics_utm_medium, utm_campaign: attribution.analytics_utm_campaign }).eq('event_name', 'purchase').eq('order_id', orderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Attribution failed.' }, { status: 500 });
  }
}
