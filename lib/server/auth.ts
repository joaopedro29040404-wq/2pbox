import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdminSupabase } from './supabase-admin';

export type SessionUser = { id: string; email: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const store = await cookies();
  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll() {},
    },
  });

  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireAdminUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const admin = getAdminSupabase();
  if (!admin) return null;

  const { data, error } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !data) return null;
  return user;
}
