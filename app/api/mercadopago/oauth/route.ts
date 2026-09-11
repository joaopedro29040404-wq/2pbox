import { NextResponse } from 'next/server';
import { isMercadoPagoOAuthConfigured } from '@/lib/server/env';
import { requireAdminUser } from '@/lib/server/auth';
import { buildAuthorizationUrl, disconnect, generatePkce, generateState, getConnectionStatus } from '@/lib/server/mercadopago-oauth';
import { strictSet } from '@/lib/server/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_TTL_SECONDS = 10 * 60;

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });

  const status = await getConnectionStatus();
  return NextResponse.json({ ...status, oauthConfigured: isMercadoPagoOAuthConfigured() });
}

export async function POST() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });

  if (!isMercadoPagoOAuthConfigured()) {
    return NextResponse.json({ error: 'MERCADOPAGO_APP_ID e MERCADOPAGO_CLIENT_SECRET não configurados.' }, { status: 500 });
  }

  const state = generateState();
  const { verifier, challenge } = generatePkce();
  try {
    // State e verifier vivem no Redis: sem eles o callback nao pode ser
    // validado e a autorizacao ficaria vulneravel a CSRF.
    await strictSet(`mp-oauth:state:${state}`, `${admin.id}|${verifier}`, STATE_TTL_SECONDS);
  } catch (error) {
    console.error('[mp-oauth] Redis indisponível:', error);
    return NextResponse.json({ error: 'A conexão está temporariamente indisponível. Tente novamente.' }, { status: 503 });
  }

  return NextResponse.json({ url: buildAuthorizationUrl(state, challenge) });
}

export async function DELETE() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });

  await disconnect();
  return NextResponse.json({ ok: true });
}
