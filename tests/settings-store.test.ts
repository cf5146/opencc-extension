import { describe, expect, it } from 'vitest';
import { createRemoteSettingsStore, createSettingsStore } from '../src/application/settings/settings-store.js';
import { createFakePlatform } from './helpers/fakes.js';
import { DEFAULT_SETTINGS } from '../src/application/settings/settings.js';
import type { StorageChange } from '../src/platform/types.js';

describe('settings store', () => {
  it('sends UI mutations to the background and reports failures', async () => {
    const messages: unknown[] = [];
    const store = createRemoteSettingsStore(
      createFakePlatform({
        runtime: {
          send: async <TResponse>(message: unknown) => {
            messages.push(message);
            return (
              messages.length === 1
                ? { kind: 'settings-success', settings: { ...DEFAULT_SETTINGS, auto: true } }
                : { kind: 'settings-failure', reason: 'write-failed' }
            ) as TResponse;
          },
        },
      }),
    );
    expect((await store.set({ auto: true })).auto).toBe(true);
    await expect(store.setSiteRule!('example.com', 'never')).rejects.toThrow();
    expect(messages).toEqual([
      { type: 'settings-patch', patch: { auto: true } },
      { type: 'settings-site-rule', hostname: 'example.com', rule: 'never' },
    ]);
  });
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
