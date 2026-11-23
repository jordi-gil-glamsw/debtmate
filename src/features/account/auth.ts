import { supabase } from '@/lib/supabase';
import { clearAccountData, readLocalData } from '@/store/store';
import { hasLocalChanges } from '@/sync/merge';
import { syncNow } from '@/sync/sync';

import { authRedirectUrl } from './oauth';

export { AuthCancelled } from './errors';

function client() {
  if (!supabase) throw new Error('Els comptes no estan configurats en aquesta versió.');
  return supabase;
}

/** User-facing (Catalan) message for an auth or network error. */
export function authErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const lower = message.toLowerCase();
  if (lower.includes('network') || lower.includes('fetch')) return 'No hi ha connexió. Torna-ho a provar.';
  if (lower.includes('expired') || lower.includes('invalid')) return 'El codi no és correcte o ha caducat.';
  if (lower.includes('rate limit') || lower.includes('security purposes')) {
    return 'Has demanat massa codis seguits. Espera un minut i torna-ho a provar.';
  }
  if (lower.includes('email')) return 'Revisa l’adreça de correu.';
  return message;
}

// ─── Email with a one-time code (no deep links needed, works everywhere) ──────

export async function sendEmailCode(email: string): Promise<void> {
  // The email should carry a code ({{ .Token }}); if a template still sends a link, it opens the app.
  const { error } = await client().auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true, emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await client().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw error;
}

// ─── Session end ──────────────────────────────────────────────────────────────

/** True when there are local changes that never reached the account. */
export async function hasUnsyncedChanges(): Promise<boolean> {
  await syncNow();
  return hasLocalChanges(readLocalData().sync);
}

/** Signs out and removes the account's data from this device (it stays in the cloud). */
export async function signOut(): Promise<void> {
  // 'local' ends only this device's session and works offline.
  await client().auth.signOut({ scope: 'local' });
  clearAccountData();
}

/** Deletes the account and all its data in the cloud (supabase/functions/delete-account). */
export async function deleteAccount(): Promise<void> {
  const { error } = await client().functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await signOut();
}
