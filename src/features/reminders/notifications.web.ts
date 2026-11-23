// Web: no scheduled local notifications (a closed tab can't fire them). Everything is a no-op.
import type { Reminder } from '@/domain/reminders';

export const remindersSupported = false;

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

export async function configureNotifications(): Promise<void> {}

export async function getReminderPermission(): Promise<ReminderPermission> {
  return 'denied';
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  return 'denied';
}

export async function replaceScheduledReminders(_reminders: Reminder[]): Promise<void> {}

export async function sendTestReminder(_reminder?: Pick<Reminder, 'title' | 'body' | 'url'>): Promise<void> {}

export async function cancelAllReminders(): Promise<void> {}

export function observeReminderTaps(_open: (url: string) => void): () => void {
  return () => {};
}
