/**
 * Group expenses: equal split and the debts it creates between me and each person.
 * Pure functions (no React, no storage) so they can be unit tested.
 */
import { signedEffect } from './balances.ts';
import type { DebtMovement, GroupExpense, Id } from './types.ts';

/** Stands for "me" among the people sharing an expense. */
export const ME = 'me';

/**
 * Splits `total` cents into `n` parts that add up exactly. The leftover cents go to the
 * first parts, so callers put the payer first (the payer absorbs the rounding).
 */
export function splitEqually(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Each person's part of the expense (ME or a contact id). */
export function expenseShares(e: Pick<GroupExpense, 'amountCents' | 'paidBy' | 'participantIds' | 'includesMe'>): Map<string, number> {
  const payer = e.paidBy ?? ME;
  const people = [...new Set([...(e.includesMe ? [ME] : []), ...e.participantIds])];
  people.sort((a, b) => (a === payer ? -1 : b === payer ? 1 : 0));
  const parts = splitEqually(e.amountCents, people.length);
  return new Map(people.map((p, i) => [p, parts[i]]));
}

/** Why an expense can't be saved, or null when it's fine. */
export function expenseProblem(
  e: Pick<GroupExpense, 'amountCents' | 'paidBy' | 'participantIds' | 'includesMe'>,
): 'amount' | 'nobody' | 'notMine' | null {
  if (!(e.amountCents > 0)) return 'amount';
  if (!e.includesMe && e.participantIds.length === 0) return 'nobody';
  // Only my debts are tracked: the expense has to create at least one.
  if (e.paidBy === null ? e.participantIds.length === 0 : !e.includesMe) return 'notMine';
  return null;
}

/**
 * The debts between me and each person that an expense creates. Ids are derived
 * (`<expense>:<contact>`) and these movements are never stored or synced.
 * Contacts that no longer exist are skipped.
 */
export function expenseMovements(e: GroupExpense, contactExists: (id: Id) => boolean): DebtMovement[] {
  const shares = expenseShares(e);
  const debt = (contactId: Id, direction: 'owed' | 'owe', amountCents: number): DebtMovement => ({
    id: `${e.id}:${contactId}`,
    contactId,
    kind: 'debt',
    direction,
    amountCents,
    concept: e.concept,
    date: e.date,
    createdAt: e.createdAt,
    expenseId: e.id,
    ...(e.note ? { note: e.note } : {}),
  });

  if (e.paidBy === null) {
    return e.participantIds
      .filter((id) => contactExists(id) && (shares.get(id) ?? 0) > 0)
      .map((id) => debt(id, 'owed', shares.get(id)!));
  }
  const mine = shares.get(ME) ?? 0;
  if (mine > 0 && contactExists(e.paidBy)) return [debt(e.paidBy, 'owe', mine)];
  return [];
}

/** How the expense changes my balance overall (positive = others owe me more). */
export function myNetEffect(e: GroupExpense, contactExists: (id: Id) => boolean): number {
  return expenseMovements(e, contactExists).reduce((sum, m) => sum + signedEffect(m), 0);
}

/** Per person, what the group's expenses add to their balance with me (positive = they owe me). */
export function groupBalances(expenses: readonly GroupExpense[], contactExists: (id: Id) => boolean): Map<Id, number> {
  const map = new Map<Id, number>();
  for (const e of expenses) {
    for (const m of expenseMovements(e, contactExists)) {
      map.set(m.contactId, (map.get(m.contactId) ?? 0) + signedEffect(m));
    }
  }
  return map;
}
