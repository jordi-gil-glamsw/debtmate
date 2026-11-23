import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/features/account/session';
import { completeOnboarding, readLocalData, subscribe } from '@/store/store';

import { hasLocalChanges } from './merge';
import { cleanupReceipts, syncNow } from './sync';

const DEBOUNCE_MS = 1500;

/**
 * While signed in, keeps the device and the account in sync:
 * on sign-in, when the app comes back to the foreground, and shortly after each local change.
 */
export function SyncManager() {
  const session = useSession();
  const userId = session?.user.id;

  // Photos picked in a form that was then cancelled leave a file behind: tidy up on launch.
  useEffect(() => {
    cleanupReceipts();
  }, []);

  useEffect(() => {
    if (!userId) return;
    completeOnboarding(); // signing in from the welcome screen (or a web OAuth redirect) skips it
    syncNow();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribe(() => {
      if (!hasLocalChanges(readLocalData().sync)) return;
      clearTimeout(timer);
      timer = setTimeout(syncNow, DEBOUNCE_MS);
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') syncNow();
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
    };
  }, [userId]);

  return null;
}
