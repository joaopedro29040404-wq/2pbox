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

  if (path.startsWith('/admin') && path !== '/admin/login') {
    if (!user) {
      const login = request.nextUrl.clone();
      login.pathname = '/admin/login';
      return NextResponse.redirect(login);
    }

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (isAdmin !== true) {
      const login = request.nextUrl.clone();
      login.pathname = '/admin/login';
      login.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(login);
    }
  }

  if (path === '/admin/login' && user) {
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (isAdmin === true) {
      const admin = request.nextUrl.clone();
      admin.pathname = '/admin';
      admin.search = '';
      return NextResponse.redirect(admin);
    }
  }

  return response;
}
