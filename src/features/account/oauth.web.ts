// Web: Google uses a full-page redirect; the Supabase web client reads the session from
// the URL when the app loads again. Native Sign in with Apple is iOS only.
import { supabase } from '@/lib/supabase';

export async function isAppleSignInAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithApple(): Promise<void> {
  throw new Error('Sign in with Apple només és disponible a iOS.');
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Els comptes no estan configurats en aquesta versió.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}
