import { useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';
import { features } from '@/config/features';
import { cleanupLocalReceipts } from '@/features/receipts/receipts';
import { readLocalData, updateLocalData } from '@/store/store';

import {
  adoptUser,
  applyRemote,
  clearPushed,
  collectPush,
  contactToRow,
  expenseToRow,
  groupToRow,
  movementToRow,
  TABLES,
  type LocalData,
  type RemoteRows,
  type Table,
} from './merge';
import { removeReceipts, uploadReceipts } from './receiptStorage';

/**
 * Network side of the sync (see merge.ts for the rules).
 * Order matters: rows are pushed after the rows they reference (see TABLES), and deleted
 * in the reverse order.
 */

const PAGE = 1000;
const CHUNK = 500;
/** Re-read a small window before the cursor: rows committed late can carry an older updated_at. */
const OVERLAP_MS = 60_000;

export type SyncStatus = { state: 'idle' | 'syncing' | 'error'; error?: string };

let status: SyncStatus = { state: 'idle' };
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

async function upsert(table: Table, rows: object[]) {
  if (!supabase) return;
  for (const part of chunks(rows)) {
    const { error } = await supabase.from(table).upsert(part);
    if (error) throw error;
  }
}

async function pull(table: Table, cursor: string | null): Promise<unknown[]> {
  if (!supabase) return [];
  const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select('*').order('updated_at').order('id').range(from, from + PAGE - 1);
    if (since) query = query.gt('updated_at', since);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

async function softDelete(table: Table, ids: string[]) {
  if (!supabase) return;
  const deletedAt = new Date().toISOString();
  for (const part of chunks(ids)) {
    const { error } = await supabase.from(table).update({ deleted_at: deletedAt }).in('id', part);
    if (error) throw error;
  }
}

async function syncOnce(): Promise<void> {
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;
  updateLocalData((d) => adoptUser(d, userId));
  // If the user signs out mid-sync, the local data is cleared: never write results back then.
  const forThisUser = (step: (d: LocalData) => LocalData) =>
    updateLocalData((d) => (d.sync.userId === userId ? step(d) : d));

  // 1. Push
  const batch = collectPush(readLocalData());
  // Photos first, so other devices never see a movement whose photo isn't there yet.
  await uploadReceipts(userId, batch.receipts.upload);
  const withReceipt = features.receiptPhotos;
  await upsert('contacts', batch.contacts.map(contactToRow));
  await upsert('groups', batch.groups.map(groupToRow));
  await upsert('movements', batch.movements.map((m) => movementToRow(m, { withReceipt })));
  await upsert('expenses', batch.expenses.map(expenseToRow));
  for (const table of [...TABLES].reverse()) await softDelete(table, batch.deleted[table]);
  await removeReceipts(userId, batch.receipts.remove);
  forThisUser((d) => clearPushed(d, batch));

  // 2. Pull
  const { cursor } = readLocalData().sync;
  const pulled = await Promise.all(TABLES.map((t) => pull(t, cursor[t])));
  const rows = Object.fromEntries(TABLES.map((t, i) => [t, pulled[i]])) as unknown as RemoteRows;
  forThisUser((d) => {
    const merged = applyRemote(d, rows);
    return { ...merged, sync: { ...merged.sync, lastSyncedAt: new Date().toISOString() } };
  });
  cleanupReceipts();
}

/** Deletes local photo files that no movement (or pending upload) uses any more. */
export function cleanupReceipts(): void {
  const { movements, sync } = readLocalData();
  const keep = new Set([...movements.flatMap((m) => (m.receipt ? [m.receipt] : [])), ...sync.receipts.upload]);
  try {
    cleanupLocalReceipts(keep);
  } catch {
    // best effort
  }
}

let running: Promise<void> | null = null;
let again = false;

/** Runs a sync now; if one is already running, another round follows it. Never throws. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setStatus({ state: 'syncing' });
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
      setStatus({ state: 'idle' });
    } catch (e) {
      setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}
