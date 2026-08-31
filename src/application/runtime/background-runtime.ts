import type { SettingsStore } from '../settings/settings-store.js';
import { PlatformError, type ExtensionPlatform } from '../../platform/types.js';
import type { ConversionResponse, RuntimeMessage } from '../../runtime/messages.js';

const selectionMenuId = 'convert-selection';
const convertPageMessage = { type: 'convert-page' } as const;

export interface BackgroundRuntime {
  start(): void;
  dispose(): void;
}

function hasUsableTabId(tab: Awaited<ReturnType<ExtensionPlatform['tabs']['getActive']>>): tab is NonNullable<typeof tab> {
  return tab !== undefined && Number.isFinite(tab.id);
}

function supportsContentScriptUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function unavailable(reason: 'no-active-tab' | 'unsupported-scheme' | 'injection-denied' | 'protected-page' | 'unsupported-capability'):
  ConversionResponse {
  return { kind: 'unavailable', reason };
}

function mapInjectionFailure(error: unknown): ConversionResponse {
  if (error instanceof PlatformError) {
    if (error.code === 'permission-denied') return unavailable('injection-denied');
    if (error.code === 'unsupported-capability') return unavailable('unsupported-capability');
  }
  return unavailable('protected-page');
}

export async function convertActiveTab(platform: ExtensionPlatform): Promise<ConversionResponse> {
  let tab: Awaited<ReturnType<ExtensionPlatform['tabs']['getActive']>>;
  try {
    tab = await platform.tabs.getActive();
  } catch {
    return { kind: 'internal-failure' };
  }

  if (!hasUsableTabId(tab)) return unavailable('no-active-tab');
  if (typeof tab.url !== 'string' || tab.url.length === 0) return unavailable('unsupported-capability');
  if (!supportsContentScriptUrl(tab.url)) {
    return unavailable('unsupported-scheme');
  }

  try {
    return await platform.tabs.send(tab.id, convertPageMessage);
  } catch (error) {
    if (!(error instanceof PlatformError) || error.code !== 'no-receiver') {
      return unavailable('protected-page');
    }
  }

  try {
    await platform.scripting.injectContentScript(tab.id);
  } catch (error) {
    return mapInjectionFailure(error);
  }

  try {
    return await platform.tabs.send(tab.id, convertPageMessage);
  } catch {
    return unavailable('protected-page');
  }
}

export function createBackgroundRuntime(platform: ExtensionPlatform, settingsStore: SettingsStore): BackgroundRuntime {
  const unsubscribers: Array<() => void> = [];
  let started = false;
  let lifecycle = 0;
  let badgeRequest = 0;
  let badgeWrite: Promise<void> = Promise.resolve();

  const updateBadge = (auto: boolean, expectedLifecycle: number) => {
    const request = ++badgeRequest;
    badgeWrite = badgeWrite
      .catch(() => {})
      .then(async () => {
        if (!started || lifecycle !== expectedLifecycle || request !== badgeRequest) return;
        await platform.action.setBadgeText(auto ? 'A' : '');
      })
      .catch(() => {});
  };

  const handleRuntimeMessage = async (message: RuntimeMessage): Promise<ConversionResponse | undefined> => {
    if (message.type !== 'convert-active-tab') return undefined;
    return convertActiveTab(platform);
  };

  const handleContextMenu = (info: { menuItemId: string | number; tabId?: number }) => {
    if (info.menuItemId !== selectionMenuId || typeof info.tabId !== 'number' || !Number.isFinite(info.tabId)) return;
    void platform.tabs.send(info.tabId, { type: 'convert-selection' }).catch(() => {});
  };

  const start = () => {
    if (started) return;
    started = true;
    const currentLifecycle = ++lifecycle;
    let settingsRevision = 0;
    const loadRevision = settingsRevision;

    void platform.contextMenus.ensureSelectionMenu().catch(() => {});
    void platform.action.setBadgeBackgroundColor('white').catch(() => {});
    void settingsStore.load().then(
      (settings) => {
        if (started && lifecycle === currentLifecycle && settingsRevision === loadRevision) {
          updateBadge(settings.auto, currentLifecycle);
        }
      },
      () => {},
    );
    unsubscribers.push(
      platform.runtime.subscribe(handleRuntimeMessage),
      platform.contextMenus.subscribe(handleContextMenu),
      settingsStore.subscribe((settings) => {
        if (!started || lifecycle !== currentLifecycle) return;
        settingsRevision += 1;
        updateBadge(settings.auto, currentLifecycle);
      }),
    );
  };

  const dispose = () => {
    if (!started) return;
    started = false;
    lifecycle += 1;
    for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
  };

  return { start, dispose };
}