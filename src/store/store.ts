import { useMemo, useSyncExternalStore } from 'react';

import { balancesByContact, totals } from '@/domain/balances';
import type { Contact, DebtMovement, Id, Movement, PaymentMovement } from '@/domain/types';
import { emptySyncMeta, markChanged, markDeleted, type LocalData, type SyncMeta } from '@/sync/merge';

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

export function deleteContact(id: Id): void {
  setState((s) => {
    const movementIds = s.movements.filter((m) => m.contactId === id).map((m) => m.id);
    return {
      ...s,
      contacts: s.contacts.filter((c) => c.id !== id),
      movements: s.movements.filter((m) => m.contactId !== id),
      sync: markDeleted(markDeleted(s.sync, 'movements', movementIds), 'contacts', [id]),
    };
  });
}

type NewMovement =
  | Omit<DebtMovement, 'id' | 'createdAt'>
  | Omit<PaymentMovement, 'id' | 'createdAt'>;

export function addMovement(input: NewMovement): Movement {
  const movement = { ...input, id: newId(), createdAt: new Date().toISOString() } as Movement;
  setState((s) => ({
    ...s,
    movements: [...s.movements, movement],
    sync: markChanged(s.sync, 'movements', [movement.id]),
  }));
  return movement;
}

/** Replaces a movement (same id) with its edited version. */
export function updateMovement(movement: Movement): void {
  setState((s) => {
    if (!s.movements.some((m) => m.id === movement.id)) return s;
    return {
      ...s,
      movements: s.movements.map((m) => (m.id === movement.id ? movement : m)),
      sync: markChanged(s.sync, 'movements', [movement.id]),
    };
  });
}

export function deleteMovement(id: Id): void {
  setState((s) => ({
    ...s,
    movements: s.movements.filter((m) => m.id !== id),
    sync: markDeleted(s.sync, 'movements', [id]),
  }));
}

export function updateSettings(patch: Partial<Settings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function completeOnboarding(): void {
  setState((s) => (s.onboarded ? s : { ...s, onboarded: true }));
}

/** Marks every current record as deleted, so the deletion also reaches the account. */
function tombstoneAll(s: AppState): SyncMeta {
  const withMovements = markDeleted(
    s.sync,
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
}

export function eraseAllData(): void {
  setState((s) => ({ ...s, contacts: [], movements: [], sync: tombstoneAll(s) }));
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
}
