// Native (iOS/Android) local notifications for due-date reminders. No push: nothing leaves the device.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from '@/domain/reminders';

const CHANNEL_ID = 'reminders';

export const remindersSupported = true;

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

let configured = false;

/** Foreground presentation + Android channel. Safe to call more than once. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    // Must exist before asking for permission on Android 13+.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatoris de deutes',
      description: 'Avisos el dia de la data límit',
      // eslint-disable-next-line import/namespace -- re-exported via `export *` from a .types file; tsc checks it
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

function toPermission(p: Notifications.NotificationPermissionsStatus): ReminderPermission {
  // eslint-disable-next-line import/namespace -- re-exported via `export *` from a .types file; tsc checks it
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  return toPermission(await Notifications.getPermissionsAsync());
}

/** Shows the system prompt if it can still be shown. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  await configureNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (toPermission(current) !== 'undetermined') return toPermission(current);
  return toPermission(
    await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }),
  );
}

let queue: Promise<void> = Promise.resolve();

/**
 * Replaces every scheduled reminder with `reminders` (this app schedules nothing else).
 * Calls are serialized so two quick changes can't leave duplicates.
 */
export function replaceScheduledReminders(reminders: Reminder[]): Promise<void> {
  queue = queue
    .catch(() => {})
    .then(async () => {
      await configureNotifications();
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const r of reminders) {
        await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, data: { url: r.url } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_ID },
        });
      }
    });
  return queue;
}

/** Development aid: shows `reminder` (or a sample) in a few seconds, without touching the plan. */
export async function sendTestReminder(reminder?: Pick<Reminder, 'title' | 'body' | 'url'>): Promise<void> {
  await configureNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: reminder?.title ?? 'La Laia et deu 32,40 €',
      body: reminder?.body ?? 'Avui és la data límit que vau acordar.',
      data: { url: reminder?.url ?? '/' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
}

export function cancelAllReminders(): Promise<void> {
  return replaceScheduledReminders([]);
}

/** Calls `open(url)` when the user taps a reminder, including the one that launched the app. */
export function observeReminderTaps(open: (url: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string') {
      open(url);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  };
  let active = true;
  Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (active) handle(r);
    })
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => {
    active = false;
    sub.remove();
  };
}
