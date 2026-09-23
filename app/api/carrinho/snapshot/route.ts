import { NextResponse } from 'next/server';
import { supabaseRest } from '@/lib/server/supabase-admin';
import { checkRateLimit, clientIp } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CartItem = { id?: string; name?: string; price?: number; quantity?: number };

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024) return NextResponse.json({ ok: false, ignored: true }, { status: 200 });
    const subject = clientIp(request) || 'unknown';
    if (!(await checkRateLimit('cart-snapshot', subject, 120, 10 * 60))) return NextResponse.json({ ok: false, ignored: true }, { status: 200 });
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    if (!email.includes('@')) return NextResponse.json({ ok: false, ignored: true });

    const rawItems: CartItem[] = Array.isArray(body?.items) ? body.items : [];
    const items = rawItems
      .filter((item) => item && item.name)
      .slice(0, 30)
      .map((item) => ({
        id: String(item.id || ''),
        name: String(item.name).slice(0, 160),
        price: Number(item.price || 0),
        quantity: Math.max(1, Number(item.quantity || 1)),
      }));

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const now = new Date().toISOString();

    if (!items.length) {
      await supabaseRest(`abandoned_carts?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ items: [], total: 0, converted_at: now, updated_at: now }),
      }).catch(() => undefined);
      return NextResponse.json({ ok: true, cleared: true });
    }

    await supabaseRest('abandoned_carts?on_conflict=email', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        email,
        customer_name: String(body?.name || '').slice(0, 120) || null,
        items,
        total,
        reminded_at: null,
        converted_at: null,
        updated_at: now,
      }),
    });

    return NextResponse.json({ ok: true, items: items.length, total });
  } catch (error) {
    console.error('[carrinho/snapshot] erro:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
