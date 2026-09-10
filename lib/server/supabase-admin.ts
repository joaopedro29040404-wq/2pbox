import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseSecretKey, getSupabaseUrl } from './env';
import { fetchJson, type JsonInit } from './http';

let cached: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': '2pbox-server' } },
  });
  return cached;
}

export function requireAdminSupabase(): SupabaseClient {
  const client = getAdminSupabase();
  if (!client) throw new Error('Credencial backend do Supabase não configurada.');
  return client;
}

export async function supabaseRest(path: string, init: JsonInit = {}) {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  if (!url || !key) throw new Error('Credencial backend do Supabase não configurada.');

  const { ok, status, data } = await fetchJson(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!ok) {
    const detail = data?.message || data?.hint || data?.details || `HTTP ${status}`;
    throw new Error(`Supabase ${path}: ${String(detail)}`);
  }
  return data;
}

export function supabaseRpc(name: string, body: Record<string, unknown>) {
  return supabaseRest(`rpc/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(body) });
}

export type AuthUserRecord = { id: string; email: string; created_at: string };

export async function findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  const normalized = String(email || '').trim().toLowerCase();
  if (!url || !key || !normalized) return null;

  const query = new URLSearchParams({ page: '1', per_page: '10', filter: normalized });
  const { ok, data } = await fetchJson(`${url}/auth/v1/admin/users?${query.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).catch(() => ({ ok: false, data: null }) as { ok: boolean; data: any });

  if (!ok) return null;
  const users = Array.isArray(data?.users) ? data.users : [];
  return users.find((user: any) => String(user?.email || '').trim().toLowerCase() === normalized) || null;
}
