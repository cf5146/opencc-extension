import type { ExtensionPlatform, StoragePort } from '../../platform/types.js';
import type { SettingsRequest, SettingsResponse } from '../../runtime/messages.js';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
  type Settings,
  type SettingsPatch,
  type SiteRule,
} from './settings.js';

export interface SettingsStore {
  load(): Promise<Settings>;
  set(patch: SettingsPatch): Promise<Settings>;
  setSiteRule?(hostname: string, rule: SiteRule | null): Promise<Settings>;
  subscribe(listener: (settings: Settings) => void): () => void;
}

export function createSettingsStore(storage: StoragePort): SettingsStore {
  const load = async () => normalizeSettings(await storage.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>));

  const set = async (patch: SettingsPatch) => {
    const next = mergeSettings(await load(), patch);
    await storage.set(next as unknown as Record<string, unknown>);
    return next;
  };

  const subscribe = (listener: (settings: Settings) => void) =>
    storage.subscribe((_changes, areaName) => {
      if (areaName !== 'local') return;
      void load()
        .then(listener)
        .catch(() => {});
    });

  return { load, set, subscribe };
}

export function createRemoteSettingsStore(platform: ExtensionPlatform): SettingsStore {
  const local = createSettingsStore(platform.storage);
  const mutate = async (request: SettingsRequest): Promise<Settings> => {
    const response = await platform.runtime.send<SettingsResponse>(request);
    if (response?.kind !== 'settings-success') {
      throw new Error(response?.kind === 'settings-failure' ? response.reason : 'Invalid settings response');
    }
    return normalizeSettings(response.settings);
  };
  return {
    load: local.load,
    subscribe: local.subscribe,
    set: (patch) => mutate({ type: 'settings-patch', patch }),
    setSiteRule: (hostname, rule) => mutate({ type: 'settings-site-rule', hostname, rule }),
  };
}
