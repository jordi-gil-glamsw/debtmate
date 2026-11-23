// Web persistence: the browser's localStorage (avoids expo-sqlite's WASM/COOP-COEP setup on web).
export function loadRaw(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function saveRaw(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, SSR): keep working in memory.
  }
}
