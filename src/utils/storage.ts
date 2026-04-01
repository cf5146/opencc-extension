import { storage } from '#imports';

export type LocaleCode = 'cn' | 'hk' | 'tw' | 'twp' | 'jp';

export const SUPPORTED_LOCALES: readonly LocaleCode[] = ['cn', 'hk', 'tw', 'twp', 'jp'];

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export const originSetting = storage.defineItem<LocaleCode>('local:origin', {
  fallback: 'cn',
});

export const targetSetting = storage.defineItem<LocaleCode>('local:target', {
  fallback: 'hk',
});

export const autoSetting = storage.defineItem<boolean>('local:auto', {
  fallback: false,
});

export const whitelistSetting = storage.defineItem<string[]>('local:whitelist', {
  fallback: [],
});

export const textboxSizeSetting = storage.defineItem<{ width: number | null; height: number | null }>(
  'local:textboxSize',
  {
    fallback: { width: null, height: null },
  },
);
