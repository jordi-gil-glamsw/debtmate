/**
 * Pure sync logic (no React, no network) so it can be unit tested.
 *
 * Model: local-first. Every local change marks the record id as pending; deletions are
 * remembered as tombstones until pushed. A sync = push pending + tombstones, then pull
 * every remote row changed since the last cursor (server `updated_at`) and merge it.
 * Conflicts resolve as last-writer-wins, except that a local change not yet pushed
 * always wins over a pulled row.
 */
import type { Contact, Id, Movement } from '../domain/types';

export type Table = 'contacts' | 'movements';

export type SyncMeta = {
  /** Account the local data belongs to (null = never synced). */
  userId: string | null;
  pending: Record<Table, Id[]>;
  deleted: Record<Table, Id[]>;
  /** Highest server `updated_at` already pulled, per table. */
  cursor: Record<Table, string | null>;
  lastSyncedAt: string | null;
  /** Receipt photos to upload to / remove from the account's storage (file names). */
  receipts: { upload: string[]; remove: string[] };
};

export type LocalData = {
  contacts: Contact[];
  movements: Movement[];
  sync: SyncMeta;
};

export const emptySyncMeta: SyncMeta = {
  userId: null,
  pending: { contacts: [], movements: [] },
  deleted: { contacts: [], movements: [] },
  cursor: { contacts: null, movements: null },
  lastSyncedAt: null,
  receipts: { upload: [], remove: [] },
};

// ─── Remote rows (snake_case, as in supabase/migrations) ──────────────────────

export type ContactRow = {
  id: Id;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

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
  updated_at: string;
  deleted_at: string | null;
};

export type ContactUpsert = Pick<ContactRow, 'id' | 'name' | 'created_at'>;
export type MovementUpsert = Omit<MovementRow, 'updated_at' | 'deleted_at'>;

export function contactToRow(c: Contact): ContactUpsert {
  return { id: c.id, name: c.name, created_at: c.createdAt };
}

export function movementToRow(m: Movement): MovementUpsert {
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
    receipt: m.receipt ?? null,
    created_at: m.createdAt,
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

// ─── Local bookkeeping ────────────────────────────────────────────────────────

const union = (a: Id[], b: Id[]) => (b.length === 0 ? a : [...new Set([...a, ...b])]);
const without = (a: Id[], b: Iterable<Id>) => {
  const drop = new Set(b);
  return drop.size === 0 ? a : a.filter((id) => !drop.has(id));
};

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
    meta.pending.contacts.length +
      meta.pending.movements.length +
      meta.deleted.contacts.length +
      meta.deleted.movements.length +
      meta.receipts.upload.length +
      meta.receipts.remove.length >
    0
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
        pending: {
          contacts: union(data.sync.pending.contacts, data.contacts.map((c) => c.id)),
          movements: union(data.sync.pending.movements, data.movements.map((m) => m.id)),
        },
        receipts: {
          ...data.sync.receipts,
          upload: union(
            data.sync.receipts.upload,
            data.movements.flatMap((m) => (m.receipt ? [m.receipt] : [])),
          ),
        },
        cursor: { contacts: null, movements: null },
      },
    };
  }
  return { contacts: [], movements: [], sync: { ...emptySyncMeta, userId } };
}

/** What a push sends. Records are kept by reference to detect edits made during the push. */
export type PushBatch = {
  contacts: Contact[];
  movements: Movement[];
  deleted: Record<Table, Id[]>;
  receipts: { upload: string[]; remove: string[] };
};

export function collectPush(data: LocalData): PushBatch {
  const pendingContacts = new Set(data.sync.pending.contacts);
  const pendingMovements = new Set(data.sync.pending.movements);
  return {
    contacts: data.contacts.filter((c) => pendingContacts.has(c.id)),
    movements: data.movements.filter((m) => pendingMovements.has(m.id)),
    deleted: { contacts: [...data.sync.deleted.contacts], movements: [...data.sync.deleted.movements] },
    receipts: { upload: [...data.sync.receipts.upload], remove: [...data.sync.receipts.remove] },
  };
}

/** After a successful push: clear what was sent, unless it changed again meanwhile. */
export function clearPushed(data: LocalData, batch: PushBatch): LocalData {
  const contactNow = new Map(data.contacts.map((c) => [c.id, c]));
  const movementNow = new Map(data.movements.map((m) => [m.id, m]));
  const doneContacts = batch.contacts.filter((c) => contactNow.get(c.id) === c).map((c) => c.id);
  const doneMovements = batch.movements.filter((m) => movementNow.get(m.id) === m).map((m) => m.id);
  return {
    ...data,
    sync: {
      ...data.sync,
      pending: {
        contacts: without(data.sync.pending.contacts, doneContacts),
        movements: without(data.sync.pending.movements, doneMovements),
      },
      deleted: {
        contacts: without(data.sync.deleted.contacts, batch.deleted.contacts),
        movements: without(data.sync.deleted.movements, batch.deleted.movements),
      },
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
export function applyRemote(data: LocalData, contacts: ContactRow[], movements: MovementRow[]): LocalData {
  const { pending, deleted } = data.sync;
  return {
    contacts: mergeTable(data.contacts, contacts, new Set([...pending.contacts, ...deleted.contacts]), rowToContact),
    movements: mergeTable(data.movements, movements, new Set([...pending.movements, ...deleted.movements]), rowToMovement),
    sync: {
      ...data.sync,
      cursor: {
        contacts: maxCursor(data.sync.cursor.contacts, contacts),
        movements: maxCursor(data.sync.cursor.movements, movements),
      },
    },
  };
}
