import { signedEffect } from './balances';
import type { Contact, Movement } from './types';
import { PAYMENT_METHOD_LABELS, WALLET_LABELS } from './types';

function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Semicolon-separated CSV (opens correctly in Excel with Catalan/Spanish locale).
 * withWallet: add a "Cartera" column (personal / family card).
 */
export function movementsToCsv(
  contacts: readonly Contact[],
  movements: readonly Movement[],
  { withWallet = false }: { withWallet?: boolean } = {},
): string {
  const names = new Map(contacts.map((c) => [c.id, c.name]));
  const header = ['Data', 'Persona', 'Tipus', 'Concepte', 'Mètode', 'Import', 'Efecte sobre el saldo', ...(withWallet ? ['Cartera'] : [])];
  const rows = movements.map((m) => {
    const type =
      m.kind === 'debt'
        ? m.direction === 'owed' ? 'Em deu' : 'Li dec'
        : m.direction === 'in' ? 'Pagament rebut' : 'Pagament fet';
    const method = m.kind === 'payment' ? PAYMENT_METHOD_LABELS[m.method] : '';
    return [
      m.date,
      names.get(m.contactId) ?? '',
      type,
      m.concept,
      method,
      (m.amountCents / 100).toFixed(2).replace('.', ','),
      (signedEffect(m) / 100).toFixed(2).replace('.', ','),
      ...(withWallet ? [WALLET_LABELS[m.wallet ?? 'personal']] : []),
    ].map(csvCell).join(';');
  });
  return [header.join(';'), ...rows].join('\n');
}
