import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { planReminders } from '@/domain/reminders';
import { readState, subscribe } from '@/store/store';

import {
  cancelAllReminders,
  getReminderPermission,
  observeReminderTaps,
  remindersSupported,
  replaceScheduledReminders,
} from './notifications';

const DEBOUNCE_MS = 800;

/** Recomputes every scheduled reminder from the current data (local edits and synced changes). */
export async function refreshReminders(): Promise<void> {
  if (!remindersSupported) return;
  const { contacts, movements, settings } = readState();
  if (!settings.reminders) return cancelAllReminders();
  if ((await getReminderPermission()) !== 'granted') return;
  await replaceScheduledReminders(planReminders(contacts, movements, new Date()));
}

/**
 * Keeps the scheduled reminders in step with the data, and opens the contact when a
 * reminder is tapped. Renders nothing.
 */
export function ReminderManager() {
  useEffect(() => {
    if (!remindersSupported) return;
    refreshReminders().catch(() => {});

    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = readState();
    const unsubscribe = subscribe(() => {
      const next = readState();
      // Only data that changes the plan; ignore sync bookkeeping and other settings.
      if (next.movements === last.movements && next.contacts === last.contacts && next.settings.reminders === last.settings.reminders) {
        return;
      }
      last = next;
      clearTimeout(timer);
      timer = setTimeout(() => refreshReminders().catch(() => {}), DEBOUNCE_MS);
    });
    const stopTaps = observeReminderTaps((url) => router.push(url as Href));

    return () => {
      clearTimeout(timer);
      unsubscribe();
      stopTaps();
    };
  }, []);

  return null;
}
