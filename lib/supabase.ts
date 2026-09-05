import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// The Supabase environment variables are required by the application.
// Keeping the exported client non-null gives TypeScript a stable client type
// throughout the app while preserving the existing runtime configuration.
export const supabase = (
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null
) as NonNullable<ReturnType<typeof createBrowserClient>>;
