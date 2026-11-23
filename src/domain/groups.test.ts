// Run with: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { expenseMovements, expenseProblem, expenseShares, groupBalances, ME, myNetEffect, splitEqually } from './groups.ts';
import type { GroupExpense } from './types.ts';

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
    const b = groupBalances(expenses, exists);
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
