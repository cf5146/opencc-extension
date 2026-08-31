import { vi } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '../../src/application/settings/settings.js';
import type { Settings, SettingsPatch } from '../../src/application/settings/settings.js';
import type { SettingsStore } from '../../src/application/settings/settings-store.js';
import type {
  ActionPort,
  ContextMenuClickInfo,
  ExtensionPlatform,
  RuntimeMessageListener,
  RuntimePort,
  ScriptingPort,
  StoragePort,
  TabsPort,
} from '../../src/platform/types.js';
import type { RuntimeMessage } from '../../src/runtime/messages.js';

export type FakePlatformOverrides = {
  storage?: Partial<StoragePort>;
  runtime?: Partial<RuntimePort>;
  tabs?: Partial<TabsPort>;
  scripting?: Partial<ScriptingPort>;
  contextMenus?: Partial<ExtensionPlatform['contextMenus']>;
  action?: Partial<ActionPort>;
  getManifest?: ExtensionPlatform['getManifest'];
};

export function createFakePlatform(overrides: FakePlatformOverrides = {}): ExtensionPlatform {
  const noOpResponse = { kind: 'no-op' as const, count: 0 as const, time: 0 };
  return {
    storage: {
      get: async (defaults) => defaults,
      set: async () => {},
      subscribe: () => () => {},
      ...overrides.storage,
    } as StoragePort,
    runtime: {
      send: async <TResponse>() => noOpResponse as TResponse,
      subscribe: () => () => {},
      ...overrides.runtime,
    } as RuntimePort,
    tabs: {
      getActive: async () => undefined,
      send: async <TResponse>() => noOpResponse as TResponse,
      ...overrides.tabs,
    } as TabsPort,
    scripting: {
      injectContentScript: async () => {},
      ...overrides.scripting,
    } as ScriptingPort,
    contextMenus: {
      ensureSelectionMenu: async () => {},
      subscribe: () => () => {},
      ...overrides.contextMenus,
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
      ...overrides.action,
    },
    getManifest: overrides.getManifest ?? (() => ({})),
  };
}

export interface FakeSettingsStore extends SettingsStore {
  emit(next: Partial<Settings>): Promise<void>;
}

export function createFakeSettingsStore(initial: Partial<Settings> = {}): FakeSettingsStore {
  let current = mergeSettings(DEFAULT_SETTINGS, initial);
  const listeners = new Set<(settings: Settings) => void>();
  return {
    load: async () => current,
    set: async (patch: SettingsPatch) => {
      current = mergeSettings(current, patch);
      for (const listener of listeners) listener(current);
      return current;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: async (next) => {
      current = mergeSettings(current, next);
      for (const listener of listeners) listener(current);
    },
  };
}

export function createRuntimeListenerCapture() {
  let listener: RuntimeMessageListener | undefined;
  return {
    subscribe: (candidate: RuntimeMessageListener) => {
      listener = candidate;
      return () => {
        listener = undefined;
      };
    },
    invoke: (message: RuntimeMessage, sender = {}) => {
      if (!listener) throw new Error('runtime listener is not registered');
      return listener(message, sender);
    },
  };
}

export function createContextMenuDispatcher() {
  let listener: ((info: ContextMenuClickInfo) => void) | undefined;
  return {
    subscribe: (candidate: (info: ContextMenuClickInfo) => void) => {
      listener = candidate;
      return () => {
        listener = undefined;
      };
    },
    emit: (info: ContextMenuClickInfo) => listener?.(info),
  };
}

export function createRecordingConversionOperations() {
  return {
    convertTextNode: vi.fn().mockReturnValue(true),
    convertDocument: vi.fn().mockReturnValue(1),
    convertTitle: vi.fn(),
    convertSelection: vi.fn().mockReturnValue(false),
    hasConverted: vi.fn().mockReturnValue(false),
    resetCaches: vi.fn(),
  };
}
