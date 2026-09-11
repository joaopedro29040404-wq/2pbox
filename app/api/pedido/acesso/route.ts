import { NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/masks';
import { clientIp, issueAccessCode, ORDER_ACCESS_COOKIE, signAccessToken, verifyAccessCode } from '@/lib/server/order-access';
import { enqueueEmail } from '@/lib/server/notifications';
import { queryOrders } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACCEPTED = { ok: true } as const;

async function hasOrders(email: string) {
  const params = new URLSearchParams({ limit: '1' });
  params.set('customer_email', `ilike.${email}`);
  const rows = await queryOrders(params).catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const step = String(body?.step || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!isValidEmail(email)) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });

    if (step === 'request') {
      let outcome;
      try {
        outcome = await issueAccessCode(email, clientIp(request));
      } catch (error) {
        console.error('[pedido/acesso] Redis indisponível:', error);
        return NextResponse.json(
          { error: 'A verificação está temporariamente indisponível. Tente novamente em instantes.' },
          { status: 503 },
        );
      }

      if (!outcome.ok) {
        return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }, { status: 429 });
      }

      if (await hasOrders(email)) {
        await enqueueEmail({
          template: 'order_access_code',
          to: email,
          data: { code: outcome.code },
          dedupeKey: `order_access_code:${email}:${Date.now()}`,
        });
      }

      return NextResponse.json(ACCEPTED);
    }

    if (step === 'verify') {
      let result;
      try {
        result = await verifyAccessCode(email, String(body?.code || ''));
      } catch (error) {
        console.error('[pedido/acesso] Redis indisponível:', error);
        return NextResponse.json(
          { error: 'A verificação está temporariamente indisponível. Tente novamente em instantes.' },
          { status: 503 },
        );
      }

      if (result === 'too_many_attempts') {
        return NextResponse.json({ error: 'Muitas tentativas. Solicite um novo código.' }, { status: 429 });
      }
      if (result === 'expired') {
        return NextResponse.json({ error: 'O código expirou. Solicite um novo.' }, { status: 400 });
      }
      if (result !== 'ok') {
        return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
      }

      const { token, maxAge } = signAccessToken(email);
      const response = NextResponse.json({ ok: true, email });
      response.cookies.set(ORDER_ACCESS_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge,
      });
      return response;
    }

    return NextResponse.json({ error: 'Etapa inválida.' }, { status: 400 });
  } catch (error) {
    console.error('[pedido/acesso] erro:', error);
    return NextResponse.json({ error: 'Não foi possível processar a verificação.' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json(ACCEPTED);
  response.cookies.set(ORDER_ACCESS_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
