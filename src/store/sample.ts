import { addDays, todayISO } from '@/domain/dates';
import type { Contact, Group, GroupExpense, Movement } from '@/domain/types';

/** Demo data matching the design mockups, with dates relative to today. */
export function buildSampleData(newId: () => string): {
  contacts: Contact[];
  movements: Movement[];
  groups: Group[];
  expenses: GroupExpense[];
} {
  const today = todayISO();
  const now = new Date().toISOString();
  const day = (offset: number) => addDays(today, offset);

  const names = ['Laia Font', 'Pau Serra', 'Marta Puig', 'Oriol Roca', 'Mama', 'Jan Navarro', 'Núria Vila'];
  const contacts: Contact[] = names.map((name) => ({ id: newId(), name, createdAt: now }));
  const [laia, pau, marta, oriol, mama, jan, nuria] = contacts.map((c) => c.id);

  const debt = (contactId: string, direction: 'owed' | 'owe', euros: number, concept: string, offset: number, dueOffset?: number): Movement => ({
    id: newId(), contactId, kind: 'debt', direction, amountCents: Math.round(euros * 100), concept,
    date: day(offset), dueDate: dueOffset === undefined ? undefined : day(dueOffset), createdAt: now,
  });
  const payment = (contactId: string, direction: 'in' | 'out', euros: number, concept: string, offset: number): Movement => ({
    id: newId(), contactId, kind: 'payment', direction, amountCents: Math.round(euros * 100), concept,
    method: 'bizum', date: day(offset), createdAt: now,
  });

  const movements: Movement[] = [
    debt(laia, 'owed', 150, 'Entrades concert', -14),
    debt(pau, 'owe', 90, 'Lloguer furgoneta', -10, 23),
    debt(pau, 'owe', 60, 'Gasolina viatge', -10),
    payment(pau, 'out', 30, 'Bizum enviat', -4),
    debt(marta, 'owed', 20, 'Taxi aeroport', -20),
    debt(marta, 'owed', 25, 'Entrades cinema', -13),
    payment(marta, 'in', 20, 'Bizum rebut', -7),
    debt(marta, 'owed', 60, 'Sopar Can Ramon', -2),
    debt(oriol, 'owed', 125, 'Regal aniversari Anna', -30),
    payment(oriol, 'in', 40, 'Pagament parcial', -21),
    debt(mama, 'owe', 57.5, 'Compra súper', -19),
    debt(jan, 'owed', 32.4, 'Pizza dijous', -16),
    payment(jan, 'in', 32.4, 'Bizum rebut', -12),
    debt(nuria, 'owe', 18, 'Llibre', -40),
    payment(nuria, 'out', 18, 'Efectiu', -25),
  ];
  const colla: Group = { id: newId(), name: 'Colla del dinar', memberIds: [laia, pau, marta, oriol], createdAt: now };
  const expense = (concept: string, euros: number, paidBy: string | null, participantIds: string[], offset: number): GroupExpense => ({
    id: newId(), groupId: colla.id, concept, amountCents: Math.round(euros * 100), date: day(offset), paidBy,
    participantIds, includesMe: true, createdAt: now,
  });
  const expenses: GroupExpense[] = [
    expense('Dinar Can Ramon', 96, null, [laia, pau, marta], -6),
    expense('Calçotada', 125, pau, [laia, pau, marta, oriol], -3),
  ];

  return { contacts, movements, groups: [colla], expenses };
}
