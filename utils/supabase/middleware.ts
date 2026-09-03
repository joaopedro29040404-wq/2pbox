import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Middleware is responsible only for establishing a valid Supabase session.
  // Authorization is enforced by Supabase RLS and the admin pages themselves.
  // Keeping the is_admin RPC out of middleware avoids redirect loops when the
  // database function/migration is temporarily unavailable during deployment.
  if (path.startsWith('/admin') && path !== '/admin/login' && !user) {
    const login = request.nextUrl.clone();
    login.pathname = '/admin/login';
    login.search = '';
    return NextResponse.redirect(login);
  }

  return response;
}
