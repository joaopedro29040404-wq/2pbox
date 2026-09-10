import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/server/env';
import { enqueueEmail } from '@/lib/server/notifications';
import { readOrderWithItems } from '@/lib/server/orders';
import { markProcessed } from '@/lib/server/redis';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIONS = new Set(['account_created', 'password_reset', 'order_details']);

async function buildRecoveryLink(email: string) {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${getSiteUrl()}/conta?recuperacao=1` },
  });
  if (error) {
    console.error('[conta/notificar] generateLink falhou:', error.message);
    return null;
  }
  return data?.properties?.action_link || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    if (!email.includes('@')) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });

    const allowed = await markProcessed(`notify:${action}:${email}`, 60);
    if (!allowed) return NextResponse.json({ ok: true, throttled: true });

    if (action === 'account_created') {
      await enqueueEmail({
        template: 'account_created',
        to: email,
        data: { name: body?.name || '', email },
        dedupeKey: `account_created:${email}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'password_reset') {
      const resetUrl = await buildRecoveryLink(email);
      if (!resetUrl) return NextResponse.json({ ok: true, delivered: false });
      await enqueueEmail({
        template: 'password_reset',
        to: email,
        data: { name: body?.name || '', resetUrl },
        dedupeKey: `password_reset:${email}:${Date.now()}`,
      });
      return NextResponse.json({ ok: true });
    }

    const orderId = String(body?.orderId || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });

    const context = await readOrderWithItems(orderId);
    if (!context) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    const orderEmail = String(context.order.customer_email || '').trim().toLowerCase();
    if (orderEmail !== email) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    await enqueueEmail({
      template: 'order_details',
      to: email,
      data: { order: context.order, items: context.items },
      dedupeKey: `order_details:${orderId}:${context.order.updated_at || context.order.created_at}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[conta/notificar] erro:', error);
    return NextResponse.json({ error: 'Não foi possível enviar o e-mail.' }, { status: 500 });
  }
}
