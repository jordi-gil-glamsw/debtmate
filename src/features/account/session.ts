import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

/** Whether this build has Supabase keys. Without them, account features are hidden. */
export const cloudEnabled = supabase !== null;

/** undefined = still restoring the stored session; null = signed out. */
type SessionState = Session | null | undefined;

let current: SessionState = supabase ? undefined : null;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  current = next;
  listeners.forEach((l) => l());
}

if (supabase) {
  // Fires INITIAL_SESSION on startup and then every sign-in, sign-out and token refresh.
  // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock.
  supabase.auth.onAuthStateChange((_event, session) => set(session));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/** Display name: Apple/Google full name if known, otherwise the email. */
export function accountName(session: Session): string {
  const meta = session.user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name || meta?.name || session.user.email || 'El meu compte';
}
