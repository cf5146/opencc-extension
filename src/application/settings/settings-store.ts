import type { StoragePort } from '../../platform/types.js';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
  type Settings,
  type SettingsPatch,
} from './settings.js';

export interface SettingsStore {
  load(): Promise<Settings>;
  set(patch: SettingsPatch): Promise<Settings>;
  subscribe(listener: (settings: Settings) => void): () => void;
}

export function createSettingsStore(storage: StoragePort): SettingsStore {
  const load = async () =>
    normalizeSettings(await storage.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>));

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
