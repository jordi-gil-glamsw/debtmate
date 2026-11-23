// Run with: npm test  (uses Node's built-in test runner with native TypeScript stripping)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balanceOf, balancesByContact, monthSummary, settlementProgress, totals } from './balances.ts';
import { addDays, formatDayHeading, formatMonth } from './dates.ts';
import { formatMoney, parseAmount } from './money.ts';
import type { Movement } from './types.ts';

describe('parseAmount', () => {
  it('parses Catalan and dotted formats into cents', () => {
    assert.equal(parseAmount('32,40'), 3240);
    assert.equal(parseAmount('32.40'), 3240);
    assert.equal(parseAmount('32,4 €'), 3240);
    assert.equal(parseAmount('1.250,50'), 125050);
    assert.equal(parseAmount('1.250'), 125000);
    assert.equal(parseAmount('85'), 8500);
    assert.equal(parseAmount('0,05'), 5);
  });

  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '-5', '1,234', '12,3,4', '€']) assert.equal(parseAmount(bad), null, bad);
  });
});

describe('formatMoney', () => {
  it('formats with thousands separators and signs', () => {
    assert.equal(formatMoney(14250), '142,50 €');
    assert.equal(formatMoney(14250, { sign: 'always' }), '+142,50 €');
    assert.equal(formatMoney(-12000), '−120,00 €');
    assert.equal(formatMoney(-12000, { sign: 'never', compact: true }), '120 €');
    assert.equal(formatMoney(123456789), '1.234.567,89 €');
    assert.equal(formatMoney(0, { sign: 'always' }), '0,00 €');
  });
});

const base = { concept: 'x', date: '2026-11-12', createdAt: '2026-11-12T10:00:00Z' };
const movements: Movement[] = [
  // Pau: I owe 150, paid back 30 → I owe 120
  { ...base, id: '1', contactId: 'pau', kind: 'debt', direction: 'owe', amountCents: 9000 },
  { ...base, id: '2', contactId: 'pau', kind: 'debt', direction: 'owe', amountCents: 6000 },
  { ...base, id: '3', contactId: 'pau', kind: 'payment', direction: 'out', method: 'bizum', amountCents: 3000, date: '2026-11-18' },
  // Marta: owes me 60 + 25 + 20, paid 20 → 85
  { ...base, id: '4', contactId: 'marta', kind: 'debt', direction: 'owed', amountCents: 6000, date: '2026-11-20' },
  { ...base, id: '5', contactId: 'marta', kind: 'debt', direction: 'owed', amountCents: 2500 },
  { ...base, id: '6', contactId: 'marta', kind: 'debt', direction: 'owed', amountCents: 2000, date: '2026-10-30' },
  { ...base, id: '7', contactId: 'marta', kind: 'payment', direction: 'in', method: 'bizum', amountCents: 2000 },
  // Jan: settled
  { ...base, id: '8', contactId: 'jan', kind: 'debt', direction: 'owed', amountCents: 1000 },
  { ...base, id: '9', contactId: 'jan', kind: 'payment', direction: 'in', method: 'efectiu', amountCents: 1000 },
];

describe('balances', () => {
  it('computes per-contact balances', () => {
    assert.equal(balanceOf(movements, 'pau'), -12000);
    assert.equal(balanceOf(movements, 'marta'), 8500);
    assert.equal(balanceOf(movements, 'jan'), 0);
  });

  it('computes totals', () => {
    const t = totals(balancesByContact(movements));
    assert.deepEqual(t, { owedToMe: 8500, iOwe: 12000, net: -3500, peopleOwingMe: 1, peopleIOwe: 1 });
  });

  it('computes settlement progress', () => {
    assert.deepEqual(settlementProgress(movements, 'pau'), { returned: 3000, total: 15000, ratio: 0.2 });
    assert.equal(settlementProgress(movements, 'jan'), null);
  });

  it('summarises a month', () => {
    assert.deepEqual(monthSummary(movements, 2026, 11), {
      newOwedToMe: 9500,
      newIOwe: 15000,
      receivedBack: 3000,
      paidBack: 3000,
    });
  });
});

describe('dates', () => {
  it('formats headings in Catalan', () => {
    assert.equal(formatDayHeading('2026-11-22', '2026-11-22'), 'Avui');
    assert.equal(formatDayHeading('2026-11-21', '2026-11-22'), 'Ahir');
    assert.equal(formatDayHeading('2026-11-20', '2026-11-22'), 'Divendres, 20 nov.');
    assert.equal(formatMonth(2026, 11), 'Novembre 2026');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });
});

describe('formatFieldDate', () => {
  it('uses relative words near today and adds the year only for other years', async () => {
    const { formatFieldDate } = await import('./dates.ts');
    assert.equal(formatFieldDate('2026-11-23', '2026-11-23'), 'Avui');
    assert.equal(formatFieldDate('2026-11-22', '2026-11-23'), 'Ahir');
    assert.equal(formatFieldDate('2026-11-24', '2026-11-23'), 'Demà');
    assert.equal(formatFieldDate('2026-11-10', '2026-11-23'), '10 nov.');
    assert.equal(formatFieldDate('2025-12-31', '2026-01-02'), '31 des. 2025');
  });
});
