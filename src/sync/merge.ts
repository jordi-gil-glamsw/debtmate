/**
 * Pure sync logic (no React, no network) so it can be unit tested.
 *
 * Model: local-first. Every local change marks the record id as pending; deletions are
 * remembered as tombstones until pushed. A sync = push pending + tombstones, then pull
 * every remote row changed since the last cursor (server `updated_at`) and merge it.
 * Conflicts resolve as last-writer-wins, except that a local change not yet pushed
 * always wins over a pulled row.
 */
import type { Contact, Group, GroupExpense, Id, Movement } from '../domain/types';

/** Synced tables, in push order (a row is pushed after the rows it references). */
export const TABLES = ['contacts', 'groups', 'movements', 'expenses'] as const;
export type Table = (typeof TABLES)[number];

type PerTable<T> = Record<Table, T>;

export type SyncMeta = {
  /** Account the local data belongs to (null = never synced). */
  userId: string | null;
  pending: PerTable<Id[]>;
  deleted: PerTable<Id[]>;
  /** Highest server `updated_at` already pulled, per table. */
  cursor: PerTable<string | null>;
  lastSyncedAt: string | null;
  /** Receipt photos to upload to / remove from the account's storage (file names). */
  receipts: { upload: string[]; remove: string[] };
};

/** The synced part of the app state. */
export type Records = {
  contacts: Contact[];
  groups: Group[];
  movements: Movement[];
  expenses: GroupExpense[];
};

export type LocalData = Records & { sync: SyncMeta };

const perTable = <T>(make: () => T): PerTable<T> =>
  Object.fromEntries(TABLES.map((t) => [t, make()])) as PerTable<T>;

export const emptyRecords: Records = { contacts: [], groups: [], movements: [], expenses: [] };

export const emptySyncMeta: SyncMeta = {
  userId: null,
  pending: perTable(() => []),
  deleted: perTable(() => []),
  cursor: perTable(() => null),
  lastSyncedAt: null,
  receipts: { upload: [], remove: [] },
};

/** Fills in what a SyncMeta saved by an older app version lacks (e.g. tables added later). */
export function normalizeSyncMeta(saved: Partial<SyncMeta> | undefined): SyncMeta {
  if (!saved) return emptySyncMeta;
  return {
    ...emptySyncMeta,
    ...saved,
    pending: { ...emptySyncMeta.pending, ...saved.pending },
    deleted: { ...emptySyncMeta.deleted, ...saved.deleted },
    cursor: { ...emptySyncMeta.cursor, ...saved.cursor },
    receipts: { ...emptySyncMeta.receipts, ...saved.receipts },
  };
}

// ─── Remote rows (snake_case, as in supabase/migrations) ──────────────────────

type RowMeta = { updated_at: string; deleted_at: string | null };

export type ContactRow = {
  id: Id;
  name: string;
  created_at: string;
} & RowMeta;

export type MovementRow = {
  id: Id;
  contact_id: Id;
  kind: 'debt' | 'payment';
  direction: string;
  amount_cents: number;
  concept: string;
  date: string;
  due_date: string | null;
  method: string | null;
  note: string | null;
  receipt: string | null;
  created_at: string;
} & RowMeta;

export type GroupRow = {
  id: Id;
  name: string;
  member_ids: Id[];
  created_at: string;
} & RowMeta;

export type ExpenseRow = {
  id: Id;
  group_id: Id;
  concept: string;
  amount_cents: number;
  date: string;
  paid_by: Id | null;
  participant_ids: Id[];
  includes_me: boolean;
  note: string | null;
  created_at: string;
} & RowMeta;

export type RemoteRows = {
  contacts: ContactRow[];
  groups: GroupRow[];
  movements: MovementRow[];
  expenses: ExpenseRow[];
};

export type ContactUpsert = Omit<ContactRow, keyof RowMeta>;
export type MovementUpsert = Omit<MovementRow, keyof RowMeta | 'receipt'> & { receipt?: string | null };
export type GroupUpsert = Omit<GroupRow, keyof RowMeta>;
export type ExpenseUpsert = Omit<ExpenseRow, keyof RowMeta>;

export function contactToRow(c: Contact): ContactUpsert {
  return { id: c.id, name: c.name, created_at: c.createdAt };
}

/**
 * withReceipt: send the photo column. Off while receipt photos are disabled, so the sync also
 * works on a database without migration 0003.
 */
export function movementToRow(m: Movement, { withReceipt = true }: { withReceipt?: boolean } = {}): MovementUpsert {
  return {
    id: m.id,
    contact_id: m.contactId,
    kind: m.kind,
    direction: m.direction,
    amount_cents: m.amountCents,
    concept: m.concept,
    date: m.date,
    due_date: m.kind === 'debt' ? (m.dueDate ?? null) : null,
    method: m.kind === 'payment' ? m.method : null,
    note: m.note ?? null,
    ...(withReceipt ? { receipt: m.receipt ?? null } : {}),
    created_at: m.createdAt,
  };
}

export function groupToRow(g: Group): GroupUpsert {
  return { id: g.id, name: g.name, member_ids: g.memberIds, created_at: g.createdAt };
}

export function expenseToRow(e: GroupExpense): ExpenseUpsert {
  return {
    id: e.id,
    group_id: e.groupId,
    concept: e.concept,
    amount_cents: e.amountCents,
    date: e.date,
    paid_by: e.paidBy,
    participant_ids: e.participantIds,
    includes_me: e.includesMe,
    note: e.note ?? null,
    created_at: e.createdAt,
  };
}

export function rowToContact(r: ContactRow): Contact {
  return { id: r.id, name: r.name, createdAt: r.created_at };
}

export function rowToMovement(r: MovementRow): Movement {
  const base = {
    id: r.id,
    contactId: r.contact_id,
    amountCents: Number(r.amount_cents),
    concept: r.concept,
    date: r.date,
    createdAt: r.created_at,
    ...(r.note ? { note: r.note } : {}),
    ...(r.receipt ? { receipt: r.receipt } : {}),
  };
  if (r.kind === 'debt') {
    return {
      ...base,
      kind: 'debt',
      direction: r.direction as 'owed' | 'owe',
      ...(r.due_date ? { dueDate: r.due_date } : {}),
    };
  }
  return {
    ...base,
    kind: 'payment',
    direction: r.direction as 'in' | 'out',
    method: (r.method ?? 'altres') as 'bizum' | 'efectiu' | 'transferencia' | 'altres',
  };
}

export function rowToGroup(r: GroupRow): Group {
  return { id: r.id, name: r.name, memberIds: r.member_ids ?? [], createdAt: r.created_at };
}

export function rowToExpense(r: ExpenseRow): GroupExpense {
  return {
    id: r.id,
    groupId: r.group_id,
    concept: r.concept,
    amountCents: Number(r.amount_cents),
    date: r.date,
    paidBy: r.paid_by,
    participantIds: r.participant_ids ?? [],
    includesMe: r.includes_me,
    ...(r.note ? { note: r.note } : {}),
    createdAt: r.created_at,
  };
}

// ─── Local bookkeeping ────────────────────────────────────────────────────────

const union = (a: Id[], b: Id[]) => (b.length === 0 ? a : [...new Set([...a, ...b])]);
const without = (a: Id[], b: Iterable<Id>) => {
  const drop = new Set(b);
  return drop.size === 0 ? a : a.filter((id) => !drop.has(id));
};
const mapTables = <T, U>(source: PerTable<T>, fn: (value: T, table: Table) => U): PerTable<U> =>
  Object.fromEntries(TABLES.map((t) => [t, fn(source[t], t)])) as PerTable<U>;

/** Records created or changed locally. */
export function markChanged(meta: SyncMeta, table: Table, ids: Id[]): SyncMeta {
  return { ...meta, pending: { ...meta.pending, [table]: union(meta.pending[table], ids) } };
}

/** Records removed locally: forget pending changes, remember the tombstone. */
export function markDeleted(meta: SyncMeta, table: Table, ids: Id[]): SyncMeta {
  return {
    ...meta,
    pending: { ...meta.pending, [table]: without(meta.pending[table], ids) },
    deleted: { ...meta.deleted, [table]: union(meta.deleted[table], ids) },
  };
}

export function hasLocalChanges(meta: SyncMeta): boolean {
  return (
    TABLES.some((t) => meta.pending[t].length + meta.deleted[t].length > 0) ||
    meta.receipts.upload.length + meta.receipts.remove.length > 0
  );
}

/** A receipt photo was added (upload it) or dropped (remove it from storage). */
export function queueReceipts(meta: SyncMeta, added: (string | undefined)[], removed: (string | undefined)[]): SyncMeta {
  const add = added.filter((n): n is string => Boolean(n));
  const rem = removed.filter((n): n is string => Boolean(n));
  if (add.length === 0 && rem.length === 0) return meta;
  return {
    ...meta,
    receipts: {
      // A photo removed before it was ever uploaded never needs to reach storage.
      upload: without(union(meta.receipts.upload, add), rem),
      remove: without(
        union(
          meta.receipts.remove,
          rem.filter((n) => !meta.receipts.upload.includes(n)),
        ),
        add,
      ),
    },
  };
}

/**
 * Binds the local data to an account before syncing.
 * - First sync ever: everything on the device is uploaded to that account.
 * - Data from a different account: dropped (it already lives in that other account).
 */
export function adoptUser(data: LocalData, userId: string): LocalData {
  if (data.sync.userId === userId) return data;
  if (data.sync.userId === null) {
    return {
      ...data,
      sync: {
        ...data.sync,
        userId,
        pending: mapTables(data.sync.pending, (ids, t) => union(ids, data[t].map((r) => r.id))),
        receipts: {
          ...data.sync.receipts,
          upload: union(
            data.sync.receipts.upload,
            data.movements.flatMap((m) => (m.receipt ? [m.receipt] : [])),
          ),
        },
        cursor: perTable(() => null),
      },
    };
  }
  return { ...emptyRecords, sync: { ...emptySyncMeta, userId } };
}

/** What a push sends. Records are kept by reference to detect edits made during the push. */
export type PushBatch = Records & {
  deleted: PerTable<Id[]>;
  receipts: { upload: string[]; remove: string[] };
};

function pendingOf<T extends { id: Id }>(records: T[], ids: Id[]): T[] {
  const set = new Set(ids);
  return records.filter((r) => set.has(r.id));
}

export function collectPush(data: LocalData): PushBatch {
  const { pending, deleted, receipts } = data.sync;
  return {
    contacts: pendingOf(data.contacts, pending.contacts),
    groups: pendingOf(data.groups, pending.groups),
    movements: pendingOf(data.movements, pending.movements),
    expenses: pendingOf(data.expenses, pending.expenses),
    deleted: mapTables(deleted, (ids) => [...ids]),
    receipts: { upload: [...receipts.upload], remove: [...receipts.remove] },
  };
}

/** Ids from the batch whose record is still the very same object (not edited meanwhile). */
function unchanged<T extends { id: Id }>(now: T[], sent: T[]): Id[] {
  const byId = new Map(now.map((r) => [r.id, r]));
  return sent.filter((r) => byId.get(r.id) === r).map((r) => r.id);
}

/** After a successful push: clear what was sent, unless it changed again meanwhile. */
export function clearPushed(data: LocalData, batch: PushBatch): LocalData {
  return {
    ...data,
    sync: {
      ...data.sync,
      pending: mapTables(data.sync.pending, (ids, t) =>
        without(ids, unchanged<{ id: Id }>(data[t], batch[t])),
      ),
      deleted: mapTables(data.sync.deleted, (ids, t) => without(ids, batch.deleted[t])),
      receipts: {
        upload: without(data.sync.receipts.upload, batch.receipts.upload),
        remove: without(data.sync.receipts.remove, batch.receipts.remove),
      },
    },
  };
}

function maxCursor(current: string | null, rows: { updated_at: string }[]): string | null {
  let max = current;
  for (const r of rows) if (max === null || Date.parse(r.updated_at) > Date.parse(max)) max = r.updated_at;
  return max;
}

function mergeTable<T extends { id: Id }, R extends { id: Id; deleted_at: string | null }>(
  local: T[],
  rows: R[],
  skip: Set<Id>,
  convert: (r: R) => T,
): T[] {
  if (rows.length === 0) return local;
  const byId = new Map(local.map((x) => [x.id, x]));
  for (const r of rows) {
    if (skip.has(r.id)) continue; // unpushed local change wins
    if (r.deleted_at) byId.delete(r.id);
    else byId.set(r.id, convert(r));
  }
  return [...byId.values()];
}

/** Merges pulled rows into local data and advances the cursors. */
export function applyRemote(data: LocalData, rows: Partial<RemoteRows>): LocalData {
  const { pending, deleted } = data.sync;
  const skip = (t: Table) => new Set([...pending[t], ...deleted[t]]);
  const r: RemoteRows = { contacts: [], groups: [], movements: [], expenses: [], ...rows };
  return {
    contacts: mergeTable(data.contacts, r.contacts, skip('contacts'), rowToContact),
    groups: mergeTable(data.groups, r.groups, skip('groups'), rowToGroup),
    movements: mergeTable(data.movements, r.movements, skip('movements'), rowToMovement),
    expenses: mergeTable(data.expenses, r.expenses, skip('expenses'), rowToExpense),
    sync: {
      ...data.sync,
      cursor: mapTables(data.sync.cursor, (cursor, t) => maxCursor(cursor, r[t])),
    },
  };
}
