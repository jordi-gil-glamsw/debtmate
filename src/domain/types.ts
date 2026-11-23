/**
 * Domain model.
 *
 * Amounts are always integer cents (never floats) to avoid rounding errors.
 * Balances are never stored: they are derived from the list of movements.
 *
 * Sign convention for a contact's balance:
 *   > 0  → the contact owes me ("em deu")
 *   < 0  → I owe the contact ("li dec")
 */

export type Id = string;

export type Contact = {
  id: Id;
  name: string;
  createdAt: string; // ISO timestamp
};

export type PaymentMethod = 'bizum' | 'efectiu' | 'transferencia' | 'altres';

type MovementBase = {
  id: Id;
  contactId: Id;
  amountCents: number; // always > 0; direction gives the sign
  concept: string;
  date: string; // ISO date (YYYY-MM-DD)
  note?: string;
  /** Receipt photo file name (e.g. '<uuid>.jpg'); stored on the device and in the account. */
  receipt?: string;
  createdAt: string; // ISO timestamp
  /**
   * Set on debts derived from a group expense (see domain/groups.ts). Those are computed,
   * never stored: edit or delete the expense instead.
   */
  expenseId?: Id;
  /** On a payment: it settles debts from this group's expenses (it still counts for the person). */
  groupId?: Id;
};

/** A new debt. `owed` = the contact owes me; `owe` = I owe the contact. */
export type DebtMovement = MovementBase & {
  kind: 'debt';
  direction: 'owed' | 'owe';
  dueDate?: string; // ISO date
};

/** A (partial) settlement. `in` = the contact paid me; `out` = I paid the contact. */
export type PaymentMovement = MovementBase & {
  kind: 'payment';
  direction: 'in' | 'out';
  method: PaymentMethod;
};

export type Movement = DebtMovement | PaymentMovement;

/** A saved set of people who often share expenses (a group of friends, a trip). I'm always in it. */
export type Group = {
  id: Id;
  name: string;
  memberIds: Id[]; // contacts
  createdAt: string;
};

/**
 * A shared expense in a group, split in equal parts among the people who took part.
 * Only the debts involving me are tracked: if I paid, each participant owes me their part;
 * if someone else paid and I took part, I owe them my part.
 */
export type GroupExpense = {
  id: Id;
  groupId: Id;
  concept: string;
  amountCents: number; // total, > 0
  date: string; // ISO date
  /** Contact who paid; null = I paid. */
  paidBy: Id | null;
  /** Contacts who took part (excluding me). */
  participantIds: Id[];
  /** Whether I took part (had my share). */
  includesMe: boolean;
  /** How the total is shared: equal parts (default) or an exact amount per person. */
  split?: 'equal' | 'exact';
  /** With split 'exact': cents per person, keyed by contact id or 'me'. */
  shares?: Record<string, number>;
  note?: string;
  createdAt: string;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bizum: 'Bizum',
  efectiu: 'Efectiu',
  transferencia: 'Transferència',
  altres: 'Altres',
};
