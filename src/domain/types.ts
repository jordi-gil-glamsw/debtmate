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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bizum: 'Bizum',
  efectiu: 'Efectiu',
  transferencia: 'Transferència',
  altres: 'Altres',
};
