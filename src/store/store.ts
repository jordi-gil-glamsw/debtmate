import { useMemo, useSyncExternalStore } from 'react';

import { balancesByContact, totals } from '@/domain/balances';
import type { Contact, DebtMovement, Id, Movement, PaymentMovement } from '@/domain/types';
import { cleanupLocalReceipts, deleteLocalReceipt } from '@/features/receipts/receipts';
import { emptySyncMeta, markChanged, markDeleted, queueReceipts, type LocalData, type SyncMeta } from '@/sync/merge';

import { loadRaw, saveRaw } from './persist';
import { buildSampleData } from './sample';

/**
 * Local-first app state: a single JSON document persisted on the device.
 * Components read it through the hooks below; writes go through the actions.
 * Every write also records what changed in `sync`, so src/sync can push it to the account.
 */

export type Settings = {
  biometricLock: boolean;
  /** Notify on due dates (also needs the system permission). */
  reminders: boolean;
};

export type AppState = {
  version: 1;
  onboarded: boolean;
  contacts: Contact[];
  movements: Movement[];
  settings: Settings;
  sync: SyncMeta;
};

const STORAGE_KEY = 'debtmate:state:v1';

const initialState: AppState = {
  version: 1,
  onboarded: false,
  contacts: [],
  movements: [],
  settings: { biometricLock: false, reminders: true },
  sync: emptySyncMeta,
};

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  const raw = loadRaw(STORAGE_KEY);
  if (!raw) return initialState;
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...initialState,
      ...parsed,
      settings: { ...initialState.settings, ...parsed.settings },
      sync: { ...emptySyncMeta, ...parsed.sync },
    };
  } catch {
    return initialState;
  }
}

function getState(): AppState {
  if (state === null) state = load();
  return state;
}

function setState(update: (s: AppState) => AppState): void {
  const current = getState();
  const next = update(current);
  if (next === current) return;
  state = next;
  saveRaw(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Selectors MUST return a stable reference (a field of the state), never a new object. */
function useSelect<T>(selector: (s: AppState) => T): T {
  const get = () => selector(getState());
  return useSyncExternalStore(subscribe, get, get);
}

export function newId(): Id {
  // RFC 4122 v4-shaped id; good enough for local records and compatible with the uuid columns.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Read hooks ────────────────────────────────────────────────────────────────

export const useContacts = () => useSelect((s) => s.contacts);
export const useMovements = () => useSelect((s) => s.movements);
export const useSettings = () => useSelect((s) => s.settings);
export const useOnboarded = () => useSelect((s) => s.onboarded);
export const useSyncMeta = () => useSelect((s) => s.sync);

export function useContact(id: Id | undefined): Contact | undefined {
  const contacts = useContacts();
  return useMemo(() => contacts.find((c) => c.id === id), [contacts, id]);
}

export function useBalances(): Map<Id, number> {
  const movements = useMovements();
  return useMemo(() => balancesByContact(movements), [movements]);
}

export function useTotals() {
  const balances = useBalances();
  return useMemo(() => totals(balances), [balances]);
}

/** Contacts with their balance, sorted by largest outstanding amount first. */
export function useContactsWithBalance() {
  const contacts = useContacts();
  const balances = useBalances();
  return useMemo(
    () =>
      contacts
        .map((c) => ({ ...c, balance: balances.get(c.id) ?? 0 }))
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name, 'ca')),
    [contacts, balances],
  );
}

// ─── Actions ───────────────────────────────────────────────────────────────────

const receiptsOf = (ms: readonly Movement[]) => ms.flatMap((m) => (m.receipt ? [m.receipt] : []));

/** Deletes the device copies of photos that are no longer used (the account copy is queued for removal). */
function forgetLocalReceipts(names: string[]): void {
  for (const name of names) {
    try {
      deleteLocalReceipt(name);
    } catch {
      // best effort: a leftover file is cleaned up after the next sync
    }
  }
}

/** Returns the existing contact when the name matches (case-insensitive), otherwise creates it. */
export function addContact(name: string): Contact {
  const trimmed = name.trim();
  const existing = getState().contacts.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const contact: Contact = { id: newId(), name: trimmed, createdAt: new Date().toISOString() };
  setState((s) => ({
    ...s,
    contacts: [...s.contacts, contact],
    sync: markChanged(s.sync, 'contacts', [contact.id]),
  }));
  return contact;
}

/** Renames a contact. Fails if another contact already has that name (case-insensitive). */
export function renameContact(id: Id, name: string): 'ok' | 'duplicate' | 'empty' {
  const trimmed = name.trim();
  if (!trimmed) return 'empty';
  const s = getState();
  if (s.contacts.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) return 'duplicate';
  setState((st) => ({
    ...st,
    contacts: st.contacts.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
    sync: markChanged(st.sync, 'contacts', [id]),
  }));
  return 'ok';
}

export function deleteContact(id: Id): void {
  const photos = receiptsOf(getState().movements.filter((m) => m.contactId === id));
  setState((s) => {
    const removed = s.movements.filter((m) => m.contactId === id);
    const sync = markDeleted(markDeleted(s.sync, 'movements', removed.map((m) => m.id)), 'contacts', [id]);
    return {
      ...s,
      contacts: s.contacts.filter((c) => c.id !== id),
      movements: s.movements.filter((m) => m.contactId !== id),
      sync: queueReceipts(sync, [], receiptsOf(removed)),
    };
  });
  forgetLocalReceipts(photos);
}

type NewMovement =
  | Omit<DebtMovement, 'id' | 'createdAt'>
  | Omit<PaymentMovement, 'id' | 'createdAt'>;

export function addMovement(input: NewMovement): Movement {
  const movement = { ...input, id: newId(), createdAt: new Date().toISOString() } as Movement;
  setState((s) => ({
    ...s,
    movements: [...s.movements, movement],
    sync: queueReceipts(markChanged(s.sync, 'movements', [movement.id]), [movement.receipt], []),
  }));
  return movement;
}

/** Replaces a movement (same id) with its edited version, including a new or removed photo. */
export function updateMovement(movement: Movement): void {
  const previous = getState().movements.find((m) => m.id === movement.id);
  if (!previous) return;
  const photoChanged = previous.receipt !== movement.receipt;
  setState((s) => ({
    ...s,
    movements: s.movements.map((m) => (m.id === movement.id ? movement : m)),
    sync: photoChanged
      ? queueReceipts(markChanged(s.sync, 'movements', [movement.id]), [movement.receipt], [previous.receipt])
      : markChanged(s.sync, 'movements', [movement.id]),
  }));
  if (photoChanged && previous.receipt) forgetLocalReceipts([previous.receipt]);
}

export function deleteMovement(id: Id): void {
  const photos = receiptsOf(getState().movements.filter((m) => m.id === id));
  setState((s) => ({
    ...s,
    movements: s.movements.filter((m) => m.id !== id),
    sync: queueReceipts(markDeleted(s.sync, 'movements', [id]), [], photos),
  }));
  forgetLocalReceipts(photos);
}

export function updateSettings(patch: Partial<Settings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function completeOnboarding(): void {
  setState((s) => (s.onboarded ? s : { ...s, onboarded: true }));
}

/** Marks every current record as deleted, so the deletion also reaches the account. */
function tombstoneAll(s: AppState): SyncMeta {
  const withPhotos = queueReceipts(s.sync, [], receiptsOf(s.movements));
  const withMovements = markDeleted(
    withPhotos,
    'movements',
    s.movements.map((m) => m.id),
  );
  return markDeleted(
    withMovements,
    'contacts',
    s.contacts.map((c) => c.id),
  );
}

export function loadSampleData(): void {
  const photos = receiptsOf(getState().movements);
  const sample = buildSampleData(newId);
  setState((s) => {
    const cleared = tombstoneAll(s);
    const withContacts = markChanged(
      cleared,
      'contacts',
      sample.contacts.map((c) => c.id),
    );
    return {
      ...s,
      contacts: sample.contacts,
      movements: sample.movements,
      sync: markChanged(
        withContacts,
        'movements',
        sample.movements.map((m) => m.id),
      ),
    };
  });
  forgetLocalReceipts(photos);
}

export function eraseAllData(): void {
  const photos = receiptsOf(getState().movements);
  setState((s) => ({ ...s, contacts: [], movements: [], sync: tombstoneAll(s) }));
  forgetLocalReceipts(photos);
}

/** Snapshot for non-React code (export, share). */
export function readState(): AppState {
  return getState();
}

// ─── Sync plumbing (used by src/sync only) ────────────────────────────────────

export function readLocalData(): LocalData {
  const { contacts, movements, sync } = getState();
  return { contacts, movements, sync };
}

/** Applies a sync step to the latest state (the user may have edited meanwhile). */
export function updateLocalData(update: (d: LocalData) => LocalData): void {
  setState((s) => {
    const next = update({ contacts: s.contacts, movements: s.movements, sync: s.sync });
    if (next.contacts === s.contacts && next.movements === s.movements && next.sync === s.sync) return s;
    return { ...s, contacts: next.contacts, movements: next.movements, sync: next.sync };
  });
}

/** After signing out: removes the account's data from this device (it stays in the cloud). */
export function clearAccountData(): void {
  setState((s) => ({ ...s, contacts: [], movements: [], sync: emptySyncMeta }));
  try {
    cleanupLocalReceipts(new Set());
  } catch {
    // best effort
  }
}
