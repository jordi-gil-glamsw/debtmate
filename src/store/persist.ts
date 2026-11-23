// Native (iOS/Android) persistence: SQLite-backed key-value store from expo-sqlite.
import Storage from 'expo-sqlite/kv-store';

export function loadRaw(key: string): string | null {
  return Storage.getItemSync(key);
}

export function saveRaw(key: string, value: string): void {
  Storage.setItemSync(key, value);
}
