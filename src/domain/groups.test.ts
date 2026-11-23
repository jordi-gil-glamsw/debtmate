// Run with: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  exactDifference,
  expenseMovements,
  expenseProblem,
  expenseShareMessage,
  expenseShares,
  groupBalances,
  groupNet,
  groupShareMessage,
  ME,
  myNetEffect,
  splitEqually,
} from './groups.ts';
import type { GroupExpense, Movement } from './types.ts';

const exists = () => true;

const dinner = (over: Partial<GroupExpense> = {}): GroupExpense => ({
  id: 'e1',
  groupId: 'g1',
  concept: 'Dinar',
  amountCents: 10000,
  date: '2026-11-20',
  paidBy: null,
  participantIds: ['anna', 'pau', 'laia'],
  includesMe: true,
  createdAt: '2026-11-20T15:00:00.000Z',
  ...over,
});

describe('splitEqually', () => {
  it('adds up exactly, leftover cents first', () => {
    assert.deepEqual(splitEqually(10000, 3), [3334, 3333, 3333]);
    assert.deepEqual(splitEqually(10002, 4), [2501, 2501, 2500, 2500]);
    assert.deepEqual(splitEqually(9000, 3), [3000, 3000, 3000]);
    assert.deepEqual(splitEqually(100, 0), []);
  });
});

describe('expenseShares', () => {
  it('gives the rounding cent to the payer', () => {
    const shares = expenseShares(dinner({ amountCents: 10000, participantIds: ['anna', 'pau'], paidBy: 'pau' }));
    assert.equal(shares.get('pau'), 3334);
    assert.equal(shares.get(ME), 3333);
    assert.equal(shares.get('anna'), 3333);
  });

  it('ignores a participant listed twice', () => {
    assert.equal(expenseShares(dinner({ participantIds: ['anna', 'anna'] })).size, 2);
  });
});

describe('expenseMovements', () => {
  it('when I pay, every participant owes me their part', () => {
    const ms = expenseMovements(dinner(), exists);
    assert.deepEqual(
      ms.map((m) => [m.contactId, m.direction, m.amountCents]),
      [
        ['anna', 'owed', 2500],
        ['pau', 'owed', 2500],
        ['laia', 'owed', 2500],
      ],
    );
    assert.equal(ms[0].expenseId, 'e1');
    assert.equal(ms[0].id, 'e1:anna');
  });

  it('when I pay but did not take part, the others share it all', () => {
    const ms = expenseMovements(dinner({ includesMe: false, participantIds: ['anna', 'pau'] }), exists);
    assert.deepEqual(ms.map((m) => m.amountCents), [5000, 5000]);
  });

  it('when a friend pays, I owe that friend only my part', () => {
    const ms = expenseMovements(dinner({ paidBy: 'pau' }), exists);
    assert.deepEqual(ms.map((m) => [m.contactId, m.direction, m.amountCents]), [['pau', 'owe', 2500]]);
  });

  it('when a friend pays for something I was not part of, nothing involves me', () => {
    assert.deepEqual(expenseMovements(dinner({ paidBy: 'pau', includesMe: false }), exists), []);
  });

  it('skips people that were deleted, without changing the other parts', () => {
    const ms = expenseMovements(dinner(), (id) => id !== 'laia');
    assert.deepEqual(ms.map((m) => [m.contactId, m.amountCents]), [
      ['anna', 2500],
      ['pau', 2500],
    ]);
  });

  it('carries the note', () => {
    assert.equal(expenseMovements(dinner({ note: 'Can Ramon' }), exists)[0].note, 'Can Ramon');
  });
});

describe('balances', () => {
  it('nets several expenses per person', () => {
    const expenses = [dinner(), dinner({ id: 'e2', amountCents: 3000, paidBy: 'pau', participantIds: ['pau', 'anna'] })];
    const b = groupBalances(expenses, [], exists);
    assert.equal(b.get('anna'), 2500);
    assert.equal(b.get('pau'), 2500 - 1000);
    assert.equal(myNetEffect(expenses[0], exists), 7500);
    assert.equal(myNetEffect(expenses[1], exists), -1000);
  });
});

describe('expenseProblem', () => {
  it('accepts expenses that involve me', () => {
    assert.equal(expenseProblem(dinner()), null);
    assert.equal(expenseProblem(dinner({ paidBy: 'pau' })), null);
  });

  it('rejects the rest', () => {
    assert.equal(expenseProblem(dinner({ amountCents: 0 })), 'amount');
    assert.equal(expenseProblem(dinner({ participantIds: [], includesMe: false })), 'nobody');
    assert.equal(expenseProblem(dinner({ participantIds: [] })), 'notMine');
    assert.equal(expenseProblem(dinner({ paidBy: 'pau', includesMe: false })), 'notMine');
  });
});

describe('exact split', () => {
  const exact = (shares: Record<string, number>, over: Partial<GroupExpense> = {}) =>
    dinner({ split: 'exact', shares, participantIds: ['anna', 'pau'], amountCents: 5000, ...over });

  it('uses the given amount per person', () => {
    const ms = expenseMovements(exact({ me: 1000, anna: 3000, pau: 1000 }), exists);
    assert.deepEqual(ms.map((m) => [m.contactId, m.amountCents]), [
      ['anna', 3000],
      ['pau', 1000],
    ]);
  });

  it('ignores parts of people who are not ticked', () => {
    const e = exact({ me: 2000, anna: 3000, pau: 999 }, { participantIds: ['anna'] });
    assert.equal(expenseShares(e).has('pau'), false);
    assert.equal(exactDifference(e), 0);
  });

  it('must add up to the total', () => {
    assert.equal(exactDifference(exact({ me: 1000, anna: 3000, pau: 500 })), -500);
    assert.equal(expenseProblem(exact({ me: 1000, anna: 3000, pau: 500 })), 'sum');
    assert.equal(expenseProblem(exact({ me: 1000, anna: 3000, pau: 1000 })), null);
  });

  it('rejects an exact split where nobody owes me anything', () => {
    assert.equal(expenseProblem(exact({ me: 5000, anna: 0, pau: 0 })), 'notMine');
    assert.equal(expenseProblem(exact({ me: 0, anna: 2500, pau: 2500 }, { paidBy: 'pau' })), 'notMine');
  });
});

describe('group payments', () => {
  const payment = (contactId: string, direction: 'in' | 'out', amountCents: number): Movement => ({
    id: `p-${contactId}`,
    contactId,
    kind: 'payment',
    direction,
    method: 'bizum',
    amountCents,
    concept: '',
    date: '2026-11-22',
    createdAt: '2026-11-22T10:00:00.000Z',
    groupId: 'g1',
  });

  it('settle what the group expenses created', () => {
    const b = groupBalances([dinner()], [payment('anna', 'in', 2500), payment('pau', 'in', 1000)], exists);
    assert.equal(b.get('anna'), 0);
    assert.equal(b.get('pau'), 1500);
    assert.equal(groupNet(b), 1500 + 2500);
  });

  it('settles what I owe too', () => {
    const b = groupBalances([dinner({ paidBy: 'pau' })], [payment('pau', 'out', 2500)], exists);
    assert.equal(b.get('pau'), 0);
  });
});

describe('share messages', () => {
  const names: Record<string, string> = { anna: 'Anna Puig', pau: 'Pau Serra', laia: 'Laia Font' };
  const nameOf = (id: string) => names[id];

  it('lists each part and asks for the money when I paid', () => {
    const text = expenseShareMessage(dinner(), nameOf);
    assert.match(text, /^Dinar · 20 nov\./);
    assert.match(text, /Total 100,00 €, ho vaig pagar jo\. Repartit a parts iguals:/);
    assert.match(text, /• Anna: 25,00 €/);
    assert.match(text, /• Jo: 25,00 €/);
    assert.match(text, /feu-me Bizum/);
  });

  it('leaves out zero parts of an exact split', () => {
    const e = dinner({ amountCents: 6000, split: 'exact', shares: { me: 1500, anna: 4500, pau: 0, laia: 0 } });
    const text = expenseShareMessage(e, nameOf);
    assert.match(text, /Repartit per imports:\n• Jo: 15,00 €\n• Anna: 45,00 €\n\n/);
    assert.doesNotMatch(text, /Pau/);
  });

  it('says what I owe when someone else paid', () => {
    const text = expenseShareMessage(dinner({ paidBy: 'pau' }), nameOf);
    assert.match(text, /ho va pagar Pau/);
    assert.match(text, /Pau, ara et faig Bizum de 25,00 €\./);
  });

  it('summarises a group', () => {
    const b = new Map([
      ['anna', 2500],
      ['pau', -100],
      ['laia', 0],
    ]);
    const text = groupShareMessage('Colla', [dinner()], b, nameOf);
    assert.equal(
      text,
      ['Colla · com quedem', '• Anna em deu 25,00 €', '• Jo dec 1,00 € a Pau', '', 'Despeses:', '• 20 nov. Dinar: 100,00 € (vaig pagar jo)'].join('\n'),
    );
    assert.match(groupShareMessage('Colla', [], new Map(), nameOf), /Estem en paus/);
  });
});
