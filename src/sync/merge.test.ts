// Run with: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Contact, Group, GroupExpense, Movement } from '../domain/types.ts';
import {
  adoptUser,
  applyRemote,
  clearPushed,
  collectPush,
  emptyRecords,
  emptySyncMeta,
  expenseToRow,
  groupToRow,
  hasLocalChanges,
  normalizeSyncMeta,
  rowToExpense,
  rowToGroup,
  markChanged,
  markDeleted,
  movementToRow,
  rowToMovement,
  type ContactRow,
  type LocalData,
  type MovementRow,
} from './merge.ts';

const laia: Contact = { id: 'c1', name: 'Laia', createdAt: '2026-11-01T10:00:00.000Z' };
const debt: Movement = {
  id: 'm1',
  contactId: 'c1',
  kind: 'debt',
  direction: 'owed',
  amountCents: 3240,
  concept: 'Sopar',
  date: '2026-11-20',
  dueDate: '2026-11-30',
  createdAt: '2026-11-20T20:00:00.000Z',
};
const payment: Movement = {
  id: 'm2',
  contactId: 'c1',
  kind: 'payment',
  direction: 'in',
  method: 'bizum',
  amountCents: 1000,
  concept: '',
  date: '2026-11-21',
  createdAt: '2026-11-21T09:00:00.000Z',
};

function data(partial: Partial<LocalData> = {}): LocalData {
  return { ...emptyRecords, sync: emptySyncMeta, ...partial };
}

const remoteContact = (over: Partial<ContactRow> = {}): ContactRow => ({
  id: 'c2',
  name: 'Pau',
  created_at: '2026-11-02T10:00:00.000Z',
  updated_at: '2026-11-22T10:00:00.000Z',
  deleted_at: null,
  ...over,
});

describe('row mapping', () => {
  it('round-trips debts and payments', () => {
    for (const m of [debt, payment]) {
      const row: MovementRow = { ...movementToRow(m), updated_at: 'x', deleted_at: null };
      assert.deepEqual(rowToMovement(row), m);
    }
  });

  it('respects the database shape rules', () => {
    assert.equal(movementToRow(debt).method, null);
    assert.equal(movementToRow(payment).due_date, null);
  });
});

describe('adoptUser', () => {
  it('uploads everything on the first sync', () => {
    const d = adoptUser(data({ contacts: [laia], movements: [debt] }), 'u1');
    assert.equal(d.sync.userId, 'u1');
    assert.deepEqual(d.sync.pending, { contacts: ['c1'], groups: [], movements: ['m1'], expenses: [] });
  });

  it('drops data that belongs to another account', () => {
    const d = adoptUser(data({ contacts: [laia], sync: { ...emptySyncMeta, userId: 'u1' } }), 'u2');
    assert.equal(d.contacts.length, 0);
    assert.equal(d.sync.userId, 'u2');
  });
});

describe('push bookkeeping', () => {
  it('clears pushed records but keeps the ones edited during the push', () => {
    let d = data({ contacts: [laia], movements: [debt, payment] });
    d = { ...d, sync: markChanged(markChanged(d.sync, 'contacts', ['c1']), 'movements', ['m1', 'm2']) };
    const batch = collectPush(d);
    // m2 is replaced while the push is in flight
    d = { ...d, movements: [debt, { ...payment, amountCents: 1500 }] };
    d = clearPushed(d, batch);
    assert.deepEqual(d.sync.pending, { contacts: [], groups: [], movements: ['m2'], expenses: [] });
  });

  it('turns deletions into tombstones and clears them once pushed', () => {
    let d = data({ sync: markChanged(emptySyncMeta, 'movements', ['m1']) });
    d = { ...d, sync: markDeleted(d.sync, 'movements', ['m1']) };
    assert.deepEqual(d.sync.pending.movements, []);
    assert.deepEqual(d.sync.deleted.movements, ['m1']);
    d = clearPushed(d, collectPush(d));
    assert.deepEqual(d.sync.deleted.movements, []);
  });
});

describe('applyRemote', () => {
  it('adds, updates and deletes from pulled rows and advances the cursor', () => {
    let d = data({ contacts: [laia] });
    d = applyRemote(
      d,
      { contacts: [remoteContact(), remoteContact({ id: 'c1', name: 'Laia Font', updated_at: '2026-11-23T08:00:00.000Z' })] },
    );
    assert.deepEqual(
      d.contacts.map((c) => c.name),
      ['Laia Font', 'Pau'],
    );
    assert.equal(d.sync.cursor.contacts, '2026-11-23T08:00:00.000Z');

    d = applyRemote(d, { contacts: [remoteContact({ deleted_at: '2026-11-23T09:00:00.000Z', updated_at: '2026-11-23T09:00:00.000Z' })] });
    assert.deepEqual(
      d.contacts.map((c) => c.id),
      ['c1'],
    );
  });

  it('never overwrites unpushed local changes or tombstones', () => {
    let d = data({ contacts: [laia] });
    d = { ...d, sync: markDeleted(markChanged(d.sync, 'contacts', ['c1']), 'contacts', ['c9']) };
    d = applyRemote(d, { contacts: [remoteContact({ id: 'c1', name: 'Una altra' }), remoteContact({ id: 'c9' })] });
    assert.deepEqual(
      d.contacts.map((c) => c.name),
      ['Laia'],
    );
  });
});

describe('receipt photos', () => {
  it('leaves the photo column out while photos are disabled', async () => {
    const { movementToRow } = await import('./merge.ts');
    assert.equal('receipt' in movementToRow(debt, { withReceipt: false }), false);
    assert.equal(movementToRow(debt).receipt, null);
  });

  it('round-trips the receipt file name', async () => {
    const { movementToRow, rowToMovement } = await import('./merge.ts');
    const m = { ...debt, receipt: 'abc.jpg' };
    assert.deepEqual(rowToMovement({ ...movementToRow(m), updated_at: 'x', deleted_at: null }), m);
  });

  it('queues uploads and removals, cancelling a photo that never reached storage', async () => {
    const { queueReceipts } = await import('./merge.ts');
    let meta = queueReceipts(emptySyncMeta, ['a.jpg'], []);
    meta = queueReceipts(meta, ['b.jpg'], ['a.jpg']); // replaced before syncing
    assert.deepEqual(meta.receipts, { upload: ['b.jpg'], remove: [] });
    meta = queueReceipts({ ...meta, receipts: { upload: [], remove: [] } }, [], ['b.jpg']); // after upload
    assert.deepEqual(meta.receipts, { upload: [], remove: ['b.jpg'] });
  });

  it('uploads existing photos on the first sync and clears them once pushed', () => {
    let d = adoptUser(data({ movements: [{ ...debt, receipt: 'r.jpg' }] }), 'u1');
    assert.deepEqual(d.sync.receipts.upload, ['r.jpg']);
    d = clearPushed(d, collectPush(d));
    assert.deepEqual(d.sync.receipts.upload, []);
  });
});

describe('groups and expenses', () => {
  const group: Group = { id: 'g1', name: 'Colla', memberIds: ['c1', 'c2'], createdAt: '2026-11-20T10:00:00.000Z' };
  const expense: GroupExpense = {
    id: 'e1',
    groupId: 'g1',
    concept: 'Dinar',
    amountCents: 9000,
    date: '2026-11-20',
    paidBy: null,
    participantIds: ['c1', 'c2'],
    includesMe: true,
    note: 'Can Ramon',
    createdAt: '2026-11-20T15:00:00.000Z',
  };
  const meta = { updated_at: '2026-11-23T10:00:00.000Z', deleted_at: null };

  it('round-trips groups and expenses', () => {
    assert.deepEqual(rowToGroup({ ...groupToRow(group), ...meta }), group);
    assert.deepEqual(rowToExpense({ ...expenseToRow(expense), ...meta }), expense);
    const paidByFriend = { ...expense, paidBy: 'c2', includesMe: false, note: undefined };
    delete paidByFriend.note;
    assert.deepEqual(rowToExpense({ ...expenseToRow(paidByFriend), ...meta }), paidByFriend);
  });

  it('uploads groups and expenses on the first sync and pulls them', () => {
    let d = adoptUser(data({ groups: [group], expenses: [expense] }), 'u1');
    assert.deepEqual(d.sync.pending.groups, ['g1']);
    assert.deepEqual(d.sync.pending.expenses, ['e1']);
    assert.equal(hasLocalChanges(d.sync), true);
    d = clearPushed(d, collectPush(d));
    assert.equal(hasLocalChanges(d.sync), false);

    d = applyRemote(d, { expenses: [{ ...expenseToRow({ ...expense, amountCents: 12000 }), ...meta }] });
    assert.equal(d.expenses[0].amountCents, 12000);
    assert.equal(d.sync.cursor.expenses, meta.updated_at);
    assert.equal(d.sync.cursor.contacts, null);
  });

  it('upgrades sync state saved before groups existed', () => {
    const old = { userId: 'u1', pending: { contacts: ['c1'], movements: [] }, cursor: { contacts: 'x', movements: 'y' } };
    const meta = normalizeSyncMeta(old as never);
    assert.deepEqual(meta.pending, { contacts: ['c1'], groups: [], movements: [], expenses: [] });
    assert.deepEqual(meta.deleted.groups, []);
    assert.equal(meta.cursor.expenses, null);
    assert.equal(meta.cursor.contacts, 'x');
    assert.equal(hasLocalChanges(meta), true);
  });
});
