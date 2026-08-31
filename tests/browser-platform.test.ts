import { describe, expect, it, vi } from 'vitest';
import { createBrowserPlatform } from '../src/platform/browser-platform.js';
import type { ContextMenuClickInfo, StorageChange } from '../src/platform/types.js';
import { PlatformError } from '../src/platform/types.js';
import type { RuntimeMessage } from '../src/runtime/messages.js';

type Listener<Arguments extends never[]> = (...args: Arguments) => unknown;

function createEvent<T extends Listener<never[]>>() {
  const listeners = new Set<T>();
  return {
    addListener: vi.fn((listener: T) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: T) => {
      listeners.delete(listener);
    }),
    emit: (...args: Parameters<T>) => [...listeners].map((listener) => listener(...args)),
    listenerCount: () => listeners.size,
  };
}

describe('browser platform', () => {
  it('delegates storage operations and removes its change listener on unsubscribe', async () => {
    const onChanged = createEvent<(changes: Record<string, StorageChange>, areaName: string) => void>();
    const get = vi.fn().mockResolvedValue({ auto: true });
    const set = vi.fn().mockResolvedValue(undefined);
    const platform = createBrowserPlatform({
      storage: { local: { get, set }, onChanged },
    } as never);
    const listener = vi.fn();
    const defaults = { auto: false };
    const values = { auto: true };
    const changes = { auto: { oldValue: false, newValue: true } };

    expect(await platform.storage.get(defaults)).toEqual({ auto: true });
    await platform.storage.set(values);

    expect(get).toHaveBeenCalledWith(defaults);
    expect(set).toHaveBeenCalledWith(values);

    const unsubscribe = platform.storage.subscribe(listener);
    onChanged.emit(changes, 'local');
    unsubscribe();
    onChanged.emit(changes, 'local');

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(changes, 'local');
    expect(onChanged.listenerCount()).toBe(0);
    expect(onChanged.removeListener).toHaveBeenCalledWith(onChanged.addListener.mock.calls[0]![0]);
  });

  it('maps storage failures to request-failed', async () => {
    const platform = createBrowserPlatform({
      storage: {
        local: {
          get: vi.fn().mockRejectedValue(new Error('storage unavailable')),
          set: vi.fn().mockRejectedValue(new Error('storage unavailable')),
        },
      },
    } as never);

    await expect(platform.storage.get({})).rejects.toMatchObject({ code: 'request-failed' });
    await expect(platform.storage.set({ auto: true })).rejects.toMatchObject({
      code: 'request-failed',
    });
  });

  it('bridges runtime callbacks, maps sender tabs, and cleans up the listener', async () => {
    const onMessage = createEvent<
      (message: RuntimeMessage, sender: { tab?: { id?: number } }, sendResponse: (response?: unknown) => void) => void
    >();
    const platform = createBrowserPlatform({
      runtime: { onMessage },
    } as never);
    const response = { kind: 'success' as const, count: 2, time: 4 };
    const listener = vi.fn().mockResolvedValue(response);
    const sendResponse = vi.fn();
    const message = { type: 'convert-page' as const };

    const unsubscribe = platform.runtime.subscribe(listener);
    const returns = onMessage.emit(message, { tab: { id: 31 } }, sendResponse);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(returns).toEqual([true]);
    expect(listener).toHaveBeenCalledWith(message, { tabId: 31 });
    expect(sendResponse).toHaveBeenCalledWith(response);

    unsubscribe();
    expect(onMessage.listenerCount()).toBe(0);
    expect(onMessage.removeListener).toHaveBeenCalledWith(onMessage.addListener.mock.calls[0]![0]);
  });

  it('returns an internal failure response when a runtime listener rejects', async () => {
    const onMessage = createEvent<
      (message: RuntimeMessage, sender: { tab?: { id?: number } }, sendResponse: (response?: unknown) => void) => void
    >();
    const platform = createBrowserPlatform({ runtime: { onMessage } } as never);
    const sendResponse = vi.fn();

    platform.runtime.subscribe(vi.fn().mockRejectedValue(new Error('handler failed')));
    onMessage.emit({ type: 'convert-page' }, {}, sendResponse);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(sendResponse).toHaveBeenCalledWith({ kind: 'internal-failure' });
  });

  it('delegates runtime messages and returns the response', async () => {
    const response = { kind: 'success' as const, count: 1, time: 3 };
    const sendMessage = vi.fn().mockResolvedValue(response);
    const platform = createBrowserPlatform({ runtime: { sendMessage } } as never);

    await expect(platform.runtime.send({ type: 'convert-active-tab' })).resolves.toEqual(response);
    expect(sendMessage).toHaveBeenCalledWith({ type: 'convert-active-tab' });
  });

  it('looks up the first active tab with a numeric ID', async () => {
    const query = vi.fn().mockResolvedValue([{ url: 'about:blank' }, { id: 7, url: 'https://example.com/page' }]);
    const platform = createBrowserPlatform({ tabs: { query } } as never);

    expect(await platform.tabs.getActive()).toEqual({ id: 7, url: 'https://example.com/page' });
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
  });

  it('maps active-tab query failures to request-failed', async () => {
    const platform = createBrowserPlatform({
      tabs: { query: vi.fn().mockRejectedValue(new Error('query failed')) },
    } as never);

    await expect(platform.tabs.getActive()).rejects.toMatchObject({ code: 'request-failed' });
  });

  it('maps a missing message receiver to no-receiver', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'));
    const platform = createBrowserPlatform({ tabs: { sendMessage } } as never);

    await expect(platform.tabs.send(7, { type: 'convert-page' })).rejects.toMatchObject({
      code: 'no-receiver',
    });
  });

  it('maps other tab message failures to request-failed', async () => {
    const platform = createBrowserPlatform({
      tabs: { sendMessage: vi.fn().mockRejectedValue(new Error('tab is protected')) },
    } as never);

    await expect(platform.tabs.send(7, { type: 'convert-page' })).rejects.toMatchObject({
      code: 'request-failed',
    });
  });

  it('injects the first manifest-declared content script path', async () => {
    const executeScript = vi.fn().mockResolvedValue([]);
    const getManifest = vi.fn().mockReturnValue({
      version: '0.5.10',
      content_scripts: [{ js: ['content-entrypoint-abc123.js', 'other.js'] }],
    });
    const platform = createBrowserPlatform({
      runtime: { getManifest },
      scripting: { executeScript },
    } as never);

    await platform.scripting.injectContentScript(9);

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 9 },
      files: ['content-entrypoint-abc123.js'],
    });
    expect(executeScript).not.toHaveBeenCalledWith(expect.objectContaining({ files: ['content.js'] }));
    expect(platform.getManifest()).toEqual({
      version: '0.5.10',
      content_scripts: [{ js: ['content-entrypoint-abc123.js', 'other.js'] }],
    });
  });

  it('reports a missing content script as unsupported-capability', async () => {
    const platform = createBrowserPlatform({
      runtime: { getManifest: () => ({}) },
      scripting: { executeScript: vi.fn() },
    } as never);

    await expect(platform.scripting.injectContentScript(9)).rejects.toMatchObject({
      code: 'unsupported-capability',
    });
  });

  it('maps denied and unexpected injection failures separately', async () => {
    const denied = createBrowserPlatform({
      runtime: { getManifest: () => ({ content_scripts: [{ js: ['generated.js'] }] }) },
      scripting: {
        executeScript: vi
          .fn()
          .mockRejectedValue(new Error('Cannot access contents of the page. Extension manifest must request permission.')),
      },
    } as never);
    const unexpected = createBrowserPlatform({
      runtime: { getManifest: () => ({ content_scripts: [{ js: ['generated.js'] }] }) },
      scripting: { executeScript: vi.fn().mockRejectedValue(new Error('execution failed')) },
    } as never);

    await expect(denied.scripting.injectContentScript(9)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(unexpected.scripting.injectContentScript(9)).rejects.toMatchObject({
      code: 'request-failed',
    });
  });

  it('removes and recreates the selection context menu', async () => {
    const onClicked = createEvent<(info: { menuItemId: string | number }, tab?: { id?: number }) => void>();
    const remove = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn((_properties: Record<string, unknown>, callback?: () => void) => {
      callback?.();
      return 'convert-selection';
    });
    const platform = createBrowserPlatform({
      runtime: { lastError: undefined },
      contextMenus: { remove, create, onClicked },
    } as never);

    await platform.contextMenus.ensureSelectionMenu();

    expect(remove).toHaveBeenCalledWith('convert-selection', expect.any(Function));
    expect(create.mock.calls[0]![0]).toEqual({
      id: 'convert-selection',
      title: 'Convert Chinese Characters',
      contexts: ['selection'],
    });
  });

  it('ignores a missing selection menu during recreation', async () => {
    let lastError: { message: string } | undefined = { message: 'No menu item with id convert-selection' };
    const remove = vi.fn((_id: string, callback: () => void) => {
      callback();
    });
    const create = vi.fn((_properties: Record<string, unknown>, callback: () => void) => {
      lastError = undefined;
      callback();
      return 'convert-selection';
    });
    const platform = createBrowserPlatform({
      runtime: {
        get lastError() {
          return lastError;
        },
      },
      contextMenus: { remove, create },
    } as never);

    await platform.contextMenus.ensureSelectionMenu();

    expect(create).toHaveBeenCalledOnce();
  });

  it('maps context-menu creation runtime.lastError to request-failed', async () => {
    let lastError: { message: string } | undefined;
    const remove = vi.fn((_id: string, callback: () => void) => callback());
    const create = vi.fn((_properties: Record<string, unknown>, callback: () => void) => {
      lastError = { message: 'Context menu creation failed' };
      callback();
      return 'convert-selection';
    });
    const platform = createBrowserPlatform({
      runtime: {
        get lastError() {
          return lastError;
        },
      },
      contextMenus: { remove, create },
    } as never);

    await expect(platform.contextMenus.ensureSelectionMenu()).rejects.toMatchObject({
      code: 'request-failed',
    });
  });

  it('bridges context-menu tab IDs and removes its click listener on unsubscribe', () => {
    const onClicked = createEvent<(info: { menuItemId: string | number }, tab?: { id?: number }) => void>();
    const platform = createBrowserPlatform({ contextMenus: { onClicked } } as never);
    const listener = vi.fn<(info: ContextMenuClickInfo) => void>();

    const unsubscribe = platform.contextMenus.subscribe(listener);
    onClicked.emit({ menuItemId: 'convert-selection' }, { id: 42 });
    unsubscribe();
    onClicked.emit({ menuItemId: 'convert-selection' }, { id: 43 });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ menuItemId: 'convert-selection', tabId: 42 });
    expect(onClicked.listenerCount()).toBe(0);
    expect(onClicked.removeListener).toHaveBeenCalledWith(onClicked.addListener.mock.calls[0]![0]);
  });

  it('delegates badge text and background color calls', async () => {
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
    const platform = createBrowserPlatform({
      action: { setBadgeText, setBadgeBackgroundColor },
    } as never);

    await platform.action.setBadgeText('A');
    await platform.action.setBadgeBackgroundColor('white');

    expect(setBadgeText).toHaveBeenCalledWith({ text: 'A' });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: 'white' });
  });

  it('maps badge operation failures to request-failed', async () => {
    const platform = createBrowserPlatform({
      action: {
        setBadgeText: vi.fn().mockRejectedValue(new Error('badge failed')),
        setBadgeBackgroundColor: vi.fn().mockRejectedValue(new Error('badge failed')),
      },
    } as never);

    await expect(platform.action.setBadgeText('A')).rejects.toMatchObject({ code: 'request-failed' });
    await expect(platform.action.setBadgeBackgroundColor('white')).rejects.toMatchObject({
      code: 'request-failed',
    });
  });
});