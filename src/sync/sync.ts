import { useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';
import { cleanupLocalReceipts } from '@/features/receipts/receipts';
import { readLocalData, updateLocalData } from '@/store/store';

import {
  adoptUser,
  applyRemote,
  clearPushed,
  collectPush,
  contactToRow,
  movementToRow,
  type ContactRow,
  type LocalData,
  type MovementRow,
  type Table,
} from './merge';
import { removeReceipts, uploadReceipts } from './receiptStorage';

/**
 * Network side of the sync (see merge.ts for the rules).
 * Order matters: contacts are pushed before the movements that reference them.
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

async function pull<R>(table: Table, cursor: string | null): Promise<R[]> {
  if (!supabase) return [];
  const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
  const rows: R[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select('*').order('updated_at').order('id').range(from, from + PAGE - 1);
    if (since) query = query.gt('updated_at', since);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data as R[]));
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
  for (const part of chunks(batch.contacts.map(contactToRow))) {
    const { error } = await supabase.from('contacts').upsert(part);
    if (error) throw error;
  }
  for (const part of chunks(batch.movements.map(movementToRow))) {
    const { error } = await supabase.from('movements').upsert(part);
    if (error) throw error;
  }
  await softDelete('movements', batch.deleted.movements);
  await softDelete('contacts', batch.deleted.contacts);
  await removeReceipts(userId, batch.receipts.remove);
  forThisUser((d) => clearPushed(d, batch));

  // 2. Pull
  const { cursor } = readLocalData().sync;
  const [contacts, movements] = await Promise.all([
    pull<ContactRow>('contacts', cursor.contacts),
    pull<MovementRow>('movements', cursor.movements),
  ]);
  forThisUser((d) => {
    const merged = applyRemote(d, contacts, movements);
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
