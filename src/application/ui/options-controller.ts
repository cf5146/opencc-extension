import type { ExtensionPlatform } from "../../platform/types.js";
import { DEFAULT_SETTINGS } from "../settings/settings.js";
import { createSettingsStore, type SettingsStore } from "../settings/settings-store.js";

const PERSIST_DEBOUNCE_MS = 500;

export interface OptionsElements {
  whitelist: HTMLTextAreaElement;
}

export interface OptionsController {
  initialize(): Promise<void>;
  dispose(): void;
}

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export function createOptionsController(
  platform: ExtensionPlatform,
  elements: OptionsElements,
  settingsStore: SettingsStore = createSettingsStore(platform.storage),
): OptionsController {
  let disposed = false;
  let initializing: Promise<void> | undefined;
  let persistTimer: TimerHandle | undefined;
  let ready = false;
  let writeQueue: Promise<void> | undefined;

  const displayPattern = (pattern: string) => pattern.replaceAll("[^ ]*", "*");
  const storagePattern = (pattern: string) => pattern.replaceAll("*", "[^ ]*");

  const persistWhitelist = () => {
    persistTimer = undefined;
    if (disposed || !ready) return;
    elements.whitelist.value = elements.whitelist.value.trim();
    const whitelist = elements.whitelist.value.split("\n").filter(Boolean).map(storagePattern);
    const write = async () => {
      if (!disposed) await settingsStore.set({ whitelist });
    };
    writeQueue = writeQueue !== undefined ? writeQueue.catch(() => {}).then(write).catch(() => {}) : write().catch(() => {});
  };

  const onInput = () => {
    if (disposed || !ready) return;
    elements.whitelist.value = elements.whitelist.value
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
    if (persistTimer !== undefined) globalThis.clearTimeout(persistTimer);
    persistTimer = globalThis.setTimeout(persistWhitelist, PERSIST_DEBOUNCE_MS);
  };

  elements.whitelist.disabled = true;

  const initialize = (): Promise<void> => {
    if (initializing !== undefined) return initializing;
    initializing = (async () => {
      let settings;
      try {
        settings = await settingsStore.load();
      } catch {
        settings = DEFAULT_SETTINGS;
      }
      if (disposed) return;
      elements.whitelist.value = settings.whitelist.map(displayPattern).join("\n");
      ready = true;
      elements.whitelist.disabled = false;
      elements.whitelist.addEventListener("input", onInput);
    })();
    return initializing;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    ready = false;
    if (persistTimer !== undefined) globalThis.clearTimeout(persistTimer);
    persistTimer = undefined;
    elements.whitelist.removeEventListener("input", onInput);
  };

  return { initialize, dispose };
}
