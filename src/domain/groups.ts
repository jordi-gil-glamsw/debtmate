/**
 * Group expenses: how the total is shared, the debts it creates between me and each person,
 * and the text to share a summary. Pure functions (no React, no storage) so they can be unit tested.
 */
import { signedEffect } from './balances.ts';
import { formatShortDate } from './dates.ts';
import { formatMoney } from './money.ts';
import type { DebtMovement, GroupExpense, Id, Movement } from './types.ts';

/** Stands for "me" among the people sharing an expense. */
export const ME = 'me';

type SplitFields = Pick<GroupExpense, 'amountCents' | 'paidBy' | 'participantIds' | 'includesMe' | 'split' | 'shares'>;

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

/** Everyone who took part (ME or contact ids), payer first. */
export function expensePeople(e: Pick<GroupExpense, 'paidBy' | 'participantIds' | 'includesMe'>): string[] {
  const payer = e.paidBy ?? ME;
  const people = [...new Set([...(e.includesMe ? [ME] : []), ...e.participantIds])];
  return people.sort((a, b) => (a === payer ? -1 : b === payer ? 1 : 0));
}

/** Each person's part of the expense (ME or a contact id). */
export function expenseShares(e: SplitFields): Map<string, number> {
  const people = expensePeople(e);
  if (e.split === 'exact') return new Map(people.map((p) => [p, Math.max(0, e.shares?.[p] ?? 0)]));
  const parts = splitEqually(e.amountCents, people.length);
  return new Map(people.map((p, i) => [p, parts[i]]));
}

/** With an exact split: total of the parts minus the expense total (0 = it adds up). */
export function exactDifference(e: SplitFields): number {
  let sum = 0;
  for (const v of expenseShares(e).values()) sum += v;
  return sum - e.amountCents;
}

/** Why an expense can't be saved, or null when it's fine. */
export function expenseProblem(e: SplitFields): 'amount' | 'nobody' | 'sum' | 'notMine' | null {
  if (!(e.amountCents > 0)) return 'amount';
  if (!e.includesMe && e.participantIds.length === 0) return 'nobody';
  if (e.split === 'exact' && exactDifference(e) !== 0) return 'sum';
  // Only my debts are tracked: the expense has to create at least one.
  const shares = expenseShares(e);
  const createsDebt =
    e.paidBy === null ? e.participantIds.some((p) => (shares.get(p) ?? 0) > 0) : (shares.get(ME) ?? 0) > 0;
  return createsDebt ? null : 'notMine';
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
    ...(e.wallet && e.wallet !== 'personal' ? { wallet: e.wallet } : {}),
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

/**
 * Per person, what's pending from a group (positive = they owe me): the debts from its
 * expenses minus the payments marked as settling this group.
 */
export function groupBalances(
  expenses: readonly GroupExpense[],
  payments: readonly Movement[],
  contactExists: (id: Id) => boolean,
): Map<Id, number> {
  const map = new Map<Id, number>();
  const add = (m: Movement) => map.set(m.contactId, (map.get(m.contactId) ?? 0) + signedEffect(m));
  for (const e of expenses) expenseMovements(e, contactExists).forEach(add);
  for (const p of payments) if (contactExists(p.contactId)) add(p);
  return map;
}

/** Net of a group for me (positive = I'm owed). */
export function groupNet(balances: ReadonlyMap<Id, number>): number {
  let net = 0;
  for (const v of balances.values()) net += v;
  return net;
}

// ─── Share texts ──────────────────────────────────────────────────────────────

const first = (name: string) => name.split(' ')[0];

/** Message to send the people of an expense: what it cost and each one's part. */
export function expenseShareMessage(e: GroupExpense, nameOf: (id: Id) => string | undefined): string {
  const shares = expenseShares(e);
  const who = (p: string) => (p === ME ? 'Jo' : first(nameOf(p) ?? '—'));
  const payer = e.paidBy === null ? 'ho vaig pagar jo' : `ho va pagar ${first(nameOf(e.paidBy) ?? '—')}`;
  const how = e.split === 'exact' ? ' per imports' : ' a parts iguals';
  // With exact amounts, someone can be ticked with nothing to pay: leave them out.
  const lines = [...shares].filter(([, cents]) => cents > 0 || e.split !== 'exact').map(([p, cents]) => `• ${who(p)}: ${formatMoney(cents)}`);
  const ask =
    e.paidBy === null
      ? ['', 'Quan pugueu, feu-me Bizum. Gràcies!']
      : shares.has(ME)
        ? ['', `${first(nameOf(e.paidBy) ?? '')}, ara et faig Bizum de ${formatMoney(shares.get(ME)!)}.`]
        : [];
  return [`${e.concept} · ${formatShortDate(e.date)}`, `Total ${formatMoney(e.amountCents)}, ${payer}. Repartit${how}:`, ...lines, ...ask].join('\n');
}

/** Message with how a group stands with me and its latest expenses. */
export function groupShareMessage(
  groupName: string,
  expenses: readonly GroupExpense[],
  balances: ReadonlyMap<Id, number>,
  nameOf: (id: Id) => string | undefined,
): string {
  const pending = [...balances].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const status =
    pending.length === 0
      ? ['Estem en paus, ningú deu res.']
      : pending.map(([id, v]) => {
          const name = first(nameOf(id) ?? '—');
          return v > 0 ? `• ${name} em deu ${formatMoney(v)}` : `• Jo dec ${formatMoney(-v)} a ${name}`;
        });
  const latest = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map((e) => {
      const payer = e.paidBy === null ? 'vaig pagar jo' : `va pagar ${first(nameOf(e.paidBy) ?? '—')}`;
      return `• ${formatShortDate(e.date)} ${e.concept}: ${formatMoney(e.amountCents)} (${payer})`;
    });
  return [`${groupName} · com quedem`, ...status, ...(latest.length ? ['', 'Despeses:', ...latest] : [])].join('\n');
}
