import { describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  return {
    values,
    defineItem: vi.fn((key: string, options: { fallback: unknown }) => ({
      key,
      fallback: options.fallback,
      getValue: vi.fn(() => Promise.resolve(values.get(key) ?? options.fallback)),
      setValue: vi.fn((value: unknown) => {
        values.set(key, value);
        return Promise.resolve();
      }),
    })),
  };
});

vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: storageMock.defineItem,
  },
}));

const storageModule = await import('@/lib/storage');

describe('storage definitions', () => {
  it('provides default synced settings', () => {
    expect(storageModule.defaultSettings).toEqual({
      origin: 'cn',
      target: 'tw',
      autoMode: false,
      theme: 'system',
    });
  });

  it('defines sync-backed storage items', () => {
    expect(storageMock.defineItem).toHaveBeenCalledWith(
      'sync:settings',
      expect.objectContaining({ fallback: storageModule.defaultSettings, version: 1 }),
    );
    expect(storageMock.defineItem).toHaveBeenCalledWith(
      'sync:sitePreferences',
      expect.objectContaining({ fallback: {}, version: 1 }),
    );
    expect(storageMock.defineItem).toHaveBeenCalledWith(
      'sync:domainList',
      expect.objectContaining({ fallback: { blocklist: [], allowlist: [] }, version: 1 }),
    );
  });

  it('saves site preferences by hostname', async () => {
    await storageModule.saveSitePreference('example.com', { origin: 'cn', target: 'hk' });
    await storageModule.saveSitePreference('reader.example.com', { origin: 'tw', target: 'cn' });

    await expect(storageModule.sitePreferencesItem.getValue()).resolves.toEqual({
      'example.com': { origin: 'cn', target: 'hk' },
      'reader.example.com': { origin: 'tw', target: 'cn' },
    });
  });
});
