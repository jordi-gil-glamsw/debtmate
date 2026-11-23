// Run with: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { planReminders, upcomingDueDates } from './reminders.ts';
import type { Contact, Movement } from './types.ts';

const laia: Contact = { id: 'laia', name: 'Laia', createdAt: '2026-11-01T00:00:00.000Z' };
const pau: Contact = { id: 'pau', name: 'Pau', createdAt: '2026-11-01T00:00:00.000Z' };

let seq = 0;
function debt(contactId: string, direction: 'owed' | 'owe', amountCents: number, dueDate?: string): Movement {
  seq += 1;
  return {
    id: `d${seq}`,
    contactId,
    kind: 'debt',
    direction,
    amountCents,
    concept: '',
    date: '2026-11-20',
    createdAt: '2026-11-20T10:00:00.000Z',
    ...(dueDate ? { dueDate } : {}),
  };
}
function paid(contactId: string, amountCents: number): Movement {
  seq += 1;
  return {
    id: `p${seq}`,
    contactId,
    kind: 'payment',
    direction: 'in',
    method: 'bizum',
    amountCents,
    concept: '',
    date: '2026-11-21',
    createdAt: '2026-11-21T10:00:00.000Z',
  };
}

// 23 Nov 2026, 08:00 local time
const now = new Date(2026, 10, 23, 8, 0, 0);

describe('upcomingDueDates', () => {
  it('ignores settled contacts and debts against the current balance', () => {
    const movs = [debt('laia', 'owed', 5000, '2026-11-30'), debt('laia', 'owe', 1000, '2026-11-25')];
    assert.deepEqual(upcomingDueDates(movs, 'laia', 4000, '2026-11-23'), ['2026-11-30']);
    assert.deepEqual(upcomingDueDates(movs, 'laia', 0, '2026-11-23'), []);
  });

  it('drops past dates and duplicates', () => {
    const movs = [
      debt('laia', 'owed', 100, '2026-11-01'),
      debt('laia', 'owed', 100, '2026-12-01'),
      debt('laia', 'owed', 100, '2026-12-01'),
    ];
    assert.deepEqual(upcomingDueDates(movs, 'laia', 300, '2026-11-23'), ['2026-12-01']);
  });
});

describe('planReminders', () => {
  it('builds Catalan messages with the outstanding amount, soonest first', () => {
    const movs = [
      debt('laia', 'owed', 5000, '2026-11-30'),
      paid('laia', 1760),
      debt('pau', 'owe', 4500, '2026-11-24'),
      debt('pau', 'owe', 1000), // no due date
    ];
    const plan = planReminders([laia, pau], movs, now);
    assert.deepEqual(
      plan.map((r) => [r.title, r.dueDate, r.url]),
      [
        ['Deus 55,00 € a Pau', '2026-11-24', '/persona/pau'],
        ['Laia et deu 32,40 €', '2026-11-30', '/persona/laia'],
      ],
    );
    assert.equal(plan[0].fireAt.getHours(), 10);
  });

  it('keeps today until 10:00 and skips it afterwards', () => {
    const movs = [debt('laia', 'owed', 1000, '2026-11-23')];
    assert.equal(planReminders([laia], movs, now).length, 1);
    assert.equal(planReminders([laia], movs, new Date(2026, 10, 23, 11, 0, 0)).length, 0);
  });

  it('caps the number of pending reminders', () => {
    const movs = Array.from({ length: 80 }, (_, i) => debt('laia', 'owed', 100, `2027-01-${String((i % 28) + 1).padStart(2, '0')}`));
    const many = Array.from({ length: 80 }, (_, i) => ({ ...movs[i], contactId: `c${i}` }));
    const contacts = many.map((m) => ({ ...laia, id: m.contactId }));
    assert.equal(planReminders(contacts, many, now).length, 60);
  });
});
