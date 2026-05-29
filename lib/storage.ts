import { storage } from 'wxt/utils/storage';

import {
  DEFAULT_ORIGIN,
  DEFAULT_TARGET,
  DEFAULT_THEME,
  type ThemeMode,
  type VariantCode,
} from './constants';

export interface ExtensionSettings {
  origin: VariantCode;
  target: VariantCode;
  autoMode: boolean;
  theme: ThemeMode;
}

export interface SitePreference {
  origin: VariantCode;
  target: VariantCode;
}

export interface DomainList {
  blocklist: string[];
  allowlist: string[];
}

export const defaultSettings: ExtensionSettings = {
  origin: DEFAULT_ORIGIN,
  target: DEFAULT_TARGET,
  autoMode: false,
  theme: DEFAULT_THEME,
};

export const settingsItem = storage.defineItem<ExtensionSettings>('sync:settings', {
  fallback: defaultSettings,
  version: 1,
});

export const sitePreferencesItem = storage.defineItem<Record<string, SitePreference>>(
  'sync:sitePreferences',
  {
    fallback: {},
    version: 1,
  },
);

export const domainListItem = storage.defineItem<DomainList>('sync:domainList', {
  fallback: {
    blocklist: [],
    allowlist: [],
  },
  version: 1,
});

export async function saveSitePreference(
  hostname: string,
  preference: SitePreference,
): Promise<void> {
  if (!hostname) {
    return;
  }

  const preferences = { ...(await sitePreferencesItem.getValue()) };
  preferences[hostname] = preference;
  await sitePreferencesItem.setValue(preferences);
}
