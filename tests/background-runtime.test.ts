import { describe, expect, it, vi } from 'vitest';
import { convertActiveTab, createBackgroundRuntime } from '../src/application/runtime/background-runtime.js';
import { PlatformError, type ActiveTab } from '../src/platform/types.js';
import type { Settings } from '../src/application/settings/settings.js';
import {
  createContextMenuDispatcher,
  createFakePlatform,
  createFakeSettingsStore,
  createRuntimeListenerCapture,
} from './helpers/fakes.js';

const flushAsyncWork = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeSettings(auto: boolean): Settings {
  return {
    origin: 'cn',
    target: 'hk',
    auto,
    whitelist: [],
    textboxSize: { width: null, height: null },
  };
}

describe('convertActiveTab', () => {
  it('injects once and retries when the content script is missing', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new PlatformError('no-receiver', 'Receiving end does not exist'))
      .mockResolvedValueOnce({ kind: 'success', count: 3, time: 12 });
    const inject = vi.fn().mockResolvedValue(undefined);
    const platform = createFakePlatform({
      tabs: {
        getActive: vi.fn().mockResolvedValue({ id: 11, url: 'https://example.com' }),
        send,
      },
      scripting: { injectContentScript: inject },
    });

    const result = await convertActiveTab(platform);

    expect(inject).toHaveBeenCalledOnce();
    expect(inject).toHaveBeenCalledWith(11);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, 11, { type: 'convert-page' });
    expect(send).toHaveBeenNthCalledWith(2, 11, { type: 'convert-page' });
    expect(result).toEqual({ kind: 'success', count: 3, time: 12 });
  });

  it('returns no-active-tab without messaging or injection', async () => {
    const getActive = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn();
    const inject = vi.fn();
    const platform = createFakePlatform({ tabs: { getActive, send }, scripting: { injectContentScript: inject } });

    await expect(convertActiveTab(platform)).resolves.toEqual({ kind: 'unavailable', reason: 'no-active-tab' });
    expect(send).not.toHaveBeenCalled();
    expect(inject).not.toHaveBeenCalled();
  });

  it('returns unsupported-scheme without messaging or injection', async () => {
    const send = vi.fn();
    const inject = vi.fn();
    const platform = createFakePlatform({
      tabs: {
        getActive: vi.fn().mockResolvedValue({ id: 7, url: 'chrome://settings' }),
        send,
      },
      scripting: { injectContentScript: inject },
    });

    await expect(convertActiveTab(platform)).resolves.toEqual({ kind: 'unavailable', reason: 'unsupported-scheme' });
    expect(send).not.toHaveBeenCalled();
    expect(inject).not.toHaveBeenCalled();
  });

  it('returns no-active-tab for a non-finite tab ID', async () => {
    const getActive = vi.fn().mockResolvedValue({ id: Number.NaN } as ActiveTab);
    const send = vi.fn();
    const inject = vi.fn();
    const platform = createFakePlatform({ tabs: { getActive, send }, scripting: { injectContentScript: inject } });

    await expect(convertActiveTab(platform)).resolves.toEqual({ kind: 'unavailable', reason: 'no-active-tab' });
    expect(send).not.toHaveBeenCalled();
    expect(inject).not.toHaveBeenCalled();
  });

  it('returns unsupported-capability when the active tab URL is unavailable', async () => {
    const getActive = vi.fn().mockResolvedValue({ id: 7 } as ActiveTab);
    const send = vi.fn();
    const inject = vi.fn();
    const platform = createFakePlatform({ tabs: { getActive, send }, scripting: { injectContentScript: inject } });

    await expect(convertActiveTab(platform)).resolves.toEqual({
      kind: 'unavailable',
      reason: 'unsupported-capability',
    });
    expect(send).not.toHaveBeenCalled();
    expect(inject).not.toHaveBeenCalled();
  });

  it('maps injection permission failures to injection-denied', async () => {
    const send = vi.fn().mockRejectedValue(new PlatformError('no-receiver', 'Receiving end does not exist'));
    const inject = vi.fn().mockRejectedValue(new PlatformError('permission-denied', 'Page access denied'));
    const platform = createFakePlatform({
      tabs: { getActive: vi.fn().mockResolvedValue({ id: 8, url: 'https://example.com' }), send },
      scripting: { injectContentScript: inject },
    });

    await expect(convertActiveTab(platform)).resolves.toEqual({ kind: 'unavailable', reason: 'injection-denied' });
    expect(send).toHaveBeenCalledOnce();
    expect(inject).toHaveBeenCalledOnce();
  });

  it('maps unsupported scripting to unsupported-capability', async () => {
    const send = vi.fn().mockRejectedValue(new PlatformError('no-receiver', 'Receiving end does not exist'));
    const inject = vi.fn().mockRejectedValue(new PlatformError('unsupported-capability', 'Injection unavailable'));
    const platform = createFakePlatform({
      tabs: { getActive: vi.fn().mockResolvedValue({ id: 9, url: 'https://example.com' }), send },
      scripting: { injectContentScript: inject },
    });

    await expect(convertActiveTab(platform)).resolves.toEqual({
      kind: 'unavailable',
      reason: 'unsupported-capability',
    });
  });

  it('maps unexpected injection failures to protected-page', async () => {
    const send = vi.fn().mockRejectedValue(new PlatformError('no-receiver', 'Receiving end does not exist'));
    const inject = vi.fn().mockRejectedValue(new PlatformError('request-failed', 'execution failed'));
    const platform = createFakePlatform({
      tabs: { getActive: vi.fn().mockResolvedValue({ id: 12, url: 'https://example.com' }), send },
      scripting: { injectContentScript: inject },
    });

    await expect(convertActiveTab(platform)).resolves.toEqual({ kind: 'unavailable', reason: 'protected-page' });
  });

  it('maps protected-page send failures without retrying', async () => {
    const send = vi.fn().mockRejectedValue(new PlatformError('request-failed', 'Cannot access contents of the page'));
    const inject = vi.fn();
    const platform = createFakePlatform({
      tabs: { getActive: vi.fn().mockResolvedValue({ id: 10, url: 'https://example.com' }), send },
      scripting: { injectContentScript: inject },
    });

    await expect(convertActiveTab(platform)).resolves.toEqual({ kind: 'unavailable', reason: 'protected-page' });
    expect(send).toHaveBeenCalledOnce();
    expect(inject).not.toHaveBeenCalled();
  });

  it('maps a failed retry to protected-page after one injection', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new PlatformError('no-receiver', 'Receiving end does not exist'))
      .mockRejectedValueOnce(new PlatformError('no-receiver', 'Receiving end does not exist'));
    const inject = vi.fn().mockResolvedValue(undefined);
    const platform = createFakePlatform({
      tabs: { getActive: vi.fn().mockResolvedValue({ id: 11, url: 'https://example.com' }), send },
      scripting: { injectContentScript: inject },
    });

    await expect(convertActiveTab(platform)).resolves.toEqual({ kind: 'unavailable', reason: 'protected-page' });
    expect(inject).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('background runtime', () => {
  it('uses the context-menu event tab ID without querying the active tab', async () => {
    const send = vi.fn().mockResolvedValue({ kind: 'no-op', count: 0, time: 0 });
    const getActive = vi.fn();
    const dispatch = createContextMenuDispatcher();
    const platform = createFakePlatform({
      tabs: { getActive, send },
      contextMenus: {
        ensureSelectionMenu: vi.fn().mockResolvedValue(undefined),
        subscribe: dispatch.subscribe,
      },
    });
    const runtime = createBackgroundRuntime(platform, createFakeSettingsStore());
    runtime.start();

    dispatch.emit({ menuItemId: 'convert-selection', tabId: 42 });
    await flushAsyncWork();

    expect(send).toHaveBeenCalledWith(42, { type: 'convert-selection' });
    expect(getActive).not.toHaveBeenCalled();
  });

  it('ignores context-menu events without the selection ID or tab ID', async () => {
    const send = vi.fn().mockResolvedValue({ kind: 'no-op', count: 0, time: 0 });
    const dispatch = createContextMenuDispatcher();
    const runtime = createBackgroundRuntime(
      createFakePlatform({ tabs: { send }, contextMenus: { subscribe: dispatch.subscribe } }),
      createFakeSettingsStore(),
    );
    runtime.start();

    dispatch.emit({ menuItemId: 'other-action', tabId: 42 });
    dispatch.emit({ menuItemId: 'convert-selection' });
    await flushAsyncWork();

    expect(send).not.toHaveBeenCalled();
  });

  it('handles active-tab runtime messages and ignores content messages', async () => {
    const capture = createRuntimeListenerCapture();
    const send = vi.fn().mockResolvedValue({ kind: 'success', count: 2, time: 5 });
    const platform = createFakePlatform({
      runtime: { subscribe: capture.subscribe },
      tabs: {
        getActive: vi.fn().mockResolvedValue({ id: 13, url: 'https://example.com' }),
        send,
      },
    });
    const runtime = createBackgroundRuntime(platform, createFakeSettingsStore());
    runtime.start();

    await expect(capture.invoke({ type: 'convert-active-tab' })).resolves.toEqual({
      kind: 'success',
      count: 2,
      time: 5,
    });
    await expect(capture.invoke({ type: 'convert-page' })).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledOnce();
  });

  it('initializes and updates the auto-mode badge and selection menu', async () => {
    const ensureSelectionMenu = vi.fn().mockResolvedValue(undefined);
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
    const settingsStore = createFakeSettingsStore({ auto: true });
    const runtime = createBackgroundRuntime(
      createFakePlatform({
        contextMenus: { ensureSelectionMenu },
        action: { setBadgeText, setBadgeBackgroundColor },
      }),
      settingsStore,
    );

    runtime.start();
    await flushAsyncWork();
    expect(ensureSelectionMenu).toHaveBeenCalledOnce();
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith('white');
    expect(setBadgeText).toHaveBeenCalledWith('A');

    await settingsStore.emit({ auto: false });
    await flushAsyncWork();
    expect(setBadgeText).toHaveBeenLastCalledWith('');
  });

  it('does not let a stale initial settings load overwrite a newer badge update', async () => {
    let resolveLoad!: (settings: Settings) => void;
    let settingsListener: ((settings: Settings) => void) | undefined;
    const settingsStore = {
      load: vi.fn(() => new Promise<Settings>((resolve) => { resolveLoad = resolve; })),
      set: vi.fn(),
      subscribe: vi.fn((listener: (settings: Settings) => void) => {
        settingsListener = listener;
        return () => { settingsListener = undefined; };
      }),
    };
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const runtime = createBackgroundRuntime(
      createFakePlatform({ action: { setBadgeText } }),
      settingsStore,
    );

    runtime.start();
    settingsListener?.(makeSettings(true));
    resolveLoad(makeSettings(false));
    await flushAsyncWork();

    expect(setBadgeText).toHaveBeenLastCalledWith('A');
    expect(setBadgeText).not.toHaveBeenCalledWith('');
    runtime.dispose();
  });

  it('ignores an initial badge load from a disposed runtime after restart', async () => {
    const resolvers: Array<(settings: Settings) => void> = [];
    const settingsStore = {
      load: vi.fn(() => new Promise<Settings>((resolve) => { resolvers.push(resolve); })),
      set: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const runtime = createBackgroundRuntime(
      createFakePlatform({ action: { setBadgeText } }),
      settingsStore,
    );

    runtime.start();
    runtime.dispose();
    runtime.start();
    resolvers[0]?.(makeSettings(false));
    resolvers[1]?.(makeSettings(true));
    await flushAsyncWork();

    expect(setBadgeText).toHaveBeenCalledOnce();
    expect(setBadgeText).toHaveBeenLastCalledWith('A');
    runtime.dispose();
  });

  it('ignores a stale settings subscription callback after dispose and restart', async () => {
    const listeners: Array<(settings: Settings) => void> = [];
    const resolvers: Array<(settings: Settings) => void> = [];
    const settingsStore = {
      load: vi.fn(
        () =>
          new Promise<Settings>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
      set: vi.fn(),
      subscribe: vi.fn((listener: (settings: Settings) => void) => {
        listeners.push(listener);
        return () => {};
      }),
    };
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const runtime = createBackgroundRuntime(
      createFakePlatform({ action: { setBadgeText } }),
      settingsStore,
    );

    runtime.start();
    runtime.dispose();
    runtime.start();
    listeners[0]?.(makeSettings(false));
    listeners[1]?.(makeSettings(true));
    resolvers[0]?.(makeSettings(false));
    resolvers[1]?.(makeSettings(false));
    await flushAsyncWork();

    expect(setBadgeText).toHaveBeenCalledOnce();
    expect(setBadgeText).toHaveBeenLastCalledWith('A');
    runtime.dispose();
  });

  it('serializes badge writes so an older write cannot finish after a newer state', async () => {
    let resolveFirst!: () => void;
    let listener: ((settings: Settings) => void) | undefined;
    const settingsStore = {
      load: vi.fn(() => new Promise<Settings>(() => {})),
      set: vi.fn(),
      subscribe: vi.fn((candidate: (settings: Settings) => void) => {
        listener = candidate;
        return () => {};
      }),
    };
    const setBadgeText = vi.fn((text: string) => {
      if (setBadgeText.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve();
    });
    const runtime = createBackgroundRuntime(
      createFakePlatform({ action: { setBadgeText } }),
      settingsStore,
    );

    runtime.start();
    listener?.(makeSettings(true));
    await flushAsyncWork();
    expect(setBadgeText).toHaveBeenLastCalledWith('A');

    listener?.(makeSettings(false));
    await Promise.resolve();
    expect(setBadgeText).toHaveBeenCalledTimes(1);

    resolveFirst();
    await flushAsyncWork();
    expect(setBadgeText).toHaveBeenNthCalledWith(1, 'A');
    expect(setBadgeText).toHaveBeenNthCalledWith(2, '');
    runtime.dispose();
  });

  it('removes all subscriptions on dispose', async () => {
    const runtimeUnsubscribe = vi.fn();
    const menuUnsubscribe = vi.fn();
    const settingsUnsubscribe = vi.fn();
    const settingsStore = {
      load: vi.fn().mockResolvedValue({ origin: 'cn', target: 'hk', auto: false, whitelist: [], textboxSize: { width: null, height: null } }),
      set: vi.fn(),
      subscribe: vi.fn(() => settingsUnsubscribe),
    };
    const platform = createFakePlatform({
      runtime: { subscribe: vi.fn(() => runtimeUnsubscribe) },
      contextMenus: { subscribe: vi.fn(() => menuUnsubscribe) },
    });
    const runtime = createBackgroundRuntime(platform, settingsStore);

    runtime.start();
    runtime.dispose();

    expect(runtimeUnsubscribe).toHaveBeenCalledOnce();
    expect(menuUnsubscribe).toHaveBeenCalledOnce();
    expect(settingsUnsubscribe).toHaveBeenCalledOnce();
  });

  it('stops handling runtime messages after dispose', async () => {
    const capture = createRuntimeListenerCapture();
    const send = vi.fn();
    const runtime = createBackgroundRuntime(
      createFakePlatform({
        runtime: { subscribe: capture.subscribe },
        tabs: { send },
      }),
      createFakeSettingsStore(),
    );

    runtime.start();
    runtime.dispose();

    expect(() => capture.invoke({ type: 'convert-active-tab' })).toThrow('runtime listener is not registered');
    expect(send).not.toHaveBeenCalled();
  });
});