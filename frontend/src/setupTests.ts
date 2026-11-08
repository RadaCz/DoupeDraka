import '@testing-library/jest-dom';

/**
 * Recent Node versions define a global `localStorage` accessor that resolves to
 * undefined unless the process is started with `--localstorage-file`, and it
 * shadows the one jsdom provides. The app stores its bearer token there, so tests
 * need a working implementation. Prefer jsdom's; otherwise install an in-memory
 * Storage with the same surface.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const usableStorage = (() => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: usableStorage ?? new MemoryStorage(),
  configurable: true,
  writable: true,
});