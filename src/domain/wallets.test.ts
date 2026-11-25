// Run with: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { balancesByContact } from './balances.ts';
import { expenseMovements } from './groups.ts';
import type { GroupExpense, Movement } from './types.ts';
import { defaultWallet, inWallet, walletField, walletOf } from './wallets.ts';

const debt = (id: string, amountCents: number, over: Partial<Movement> = {}): Movement => ({
  id,
  contactId: 'anna',
  kind: 'debt',
  direction: 'owed',
  amountCents,
  concept: '',
  date: '2026-11-20',
  createdAt: '2026-11-20T10:00:00.000Z',
  ...over,
} as Movement);

describe('wallets', () => {
  it('treats a missing wallet as personal', () => {
    assert.equal(walletOf({}), 'personal');
    assert.equal(walletOf({ wallet: 'familia' }), 'familia');
  });

  it('filters by view', () => {
    const ms = [debt('m1', 1000), debt('m2', 2500, { wallet: 'familia' })];
    const sum = (view: 'all' | 'personal' | 'familia') =>
      balancesByContact(ms.filter((m) => inWallet(view, m))).get('anna');
    assert.equal(sum('all'), 3500);
    assert.equal(sum('personal'), 1000);
    assert.equal(sum('familia'), 2500);
  });

  it('stores nothing for personal', () => {
    assert.deepEqual(walletField('personal'), {});
    assert.deepEqual(walletField('familia'), { wallet: 'familia' });
  });

  it('preselects the viewed wallet, or personal when viewing both', () => {
    assert.equal(defaultWallet('all'), 'personal');
    assert.equal(defaultWallet('familia'), 'familia');
  });

  it('gives the debts of a group expense the wallet of the expense', () => {
    const e: GroupExpense = {
      id: 'e1',
      groupId: 'g1',
      concept: 'Sopar',
      amountCents: 3000,
      date: '2026-11-20',
      paidBy: null,
      participantIds: ['anna', 'pau'],
      includesMe: true,
      wallet: 'familia',
      createdAt: '2026-11-20T10:00:00.000Z',
    };
    const debts = expenseMovements(e, () => true);
    assert.equal(debts.length, 2);
    assert.ok(debts.every((d) => d.wallet === 'familia'));
    assert.ok(expenseMovements({ ...e, wallet: undefined }, () => true).every((d) => d.wallet === undefined));
  });
});
