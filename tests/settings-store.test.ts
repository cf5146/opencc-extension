import { describe, expect, it } from 'vitest';
import { createSettingsStore } from '../src/application/settings/settings-store.js';
import type { StorageChange } from '../src/platform/types.js';

describe('settings store', () => {
  it('loads, normalizes, writes, and notifies through the storage port', async () => {
    let stored: Record<string, unknown> = { origin: 'cn', target: 'hk', auto: false };
    let notify: ((changes: Record<string, StorageChange>, area: string) => void) | undefined;
    const storage = {
      get: async () => stored,
      set: async (values: Record<string, unknown>) => {
        stored = values;
      },
      subscribe: (listener: (changes: Record<string, StorageChange>, area: string) => void) => {
        notify = listener;
        return () => {
          notify = undefined;
        };
      },
    };
    const store = createSettingsStore(storage);
    const seen: boolean[] = [];
    const unsubscribe = store.subscribe((settings) => seen.push(settings.auto));

    await store.set({ auto: true });
    notify?.({}, 'local');
    await Promise.resolve();

    expect((await store.load()).auto).toBe(true);
    expect(seen).toEqual([true]);
    unsubscribe();
  });
});
