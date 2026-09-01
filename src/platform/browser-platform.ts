import { browser } from 'wxt/browser';
import type { ContentRequest, ConversionResponse, RuntimeMessage } from '../runtime/messages.js';
import {
  PlatformError,
  type ContextMenuClickInfo,
  type ExtensionPlatform,
  type MessageSender,
  type RuntimeManifest,
  type StorageChange,
} from './types.js';

const selectionMenuId = 'convert-selection';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return String(error);
}

function isNoReceiverError(error: unknown): boolean {
  return /receiving end does not exist|could not establish connection|message port closed before a response was received/i.test(
    errorMessage(error),
  );
}

function isPermissionError(error: unknown): boolean {
  return /access denied|cannot access (?:contents of )?the page|forbidden|not allowed|permission/i.test(
    errorMessage(error),
  );
}

function isMissingMenuError(error: unknown): boolean {
  return /no menu item|menu item.*(?:not found|does not exist)|not found/i.test(errorMessage(error));
}

function toPlatformError(code: PlatformError['code'], operation: string, error: unknown): PlatformError {
  if (error instanceof PlatformError) return error;
  return new PlatformError(code, `${operation}: ${errorMessage(error)}`);
}

function toMessageError(operation: string, error: unknown): PlatformError {
  return toPlatformError(isNoReceiverError(error) ? 'no-receiver' : 'request-failed', operation, error);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

function readLastError(api: typeof browser): unknown {
  return api.runtime.lastError;
}

function invokeCallbackApi(
  api: typeof browser,
  operation: string,
  invoke: (callback: () => void) => unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const complete = () => {
      if (settled) return;
      settled = true;
      const lastError = readLastError(api);
      if (lastError) {
        reject(toPlatformError('request-failed', operation, lastError));
      } else {
        resolve();
      }
    };

    let result: unknown;
    try {
      result = invoke(complete);
    } catch (error) {
      settled = true;
      reject(toPlatformError('request-failed', operation, error));
      return;
    }

    if (isPromiseLike(result)) {
      void result.then(complete, (error) => {
        if (settled) return;
        settled = true;
        reject(toPlatformError('request-failed', operation, error));
      });
    }
  });
}

function readRuntimeManifest(api: typeof browser): RuntimeManifest {
  const manifest = api.runtime.getManifest();
  const contentScripts = manifest.content_scripts as Array<{ js?: string[] }> | undefined;
  const runtimeManifest: RuntimeManifest = {};

  if (typeof manifest.version === 'string') runtimeManifest.version = manifest.version;
  if (contentScripts) {
    runtimeManifest.content_scripts = contentScripts.map((script) => ({
      js: script.js ? [...script.js] : undefined,
    }));
  }

  return runtimeManifest;
}

function getManifestContentScript(manifest: RuntimeManifest): string | undefined {
  return manifest.content_scripts
    ?.flatMap((script) => script.js ?? [])
    .find((file) => typeof file === 'string' && file.length > 0);
}

export function createBrowserPlatform(api: typeof browser = browser): ExtensionPlatform {
  return {
    storage: {
      get: async (defaults) => {
        try {
          return await api.storage.local.get(defaults);
        } catch (error) {
          throw toPlatformError('request-failed', 'storage.get', error);
        }
      },
      set: async (values) => {
        try {
          await api.storage.local.set(values);
        } catch (error) {
          throw toPlatformError('request-failed', 'storage.set', error);
        }
      },
      subscribe: (listener) => {
        const browserListener = (changes: Record<string, StorageChange>, areaName: string) => {
          listener(changes, areaName);
        };
        api.storage.onChanged.addListener(browserListener);
        return () => api.storage.onChanged.removeListener(browserListener);
      },
    },
    runtime: {
      send: async <TResponse extends ConversionResponse>(message: RuntimeMessage) => {
        try {
          return await api.runtime.sendMessage<RuntimeMessage, TResponse>(message);
        } catch (error) {
          throw toMessageError('runtime.send', error);
        }
      },
      subscribe: (listener) => {
        const browserListener = (
          message: RuntimeMessage,
          sender: { tab?: { id?: number } },
          sendResponse: (response?: ConversionResponse) => void,
        ) => {
          void Promise.resolve()
            .then(() =>
              listener(message, {
                tabId: typeof sender?.tab?.id === 'number' ? sender.tab.id : undefined,
              } satisfies MessageSender),
            )
            .then(
              (response) => sendResponse(response),
              () => sendResponse({ kind: 'internal-failure' }),
            );
          return true;
        };
        api.runtime.onMessage.addListener(browserListener);
        return () => api.runtime.onMessage.removeListener(browserListener);
      },
    },
    tabs: {
      getActive: async () => {
        try {
          const tabs = (await api.tabs.query({ active: true, currentWindow: true })) as Array<{
            id?: number;
            url?: string;
          }>;
          const tab = tabs.find((candidate) => typeof candidate.id === 'number');
          return tab && typeof tab.id === 'number' ? { id: tab.id, url: tab.url } : undefined;
        } catch (error) {
          throw toPlatformError('request-failed', 'tabs.getActive', error);
        }
      },
      send: async <TResponse extends ConversionResponse>(tabId: number, message: ContentRequest) => {
        try {
          return await api.tabs.sendMessage<ContentRequest, TResponse>(tabId, message);
        } catch (error) {
          throw toMessageError('tabs.send', error);
        }
      },
    },
    scripting: {
      injectContentScript: async (tabId) => {
        const manifest = readRuntimeManifest(api);
        const contentScript = getManifestContentScript(manifest);
        if (!contentScript) {
          throw new PlatformError('unsupported-capability', 'No manifest-declared content script is available');
        }
        if (!api.scripting?.executeScript) {
          throw new PlatformError('unsupported-capability', 'Script injection is not available');
        }

        try {
          await api.scripting.executeScript({
            target: { tabId },
            files: [contentScript],
          });
        } catch (error) {
          throw toPlatformError(
            isPermissionError(error) ? 'permission-denied' : 'request-failed',
            'scripting.injectContentScript',
            error,
          );
        }
      },
    },
    contextMenus: {
      ensureSelectionMenu: async () => {
        try {
          await invokeCallbackApi(api, 'contextMenus.remove', (callback) => api.contextMenus.remove(selectionMenuId, callback));
        } catch (error) {
          if (!isMissingMenuError(error)) {
            throw toPlatformError('request-failed', 'contextMenus.remove', error);
          }
        }

        try {
          await invokeCallbackApi(api, 'contextMenus.create', (callback) =>
            api.contextMenus.create(
              {
                id: selectionMenuId,
                title: 'Convert Chinese Characters',
                contexts: ['selection'],
              },
              callback,
            ),
          );
        } catch (error) {
          throw toPlatformError('request-failed', 'contextMenus.create', error);
        }
      },
      subscribe: (listener) => {
        const browserListener = (
          info: { menuItemId: string | number },
          tab?: { id?: number },
        ) => {
          const menuInfo: ContextMenuClickInfo = {
            menuItemId: info.menuItemId,
            tabId: typeof tab?.id === 'number' ? tab.id : undefined,
          };
          listener(menuInfo);
        };
        api.contextMenus.onClicked.addListener(browserListener);
        return () => api.contextMenus.onClicked.removeListener(browserListener);
      },
    },
    action: {
      setBadgeText: async (text) => {
        try {
          await api.action.setBadgeText({ text });
        } catch (error) {
          throw toPlatformError('request-failed', 'action.setBadgeText', error);
        }
      },
      setBadgeBackgroundColor: async (color) => {
        try {
          await api.action.setBadgeBackgroundColor({ color });
        } catch (error) {
          throw toPlatformError('request-failed', 'action.setBadgeBackgroundColor', error);
        }
      },
    },
    getManifest: () => readRuntimeManifest(api),
  };
}
