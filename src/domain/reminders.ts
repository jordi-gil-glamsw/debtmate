import { balancesByContact } from './balances.ts';
import { formatMoney } from './money.ts';
import type { Contact, Id, Movement } from './types.ts';

/** Reminders fire at this local hour on the due date. */
export const REMINDER_HOUR = 10;
/** iOS keeps at most 64 pending local notifications per app; stay below it. */
export const MAX_REMINDERS = 60;

export type Reminder = {
  contactId: Id;
  dueDate: string; // ISO date
  fireAt: Date;
  title: string;
  body: string;
  url: string;
};

/**
 * Upcoming due dates for a contact that still matter: only debts in the direction of the
 * current balance (if Laia owes me, my old debts to her are already compensated), and only
 * while there is something outstanding. Sorted, without duplicates.
 */
export function upcomingDueDates(movements: Movement[], contactId: Id, balance: number, today: string): string[] {
  if (balance === 0) return [];
  const wanted = balance > 0 ? 'owed' : 'owe';
  const dates = new Set<string>();
  for (const m of movements) {
    if (m.contactId === contactId && m.kind === 'debt' && m.direction === wanted && m.dueDate && m.dueDate >= today) {
      dates.add(m.dueDate);
    }
  }
  return [...dates].sort();
}

function atReminderHour(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, REMINDER_HOUR, 0, 0, 0);
}

function localISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Notifications to schedule, soonest first. Amounts are the outstanding balance right now. */
export function planReminders(contacts: Contact[], movements: Movement[], now: Date): Reminder[] {
  const today = localISODate(now);
  const balances = balancesByContact(movements);
  const reminders: Reminder[] = [];

  for (const contact of contacts) {
    const balance = balances.get(contact.id) ?? 0;
    const amount = formatMoney(Math.abs(balance), { sign: 'never' });
    for (const dueDate of upcomingDueDates(movements, contact.id, balance, today)) {
      const fireAt = atReminderHour(dueDate);
      if (fireAt.getTime() <= now.getTime()) continue; // due today but 10:00 has passed
      reminders.push({
        contactId: contact.id,
        dueDate,
        fireAt,
        title: balance > 0 ? `${contact.name} et deu ${amount}` : `Deus ${amount} a ${contact.name}`,
        body: 'Avui és la data límit que vau acordar.',
        url: `/persona/${contact.id}`,
      });
    }
  }

  return reminders.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_REMINDERS);
}
