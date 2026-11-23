// Run with: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Contact, Movement } from '../domain/types.ts';
import {
  adoptUser,
  applyRemote,
  clearPushed,
  collectPush,
  emptySyncMeta,
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
  return { contacts: [], movements: [], sync: emptySyncMeta, ...partial };
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
    assert.deepEqual(d.sync.pending, { contacts: ['c1'], movements: ['m1'] });
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
    assert.deepEqual(d.sync.pending, { contacts: [], movements: ['m2'] });
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
      [remoteContact(), remoteContact({ id: 'c1', name: 'Laia Font', updated_at: '2026-11-23T08:00:00.000Z' })],
      [],
    );
    assert.deepEqual(
      d.contacts.map((c) => c.name),
      ['Laia Font', 'Pau'],
    );
    assert.equal(d.sync.cursor.contacts, '2026-11-23T08:00:00.000Z');

    d = applyRemote(d, [remoteContact({ deleted_at: '2026-11-23T09:00:00.000Z', updated_at: '2026-11-23T09:00:00.000Z' })], []);
    assert.deepEqual(
      d.contacts.map((c) => c.id),
      ['c1'],
    );
  });

  it('never overwrites unpushed local changes or tombstones', () => {
    let d = data({ contacts: [laia] });
    d = { ...d, sync: markDeleted(markChanged(d.sync, 'contacts', ['c1']), 'contacts', ['c9']) };
    d = applyRemote(d, [remoteContact({ id: 'c1', name: 'Una altra' }), remoteContact({ id: 'c9' })], []);
    assert.deepEqual(
      d.contacts.map((c) => c.name),
      ['Laia'],
    );
  });
});
