import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/server/env';
import { enqueueEmail } from '@/lib/server/notifications';
import { readOrderWithItems } from '@/lib/server/orders';
import { markProcessed } from '@/lib/server/redis';
import { findAuthUserByEmail, getAdminSupabase } from '@/lib/server/supabase-admin';
import { checkRateLimit, clientIp } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIONS = new Set(['account_created', 'account_signup', 'password_reset', 'order_details', 'guest_order_access']);
const WELCOME_WINDOW_MS = 30 * 60 * 1000;
const ACCEPTED = { ok: true } as const;

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

async function buildGuestOrderAccessLink(email: string, name: string) {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${getSiteUrl()}/conta`,
      data: { full_name: name },
    },
  });
  if (error) {
    console.error('[conta/notificar] magiclink falhou:', error.message);
    return null;
  }
  return data?.properties?.action_link || null;
}

async function buildAccountSignupLink(email: string, password: string, name: string, phone: string, cpf: string) {
  const admin = getAdminSupabase();
  if (!admin) return null;

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo: `${getSiteUrl()}/conta`,
      data: {
        full_name: name,
        phone,
        cpf: cpf || null,
      },
    },
  });

  if (error) {
    console.error('[conta/notificar] signup generateLink falhou:', error.message);
    return { error: error.message };
  }

  return {
    actionLink: data?.properties?.action_link || null,
    userId: data?.user?.id || null,
  };
}

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > 24 * 1024) return NextResponse.json({ error: 'Requisição inválida.' }, { status: 413 });

    const subject = clientIp(request) || 'unknown';
    if (!(await checkRateLimit('account-notify-ip', subject, 80, 10 * 60))) {
      return NextResponse.json({ error: 'Muitas solicitações em pouco tempo. Tente novamente mais tarde.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
    if (!email.includes('@')) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    if (!(await checkRateLimit(`account-notify-${action}`, subject, 40, 10 * 60))) {
      return NextResponse.json({ error: 'Muitas solicitações em pouco tempo. Tente novamente mais tarde.' }, { status: 429 });
    }

    if (action === 'account_signup') {
      const password = String(body?.password || '');
      const name = String(body?.name || '').trim();
      const phone = String(body?.phone || '').trim();
      const cpf = String(body?.cpf || '').trim();

      if (password.length < 6) return NextResponse.json({ error: 'A senha precisa ter ao menos 6 caracteres.' }, { status: 400 });
      if (!name || !phone) return NextResponse.json({ error: 'Nome e telefone são obrigatórios.' }, { status: 400 });

      const allowed = await markProcessed(`notify:account_signup:${email}`, 60);
      if (!allowed) return NextResponse.json(ACCEPTED);

      const result = await buildAccountSignupLink(email, password, name, phone, cpf);
      if (!result || result.error) {
        const message = String(result?.error || 'Não foi possível criar a conta.');
        if (/already|registered|exists|duplicate/i.test(message)) {
          return NextResponse.json({ error: 'Este e-mail já possui uma conta. Entre para continuar.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Não foi possível criar a conta. Tente novamente.' }, { status: 500 });
      }

      if (!result.actionLink) {
        return NextResponse.json({ error: 'Não foi possível gerar a confirmação da conta.' }, { status: 500 });
      }

      await enqueueEmail({
        template: 'account_created',
        to: email,
        data: {
          name,
          email,
          confirmUrl: result.actionLink,
        },
        dedupeKey: `account_created:${result.userId || email}`,
      });

      await markProcessed(`notify:account_created:${email}`, WELCOME_WINDOW_MS / 1000);
      return NextResponse.json(ACCEPTED);
    }

    if (action === 'guest_order_access') {
      const orderId = String(body?.orderId || '').trim();
      if (!orderId) return NextResponse.json({ error: 'Pedido é obrigatório.' }, { status: 400 });

      const context = await readOrderWithItems(orderId);
      if (!context) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

      const orderEmail = String(context.order.customer_email || '').trim().toLowerCase();
      if (orderEmail !== email) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

      const allowed = await markProcessed(`notify:guest_order_access:${email}:${orderId}`, 60);
      if (!allowed) return NextResponse.json(ACCEPTED);

      const accessUrl = await buildGuestOrderAccessLink(email, String(body?.name || context.order.customer_name || '').trim());
      if (!accessUrl) return NextResponse.json({ error: 'Não foi possível gerar o acesso seguro ao pedido.' }, { status: 500 });

      await enqueueEmail({
        template: 'guest_order_access',
        to: email,
        data: {
          name: body?.name || context.order.customer_name || '',
          orderId,
          accessUrl,
        },
        dedupeKey: `guest_order_access:${orderId}`,
      });

      await markProcessed(`notify:account_created:${email}`, WELCOME_WINDOW_MS / 1000);
      return NextResponse.json(ACCEPTED);
    }

    const allowed = await markProcessed(`notify:${action}:${email}`, 60);
    if (!allowed) return NextResponse.json(ACCEPTED);

    if (action === 'account_created') {
      const user = await findAuthUserByEmail(email);
      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
      const justSignedUp = createdAt > 0 && Date.now() - createdAt <= WELCOME_WINDOW_MS;

      if (justSignedUp) {
        await enqueueEmail({
          template: 'account_created',
          to: email,
          data: { name: body?.name || '', email },
          dedupeKey: `account_created:${user!.id}`,
        });
      }
      return NextResponse.json(ACCEPTED);
    }

    if (action === 'password_reset') {
      const resetUrl = await buildRecoveryLink(email);
      if (resetUrl) {
        await enqueueEmail({
          template: 'password_reset',
          to: email,
          data: { name: body?.name || '', resetUrl },
          dedupeKey: `password_reset:${email}:${Date.now()}`,
        });
      }
      return NextResponse.json(ACCEPTED);
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
