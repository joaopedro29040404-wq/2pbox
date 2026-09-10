import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { notifyOrderStatusChange, readOrder } from '@/lib/server/orders';
import { supabaseRest } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']);

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    const status = String(body?.status || '').trim().toLowerCase();
    const note = String(body?.note || '').trim();

    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });
    if (!ALLOWED.has(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });

    const current = await readOrder(orderId);
    if (!current) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    const previousStatus = String(current.status || 'pending').toLowerCase();
    if (previousStatus === status) return NextResponse.json({ ok: true, status, unchanged: true });

    const changedAt = new Date().toISOString();
    await supabaseRest(`orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status, updated_at: changedAt }),
    });

    if (note) {
      await supabaseRest('order_status_history', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ order_id: orderId, status, payment_status: current.payment_status, note, source: 'admin' }),
      }).catch(() => undefined);
    }

    await notifyOrderStatusChange(orderId, status, previousStatus, changedAt).catch((error) =>
      console.error('[admin/pedidos/status] notificação falhou:', error),
    );

    return NextResponse.json({ ok: true, status, previousStatus, changedAt });
  } catch (error) {
    console.error('[admin/pedidos/status] erro:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o pedido.' }, { status: 500 });
  }
}
