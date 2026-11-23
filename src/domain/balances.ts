import type { Id, Movement } from './types';

/** How a movement changes the contact's balance (positive = they owe me more). */
export function signedEffect(m: Movement): number {
  if (m.kind === 'debt') return m.direction === 'owed' ? m.amountCents : -m.amountCents;
  return m.direction === 'in' ? -m.amountCents : m.amountCents;
}

export function balanceOf(movements: readonly Movement[], contactId: Id): number {
  let total = 0;
  for (const m of movements) if (m.contactId === contactId) total += signedEffect(m);
  return total;
}

export function balancesByContact(movements: readonly Movement[]): Map<Id, number> {
  const map = new Map<Id, number>();
  for (const m of movements) map.set(m.contactId, (map.get(m.contactId) ?? 0) + signedEffect(m));
  return map;
}

export type Totals = {
  owedToMe: number; // sum of positive balances
  iOwe: number; // sum of |negative balances|
  net: number;
  peopleOwingMe: number;
  peopleIOwe: number;
};

export function totals(balances: ReadonlyMap<Id, number>): Totals {
  const t: Totals = { owedToMe: 0, iOwe: 0, net: 0, peopleOwingMe: 0, peopleIOwe: 0 };
  for (const b of balances.values()) {
    if (b > 0) {
      t.owedToMe += b;
      t.peopleOwingMe += 1;
    } else if (b < 0) {
      t.iOwe += -b;
      t.peopleIOwe += 1;
    }
  }
  t.net = t.owedToMe - t.iOwe;
  return t;
}

export type Progress = { returned: number; total: number; ratio: number };

/**
 * How much of the current outstanding debt has already been returned, counting the
 * payments that went in the settling direction. Null when the contact is settled.
 */
export function settlementProgress(movements: readonly Movement[], contactId: Id): Progress | null {
  const balance = balanceOf(movements, contactId);
  if (balance === 0) return null;
  const settlingDirection = balance > 0 ? 'in' : 'out';
  let returned = 0;
  for (const m of movements) {
    if (m.contactId === contactId && m.kind === 'payment' && m.direction === settlingDirection) {
      returned += m.amountCents;
    }
  }
  const total = Math.abs(balance) + returned;
  return { returned, total, ratio: total === 0 ? 0 : returned / total };
}

export type MonthSummary = {
  newOwedToMe: number;
  newIOwe: number;
  receivedBack: number;
  paidBack: number;
};

/** Totals for movements dated in the given month (month is 1-12). */
export function monthSummary(movements: readonly Movement[], year: number, month: number): MonthSummary {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const s: MonthSummary = { newOwedToMe: 0, newIOwe: 0, receivedBack: 0, paidBack: 0 };
  for (const m of movements) {
    if (!m.date.startsWith(prefix)) continue;
    if (m.kind === 'debt') {
      if (m.direction === 'owed') s.newOwedToMe += m.amountCents;
      else s.newIOwe += m.amountCents;
    } else if (m.direction === 'in') s.receivedBack += m.amountCents;
    else s.paidBack += m.amountCents;
  }
  return s;
}

/** Newest first: by date, then by creation time. */
export function sortNewestFirst<T extends Movement>(movements: readonly T[]): T[] {
  return [...movements].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
  );
}
