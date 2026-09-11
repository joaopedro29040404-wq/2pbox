import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/server/env';
import { exchangeCodeForTokens } from '@/lib/server/mercadopago-oauth';
import { strictDel, strictGet } from '@/lib/server/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function back(status: string, detail?: string) {
  const url = new URL('/admin/configuracoes', getSiteUrl());
  url.searchParams.set('mp', status);
  if (detail) url.searchParams.set('detalhe', detail.slice(0, 160));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const state = String(url.searchParams.get('state') || '').trim();
  const error = String(url.searchParams.get('error') || '').trim();

  if (error) return back('erro', error);
  if (!code || !state) return back('erro', 'Autorização incompleta.');

  let verifier = '';
  try {
    const stored = await strictGet(`mp-oauth:state:${state}`);
    if (!stored) return back('erro', 'Autorização expirada. Tente conectar novamente.');
    verifier = stored.split('|')[1] || '';
    await strictDel(`mp-oauth:state:${state}`);
  } catch (caught) {
    console.error('[mp-oauth] Redis indisponível no callback:', caught);
    return back('erro', 'Não foi possível validar a autorização.');
  }

  try {
    const result = await exchangeCodeForTokens(code, verifier || undefined);
    return back(result.liveMode ? 'conectado' : 'conectado-teste');
  } catch (caught) {
    console.error('[mp-oauth] troca de código falhou:', caught);
    return back('erro', caught instanceof Error ? caught.message : 'Falha ao conectar.');
  }
}
