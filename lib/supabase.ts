import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const client = (
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null
) as NonNullable<ReturnType<typeof createBrowserClient>>;

if (client) {
  const auth = client.auth as any;
  const originalSignInWithOtp = auth.signInWithOtp.bind(auth);
  const originalSignUp = auth.signUp.bind(auth);

  auth.signInWithOtp = async (credentials: any) => {
    const isGuestCheckout =
      typeof window !== 'undefined' &&
      Boolean(credentials?.email) &&
      credentials?.options?.shouldCreateUser === true;

    if (!isGuestCheckout) return originalSignInWithOtp(credentials);

    let orderId = '';
    let name = '';
    try {
      orderId = localStorage.getItem('2p_last_order_id') || '';
      name = localStorage.getItem('2p_checkout_name') || '';
    } catch {}

    if (!orderId) return originalSignInWithOtp(credentials);

    try {
      const response = await fetch('/api/conta/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'guest_order_access',
          email: String(credentials.email || '').trim().toLowerCase(),
          name,
          orderId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        return {
          data: { user: null, session: null, messageId: null },
          error: { message: payload?.error || 'Não foi possível enviar o acesso ao pedido.' },
        };
      }

      return { data: { user: null, session: null, messageId: null }, error: null };
    } catch (error) {
      return {
        data: { user: null, session: null, messageId: null },
        error: { message: error instanceof Error ? error.message : 'Não foi possível enviar o acesso ao pedido.' },
      };
    }
  };

  auth.signUp = async (credentials: any) => {
    const email = String(credentials?.email || '').trim().toLowerCase();
    const password = String(credentials?.password || '');
    const data = credentials?.options?.data || {};

    if (typeof window === 'undefined' || !email || !password) {
      return originalSignUp(credentials);
    }

    try {
      const response = await fetch('/api/conta/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'account_signup',
          email,
          password,
          name: String(data.full_name || '').trim(),
          phone: String(data.phone || '').trim(),
          cpf: String(data.cpf || '').trim(),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          data: { user: null, session: null },
          error: { message: payload?.error || 'Não foi possível criar a conta.' },
        };
      }

      return { data: { user: null, session: null }, error: null };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: { message: error instanceof Error ? error.message : 'Não foi possível criar a conta.' },
      };
    }
  };
}

export const supabase = client;
