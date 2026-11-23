import { useMemo, useSyncExternalStore } from 'react';

import { balancesByContact, totals } from '@/domain/balances';
import type { Contact, DebtMovement, Id, Movement, PaymentMovement } from '@/domain/types';

import { loadRaw, saveRaw } from './persist';
import { buildSampleData } from './sample';

/**
 * Local-first app state: a single JSON document persisted on the device.
 * Components read it through the hooks below; writes go through the actions.
 * (Cloud sync with Supabase will plug in here later — schema in supabase/migrations.)
 */

export type Settings = {
  biometricLock: boolean;
};

export type AppState = {
  version: 1;
  onboarded: boolean;
  contacts: Contact[];
  movements: Movement[];
  settings: Settings;
};

const STORAGE_KEY = 'debtmate:state:v1';

const initialState: AppState = {
  version: 1,
  onboarded: false,
  contacts: [],
  movements: [],
  settings: { biometricLock: false },
};

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  const raw = loadRaw(STORAGE_KEY);
  if (!raw) return initialState;
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...initialState, ...parsed, settings: { ...initialState.settings, ...parsed.settings } };
  } catch {
    return initialState;
  }
}

function getState(): AppState {
  if (state === null) state = load();
  return state;
}

function setState(update: (s: AppState) => AppState): void {
  state = update(getState());
  saveRaw(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Selectors MUST return a stable reference (a field of the state), never a new object. */
function useSelect<T>(selector: (s: AppState) => T): T {
  const get = () => selector(getState());
  return useSyncExternalStore(subscribe, get, get);
}

export function newId(): Id {
  // RFC 4122 v4-shaped id; good enough for local records and compatible with a uuid column later.
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
  setState((s) => ({ ...s, contacts: [...s.contacts, contact] }));
  return contact;
}

export function deleteContact(id: Id): void {
  setState((s) => ({
    ...s,
    contacts: s.contacts.filter((c) => c.id !== id),
    movements: s.movements.filter((m) => m.contactId !== id),
  }));
}

type NewMovement =
  | Omit<DebtMovement, 'id' | 'createdAt'>
  | Omit<PaymentMovement, 'id' | 'createdAt'>;

export function addMovement(input: NewMovement): Movement {
  const movement = { ...input, id: newId(), createdAt: new Date().toISOString() } as Movement;
  setState((s) => ({ ...s, movements: [...s.movements, movement] }));
  return movement;
}

export function deleteMovement(id: Id): void {
  setState((s) => ({ ...s, movements: s.movements.filter((m) => m.id !== id) }));
}

export function updateSettings(patch: Partial<Settings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function completeOnboarding(): void {
  setState((s) => ({ ...s, onboarded: true }));
}

export function loadSampleData(): void {
  const sample = buildSampleData(newId);
  setState((s) => ({ ...s, contacts: sample.contacts, movements: sample.movements }));
}

export function eraseAllData(): void {
  setState((s) => ({ ...initialState, onboarded: s.onboarded }));
}

/** Snapshot for non-React code (export, share). */
export function readState(): AppState {
  return getState();
}
