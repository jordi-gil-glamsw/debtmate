// Web Supabase client. Uses the browser's localStorage and reads the session from the
// URL after an OAuth redirect. During static rendering (no window) nothing is persisted.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const isBrowser = typeof window !== 'undefined';

/** null when the project has no Supabase keys: the app then works local-only. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          autoRefreshToken: isBrowser,
          persistSession: isBrowser,
          detectSessionInUrl: isBrowser,
        },
      })
    : null;
