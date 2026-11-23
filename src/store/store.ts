import { useMemo, useSyncExternalStore } from 'react';

import { balancesByContact, totals } from '@/domain/balances';
import { expenseMovements } from '@/domain/groups';
import type { Contact, DebtMovement, Group, GroupExpense, Id, Movement, PaymentMovement } from '@/domain/types';
import { cleanupLocalReceipts, deleteLocalReceipt } from '@/features/receipts/receipts';
import {
  emptyRecords,
  emptySyncMeta,
  markChanged,
  markDeleted,
  normalizeSyncMeta,
  queueReceipts,
  type LocalData,
  type SyncMeta,
} from '@/sync/merge';

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
  /** Stored movements only; debts from group expenses are derived (see useMovements). */
  movements: Movement[];
  groups: Group[];
  expenses: GroupExpense[];
  settings: Settings;
  sync: SyncMeta;
};

const STORAGE_KEY = 'ovia:state:v1';
const LEGACY_STORAGE_KEY = 'debtmate:state:v1';

const initialState: AppState = {
  version: 1,
  onboarded: false,
  ...emptyRecords,
  settings: { biometricLock: false, reminders: true },
  sync: emptySyncMeta,
};

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  // Dades desades abans del canvi de nom (l'app es deia DebtMate): es llegeixen un cop i
  // la primera escriptura ja les deixa sota la clau nova.
  const raw = loadRaw(STORAGE_KEY) ?? loadRaw(LEGACY_STORAGE_KEY);
  if (!raw) return initialState;
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...initialState,
      ...parsed,
      settings: { ...initialState.settings, ...parsed.settings },
      sync: normalizeSyncMeta(parsed.sync),
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

/**
 * Stored movements plus the debts derived from group expenses, as one list.
 * Cached on its inputs so selectors get a stable reference.
 */
let derived: { contacts: Contact[]; movements: Movement[]; expenses: GroupExpense[]; all: Movement[] } | null = null;
function allMovements(s: AppState): Movement[] {
  if (derived && derived.contacts === s.contacts && derived.movements === s.movements && derived.expenses === s.expenses) {
    return derived.all;
  }
  const ids = new Set(s.contacts.map((c) => c.id));
  const fromExpenses = s.expenses.flatMap((e) => expenseMovements(e, (id) => ids.has(id)));
  const all = fromExpenses.length === 0 ? s.movements : [...s.movements, ...fromExpenses];
  derived = { contacts: s.contacts, movements: s.movements, expenses: s.expenses, all };
  return all;
}

export const useContacts = () => useSelect((s) => s.contacts);
/** Every movement, including the debts derived from group expenses (they carry expenseId). */
export const useMovements = () => useSelect(allMovements);
export const useGroups = () => useSelect((s) => s.groups);
export const useExpenses = () => useSelect((s) => s.expenses);
export const useSettings = () => useSelect((s) => s.settings);
export const useOnboarded = () => useSelect((s) => s.onboarded);
export const useSyncMeta = () => useSelect((s) => s.sync);

export function useContact(id: Id | undefined): Contact | undefined {
  const contacts = useContacts();
  return useMemo(() => contacts.find((c) => c.id === id), [contacts, id]);
}

export function useGroup(id: Id | undefined): Group | undefined {
  const groups = useGroups();
  return useMemo(() => groups.find((g) => g.id === id), [groups, id]);
}

export function useExpense(id: Id | undefined): GroupExpense | undefined {
  const expenses = useExpenses();
  return useMemo(() => expenses.find((e) => e.id === id), [expenses, id]);
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
    // Their parts of group expenses stop counting (derived debts skip missing people);
    // the other people's parts stay as they were.
    const groupsWithThem = s.groups.filter((g) => g.memberIds.includes(id)).map((g) => g.id);
    return {
      ...s,
      contacts: s.contacts.filter((c) => c.id !== id),
      movements: s.movements.filter((m) => m.contactId !== id),
      groups: s.groups.map((g) => (g.memberIds.includes(id) ? { ...g, memberIds: g.memberIds.filter((m) => m !== id) } : g)),
      sync: markChanged(queueReceipts(sync, [], receiptsOf(removed)), 'groups', groupsWithThem),
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
  // Debts derived from a group expense aren't stored: delete the expense instead.
  if (!getState().movements.some((m) => m.id === id)) return;
  const photos = receiptsOf(getState().movements.filter((m) => m.id === id));
  setState((s) => ({
    ...s,
    movements: s.movements.filter((m) => m.id !== id),
    sync: queueReceipts(markDeleted(s.sync, 'movements', [id]), [], photos),
  }));
  forgetLocalReceipts(photos);
}

// ─── Groups ────────────────────────────────────────────────────────────────────

export function addGroup(name: string, memberIds: Id[]): Group {
  const group: Group = { id: newId(), name: name.trim(), memberIds, createdAt: new Date().toISOString() };
  setState((s) => ({ ...s, groups: [...s.groups, group], sync: markChanged(s.sync, 'groups', [group.id]) }));
  return group;
}

export function updateGroup(id: Id, patch: Pick<Group, 'name' | 'memberIds'>): void {
  setState((s) => ({
    ...s,
    groups: s.groups.map((g) => (g.id === id ? { ...g, name: patch.name.trim(), memberIds: patch.memberIds } : g)),
    sync: markChanged(s.sync, 'groups', [id]),
  }));
}

/** Deletes the group and its expenses (and so the debts they created). */
export function deleteGroup(id: Id): void {
  setState((s) => {
    const expenseIds = s.expenses.filter((e) => e.groupId === id).map((e) => e.id);
    return {
      ...s,
      groups: s.groups.filter((g) => g.id !== id),
      expenses: s.expenses.filter((e) => e.groupId !== id),
      sync: markDeleted(markDeleted(s.sync, 'expenses', expenseIds), 'groups', [id]),
    };
  });
}

export type NewExpense = Omit<GroupExpense, 'id' | 'createdAt'>;

export function addExpense(input: NewExpense): GroupExpense {
  const expense: GroupExpense = { ...input, id: newId(), createdAt: new Date().toISOString() };
  setState((s) => ({ ...s, expenses: [...s.expenses, expense], sync: markChanged(s.sync, 'expenses', [expense.id]) }));
  return expense;
}

export function updateExpense(expense: GroupExpense): void {
  setState((s) => ({
    ...s,
    expenses: s.expenses.map((e) => (e.id === expense.id ? expense : e)),
    sync: markChanged(s.sync, 'expenses', [expense.id]),
  }));
}

export function deleteExpense(id: Id): void {
  setState((s) => ({
    ...s,
    expenses: s.expenses.filter((e) => e.id !== id),
    sync: markDeleted(s.sync, 'expenses', [id]),
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
  let sync = queueReceipts(s.sync, [], receiptsOf(s.movements));
  sync = markDeleted(sync, 'expenses', s.expenses.map((e) => e.id));
  sync = markDeleted(sync, 'movements', s.movements.map((m) => m.id));
  sync = markDeleted(sync, 'groups', s.groups.map((g) => g.id));
  return markDeleted(sync, 'contacts', s.contacts.map((c) => c.id));
}

export function loadSampleData(): void {
  const photos = receiptsOf(getState().movements);
  const sample = buildSampleData(newId);
  setState((s) => {
    const cleared = tombstoneAll(s);
    let sync = markChanged(cleared, 'contacts', sample.contacts.map((c) => c.id));
    sync = markChanged(sync, 'groups', sample.groups.map((g) => g.id));
    sync = markChanged(sync, 'movements', sample.movements.map((m) => m.id));
    sync = markChanged(sync, 'expenses', sample.expenses.map((e) => e.id));
    return { ...s, ...sample, sync };
  });
  forgetLocalReceipts(photos);
}

export function eraseAllData(): void {
  const photos = receiptsOf(getState().movements);
  setState((s) => ({ ...s, ...emptyRecords, sync: tombstoneAll(s) }));
  forgetLocalReceipts(photos);
}

/** Snapshot for non-React code (export, share). */
export function readState(): AppState {
  return getState();
}

/** Like useMovements, for non-React code: stored movements plus debts from group expenses. */
export function readAllMovements(): Movement[] {
  return allMovements(getState());
}

// ─── Sync plumbing (used by src/sync only) ────────────────────────────────────

export function readLocalData(): LocalData {
  const { contacts, groups, movements, expenses, sync } = getState();
  return { contacts, groups, movements, expenses, sync };
}

/** Applies a sync step to the latest state (the user may have edited meanwhile). */
export function updateLocalData(update: (d: LocalData) => LocalData): void {
  setState((s) => {
    const { contacts, groups, movements, expenses, sync } = s;
    const next = update({ contacts, groups, movements, expenses, sync });
    const changed = (Object.keys(next) as (keyof LocalData)[]).some((k) => next[k] !== s[k]);
    return changed ? { ...s, ...next } : s;
  });
}

/** After signing out: removes the account's data from this device (it stays in the cloud). */
export function clearAccountData(): void {
  setState((s) => ({ ...s, ...emptyRecords, sync: emptySyncMeta }));
  try {
    cleanupLocalReceipts(new Set());
  } catch {
    // best effort
  }
}
