import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/server/auth';
import { notifyOrderStatusChange, readOrder } from '@/lib/server/orders';
import { supabaseRest } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
]);

/** Estados que so existem apos a migracao 20260912_order_logistics_states.sql. */
const NEW_STATES = new Set(['out_for_delivery', 'delivered']);

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
    const payload: Record<string, unknown> = { status, updated_at: changedAt };
    if (status === 'out_for_delivery') payload.dispatched_at = changedAt;
    if (status === 'delivered' || status === 'completed') payload.delivered_at = changedAt;

    try {
      await supabaseRest(`orders?id=eq.${orderId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Colunas de data ausentes: grava o essencial e segue.
      if (/column|PGRST204/i.test(message)) {
        await supabaseRest(`orders?id=eq.${orderId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status, updated_at: changedAt }),
        });
      } else if (/orders_status_check/i.test(message) && NEW_STATES.has(status)) {
        return NextResponse.json(
          { error: 'Este estado exige a migração 20260912_order_logistics_states.sql no Supabase.' },
          { status: 409 },
        );
      } else {
        throw error;
      }
    }

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
