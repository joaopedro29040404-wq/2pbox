import { createHash, randomBytes } from 'node:crypto';
import {
  getMercadoPagoAppId,
  getMercadoPagoClientSecret,
  getMercadoPagoOAuthRedirectUri,
  getPlatformCommissionPercent,
} from './env';
import { fetchJson } from './http';
import { supabaseRest } from './supabase-admin';

const AUTH_BASE = 'https://auth.mercadopago.com.br/authorization';
const TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

export type Connection = {
  id: string;
  mp_user_id: string | null;
  nickname: string | null;
  email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  public_key: string | null;
  scope: string | null;
  live_mode: boolean;
  expires_at: string | null;
  connected_at: string;
  updated_at: string;
};

export type ConnectionStatus = {
  connected: boolean;
  mpUserId: string | null;
  nickname: string | null;
  email: string | null;
  liveMode: boolean;
  publicKey: string | null;
  expiresAt: string | null;
  connectedAt: string | null;
  commissionPercent: number;
};

export function generatePkce() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizationUrl(state: string, codeChallenge?: string) {
  const params = new URLSearchParams({
    client_id: getMercadoPagoAppId(),
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: getMercadoPagoOAuthRedirectUri(),
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${AUTH_BASE}?${params.toString()}`;
}

export function generateState() {
  return randomBytes(24).toString('base64url');
}

async function readConnection(): Promise<Connection | null> {
  const rows = await supabaseRest('store_mercadopago?select=*&limit=1').catch(() => null);
  return Array.isArray(rows) && rows[0] ? (rows[0] as Connection) : null;
}

async function persist(payload: Record<string, unknown>, existing: Connection | null) {
  const body = JSON.stringify({ ...payload, updated_at: new Date().toISOString() });
  if (existing) {
    await supabaseRest(`store_mercadopago?id=eq.${existing.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body,
    });
    return;
  }
  await supabaseRest('store_mercadopago', { method: 'POST', headers: { Prefer: 'return=minimal' }, body });
}

function expiresAtFrom(expiresIn: unknown) {
  const seconds = Number(expiresIn || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function exchangeCodeForTokens(code: string, codeVerifier?: string) {
  const { ok, data } = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: getMercadoPagoAppId(),
      client_secret: getMercadoPagoClientSecret(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: getMercadoPagoOAuthRedirectUri(),
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    }),
  });

  if (!ok || !data?.access_token) {
    throw new Error(`Mercado Pago recusou a autorização: ${data?.message || data?.error || 'resposta inválida'}`);
  }

  const existing = await readConnection();
  await persist(
    {
      mp_user_id: data.user_id ? String(data.user_id) : null,
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      public_key: data.public_key || null,
      scope: data.scope || null,
      live_mode: Boolean(data.live_mode),
      expires_at: expiresAtFrom(data.expires_in),
      connected_at: new Date().toISOString(),
    },
    existing,
  );

  return { mpUserId: data.user_id ? String(data.user_id) : null, liveMode: Boolean(data.live_mode) };
}

async function refresh(connection: Connection) {
  if (!connection.refresh_token) return null;

  const { ok, data } = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: getMercadoPagoAppId(),
      client_secret: getMercadoPagoClientSecret(),
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
    }),
  });

  if (!ok || !data?.access_token) {
    console.error('[mp-oauth] refresh falhou:', data?.message || data?.error);
    return null;
  }

  await persist(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token || connection.refresh_token,
      public_key: data.public_key || connection.public_key,
      scope: data.scope || connection.scope,
      live_mode: Boolean(data.live_mode),
      expires_at: expiresAtFrom(data.expires_in),
    },
    connection,
  );

  return String(data.access_token);
}

export async function getSellerUserId(): Promise<string | null> {
  const connection = await readConnection();
  return connection?.mp_user_id ?? null;
}

export async function getSellerAccessToken(): Promise<string | null> {
  const connection = await readConnection();
  if (!connection?.access_token) return null;

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (expiresAt && expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    const renewed = await refresh(connection);
    if (renewed) return renewed;
  }

  return connection.access_token;
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const connection = await readConnection();
  return {
    connected: Boolean(connection?.access_token),
    mpUserId: connection?.mp_user_id ?? null,
    nickname: connection?.nickname ?? null,
    email: connection?.email ?? null,
    liveMode: Boolean(connection?.live_mode),
    publicKey: connection?.public_key ?? null,
    expiresAt: connection?.expires_at ?? null,
    connectedAt: connection?.connected_at ?? null,
    commissionPercent: getPlatformCommissionPercent(),
  };
}

export async function disconnect() {
  const connection = await readConnection();
  if (!connection) return;
  await supabaseRest(`store_mercadopago?id=eq.${connection.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}

export function calculatePlatformFee(amount: number) {
  const gross = Number(amount || 0);
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  return Math.round(gross * (getPlatformCommissionPercent() / 100) * 100) / 100;
}
