import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { createContentRuntime } from '../src/application/runtime/content-runtime.js';
import type { Settings } from '../src/application/settings/settings.js';
import type { SettingsStore } from '../src/application/settings/settings-store.js';
import {
  createFakePlatform,
  createFakeSettingsStore,
  createRecordingConversionOperations,
  createRuntimeListenerCapture,
} from './helpers/fakes.js';

function createDom() {
  return new JSDOM(
    '<!doctype html><html lang="zh"><head><title>title</title></head><body><p>source</p></body></html>',
    { url: 'https://example.com' },
  );
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    origin: 'cn',
    target: 'hk',
    auto: false,
    whitelist: [],
    textboxSize: { width: null, height: null },
    ...overrides,
  };
}

function createRuntime(
  dom: ReturnType<typeof createDom>,
  settingsStore: SettingsStore = createFakeSettingsStore(),
  operations = createRecordingConversionOperations(),
  now: () => number = () => 100,
) {
  const listener = createRuntimeListenerCapture();
  const platform = createFakePlatform({ runtime: { subscribe: listener.subscribe } });
  const runtime = createContentRuntime({
    platform,
    settingsStore,
    operations,
    document: dom.window.document,
    getSelection: () => dom.window.getSelection(),
    now,
  });

  return { listener, operations, runtime };
}

const flushAsyncWork = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('content runtime', () => {
  it('queues a page request received while startup settings are loading', async () => {
    const dom = createDom();
    const settings = makeSettings();
    let releaseInitialLoad!: (value: Settings) => void;
    let loadCount = 0;
    const settingsStore: SettingsStore = {
      load: vi.fn(() => {
        loadCount += 1;
        if (loadCount === 1) return new Promise<Settings>((resolve) => { releaseInitialLoad = resolve; });
        return Promise.resolve(settings);
      }),
      set: vi.fn(),
      subscribe: () => () => {},
    };
    const { listener, operations, runtime } = createRuntime(dom, settingsStore);

    const startPromise = runtime.start();
    const responsePromise = listener.invoke({ type: 'convert-page' }, {});
    releaseInitialLoad(settings);

    const dispose = await startPromise;
    await expect(responsePromise).resolves.toEqual({ kind: 'success', count: 1, time: 0 });
    expect(operations.convertDocument).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('does not convert an in-flight page request after disposal', async () => {
    const dom = createDom();
    const settings = makeSettings();
    let loadCount = 0;
    let releaseRequestLoad!: (value: Settings) => void;
    const settingsStore: SettingsStore = {
      load: vi.fn(() => {
        loadCount += 1;
        return loadCount === 1
          ? Promise.resolve(settings)
          : new Promise<Settings>((resolve) => { releaseRequestLoad = resolve; });
      }),
      set: vi.fn(),
      subscribe: () => () => {},
    };
    const operations = createRecordingConversionOperations();
    const { listener, runtime } = createRuntime(dom, settingsStore, operations);

    await runtime.start();
    const responsePromise = listener.invoke({ type: 'convert-page' }, {});
    await Promise.resolve();
    runtime.dispose();
    releaseRequestLoad(settings);

    await expect(responsePromise).resolves.toBeUndefined();
    expect(operations.convertTitle).not.toHaveBeenCalled();
    expect(operations.convertDocument).not.toHaveBeenCalled();
  });

  it('starts auto mode from settings and answers a page request', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: true, origin: 'cn', target: 'hk' });
    const { listener, operations, runtime } = createRuntime(dom, store);

    const dispose = await runtime.start();
    const response = await listener.invoke({ type: 'convert-page' }, {});

    expect(operations.convertDocument).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ kind: 'no-op', count: 0, time: 0 });
    dispose();
  });

  it('returns a typed page result with elapsed conversion time', async () => {
    const dom = createDom();
    const operations = createRecordingConversionOperations();
    operations.convertDocument.mockReturnValue(4);
    const { listener, runtime } = createRuntime(dom, createFakeSettingsStore(), operations, vi.fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(143));

    await runtime.start();

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({
      kind: 'success',
      count: 4,
      time: 43,
    });
    expect(operations.convertTitle).toHaveBeenCalledWith('cn', 'hk');
    expect(operations.convertDocument).toHaveBeenCalledWith('cn', 'hk', dom.window.document.body);
  });

  it('converts the current selection and reports one changed selection', async () => {
    const dom = createDom();
    const paragraph = dom.window.document.querySelector('p');
    if (!paragraph) throw new Error('test paragraph is missing');
    const range = dom.window.document.createRange();
    range.selectNodeContents(paragraph);
    const selection = dom.window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const operations = createRecordingConversionOperations();
    operations.convertSelection.mockReturnValue(true);
    const { listener, runtime } = createRuntime(dom, createFakeSettingsStore(), operations, vi.fn()
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(28));

    await runtime.start();

    await expect(listener.invoke({ type: 'convert-selection' }, {})).resolves.toEqual({
      kind: 'success',
      count: 1,
      time: 8,
    });
    expect(operations.convertSelection).toHaveBeenCalledWith('cn', 'hk', selection);
  });

  it('returns no-op when there is no selection', async () => {
    const dom = createDom();
    const operations = createRecordingConversionOperations();
    const { listener, runtime } = createRuntime(dom, createFakeSettingsStore(), operations, vi.fn());

    await runtime.start();

    await expect(listener.invoke({ type: 'convert-selection' }, {})).resolves.toEqual({
      kind: 'no-op',
      count: 0,
      time: 0,
    });
    expect(operations.convertSelection).not.toHaveBeenCalled();
  });

  it('returns no-op for equal locales without converting the page or selection', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ origin: 'cn', target: 'cn' });
    const operations = createRecordingConversionOperations();
    const { listener, runtime } = createRuntime(dom, store, operations);

    await runtime.start();

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({
      kind: 'no-op',
      count: 0,
      time: 0,
    });
    await expect(listener.invoke({ type: 'convert-selection' }, {})).resolves.toEqual({
      kind: 'no-op',
      count: 0,
      time: 0,
    });
    expect(operations.convertTitle).not.toHaveBeenCalled();
    expect(operations.convertDocument).not.toHaveBeenCalled();
    expect(operations.convertSelection).not.toHaveBeenCalled();
  });

  it('returns no-op when selection conversion does not change the selection', async () => {
    const dom = createDom();
    const operations = createRecordingConversionOperations();
    const paragraph = dom.window.document.querySelector('p');
    if (!paragraph) throw new Error('test paragraph is missing');
    const range = dom.window.document.createRange();
    range.selectNodeContents(paragraph);
    const selection = dom.window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    operations.convertSelection.mockReturnValue(false);
    const { listener, runtime } = createRuntime(dom, createFakeSettingsStore(), operations);

    await runtime.start();

    await expect(listener.invoke({ type: 'convert-selection' }, {})).resolves.toEqual({
      kind: 'no-op',
      count: 0,
      time: 0,
    });
    expect(operations.convertSelection).toHaveBeenCalledWith('cn', 'hk', selection);
  });

  it('returns reload-required instead of reinterpreting a converted document', async () => {
    const dom = createDom();
    const listener = createRuntimeListenerCapture();
    const store = createFakeSettingsStore({ auto: true, origin: 'cn', target: 'hk' });
    const operations = createRecordingConversionOperations();
    const platform = createFakePlatform({ runtime: { subscribe: listener.subscribe } });
    const runtime = createContentRuntime({
      platform,
      settingsStore: store,
      operations,
      document: dom.window.document,
      getSelection: () => null,
      now: () => 100,
    });

    await runtime.start();
    await store.emit({ auto: true, origin: 'tw', target: 'cn' });

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({
      kind: 'reload-required',
    });
    expect(operations.convertDocument).toHaveBeenCalledTimes(1);
  });

  it('starts and stops auto conversion when settings change', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: false });
    const operations = createRecordingConversionOperations();
    operations.convertTextNode.mockReturnValue(false);
    operations.convertDocument.mockReturnValue(0);
    const { runtime } = createRuntime(dom, store, operations);

    await runtime.start();
    expect(operations.convertDocument).not.toHaveBeenCalled();

    await store.emit({ auto: true });
    await flushAsyncWork();
    expect(operations.convertDocument).toHaveBeenCalledTimes(1);

    await store.emit({ auto: false });
    await flushAsyncWork();
    dom.window.document.body.appendChild(dom.window.document.createElement('section'));
    await flushAsyncWork();

    expect(operations.convertDocument).toHaveBeenCalledTimes(1);
  });

  it('applies the latest settings event when updates arrive before reconciliation runs', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: false });
    const operations = createRecordingConversionOperations();
    operations.convertDocument.mockReturnValue(0);
    const { runtime } = createRuntime(dom, store, operations);

    await runtime.start();
    const enabling = store.emit({ auto: true });
    const disabling = store.emit({ auto: false });
    await Promise.all([enabling, disabling]);
    await flushAsyncWork();

    expect(operations.convertDocument).not.toHaveBeenCalled();
  });

  it('returns internal-failure when the latest settings reconciliation fails', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: false });
    const operations = createRecordingConversionOperations();
    let failTitle = true;
    operations.convertTitle.mockImplementation(() => {
      if (failTitle) {
        failTitle = false;
        throw new Error('settings reconciliation failed');
      }
    });
    const { listener, runtime } = createRuntime(dom, store, operations);

    await runtime.start();
    await store.emit({ auto: true });
    await flushAsyncWork();
    const documentCallsBeforeMessage = operations.convertDocument.mock.calls.length;

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({ kind: 'internal-failure' });
    expect(operations.convertDocument).toHaveBeenCalledTimes(documentCallsBeforeMessage);
  });

  it('keeps reload-required state after auto mode stops before a locale change', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: true, origin: 'cn', target: 'hk' });
    const operations = createRecordingConversionOperations();
    const { listener, runtime } = createRuntime(dom, store, operations);

    await runtime.start();
    expect(operations.convertDocument).toHaveBeenCalledTimes(1);

    await store.emit({ auto: false });
    await flushAsyncWork();
    await store.emit({ auto: true, origin: 'tw', target: 'cn' });
    await flushAsyncWork();

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({ kind: 'reload-required' });
    expect(operations.convertDocument).toHaveBeenCalledTimes(1);
  });

  it('does not rescan a processed document for manual conversion after auto stops', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: true, origin: 'cn', target: 'hk' });
    const operations = createRecordingConversionOperations();
    const { listener, runtime } = createRuntime(dom, store, operations);

    await runtime.start();
    await store.emit({ auto: false });
    await flushAsyncWork();

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({ kind: 'no-op', count: 0, time: 0 });
    expect(operations.convertDocument).toHaveBeenCalledTimes(1);
  });

  it('returns reload-required when a manually converted document changes locale pair', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: false, origin: 'cn', target: 'hk' });
    const operations = createRecordingConversionOperations();
    const { listener, runtime } = createRuntime(dom, store, operations);

    await runtime.start();
    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({
      kind: 'success',
      count: 1,
      time: 0,
    });
    await store.emit({ auto: false, origin: 'tw', target: 'cn' });
    await flushAsyncWork();

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({ kind: 'reload-required' });
    expect(operations.convertDocument).toHaveBeenCalledTimes(1);
  });

  it('returns reload-required for selection after auto shutdown and locale change', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: true, origin: 'cn', target: 'hk' });
    const operations = createRecordingConversionOperations();
    operations.convertSelection.mockReturnValue(true);
    const paragraph = dom.window.document.querySelector('p');
    if (!paragraph) throw new Error('test paragraph is missing');
    const range = dom.window.document.createRange();
    range.selectNodeContents(paragraph);
    const selection = dom.window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const { listener, runtime } = createRuntime(dom, store, operations);

    await runtime.start();
    await store.emit({ auto: false });
    await flushAsyncWork();
    await store.emit({ auto: false, origin: 'tw', target: 'cn' });
    await flushAsyncWork();

    await expect(listener.invoke({ type: 'convert-selection' }, {})).resolves.toEqual({ kind: 'reload-required' });
    expect(operations.convertSelection).not.toHaveBeenCalled();
  });

  it('tracks selection-only output across a locale change', async () => {
    const dom = createDom();
    const store = createFakeSettingsStore({ auto: false, origin: 'cn', target: 'hk' });
    const operations = createRecordingConversionOperations();
    operations.convertSelection.mockReturnValue(true);
    const paragraph = dom.window.document.querySelector('p');
    if (!paragraph) throw new Error('test paragraph is missing');
    const range = dom.window.document.createRange();
    range.selectNodeContents(paragraph);
    const selection = dom.window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const { listener, runtime } = createRuntime(dom, store, operations);

    await runtime.start();
    await expect(listener.invoke({ type: 'convert-selection' }, {})).resolves.toEqual({
      kind: 'success',
      count: 1,
      time: 0,
    });
    await store.emit({ auto: false, origin: 'tw', target: 'cn' });
    await flushAsyncWork();

    await expect(listener.invoke({ type: 'convert-selection' }, {})).resolves.toEqual({ kind: 'reload-required' });
    expect(operations.convertSelection).toHaveBeenCalledTimes(1);
  });

  it('disposes synchronously while initial settings are still loading', async () => {
    const dom = createDom();
    let releaseLoad!: (settings: Settings) => void;
    const runtimeUnsubscribe = vi.fn();
    const settingsUnsubscribe = vi.fn();
    const settingsStore: SettingsStore = {
      load: vi.fn(() => new Promise<Settings>((resolve) => { releaseLoad = resolve; })),
      set: vi.fn(),
      subscribe: vi.fn(() => settingsUnsubscribe),
    };
    const listener = createRuntimeListenerCapture();
    const platform = createFakePlatform({
      runtime: { subscribe: vi.fn(() => { listener.subscribe(async () => undefined); return runtimeUnsubscribe; }) },
    });
    const runtime = createContentRuntime({
      platform,
      settingsStore,
      operations: createRecordingConversionOperations(),
      document: dom.window.document,
      getSelection: () => null,
    });

    const startPromise = runtime.start();
    runtime.dispose();
    releaseLoad(makeSettings());
    await startPromise;

    expect(runtimeUnsubscribe).toHaveBeenCalledOnce();
    expect(settingsUnsubscribe).toHaveBeenCalledOnce();
    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toBeUndefined();
  });

  it('is terminal when disposed before startup begins', async () => {
    const dom = createDom();
    const subscribe = vi.fn();
    const runtime = createContentRuntime({
      platform: createFakePlatform({ runtime: { subscribe } }),
      settingsStore: createFakeSettingsStore(),
      operations: createRecordingConversionOperations(),
      document: dom.window.document,
      getSelection: () => null,
    });
    runtime.dispose();

    await runtime.start();

    expect(subscribe).not.toHaveBeenCalled();
  });

  it('unwinds the runtime subscription when settings subscription setup fails', async () => {
    const dom = createDom();
    const runtimeUnsubscribe = vi.fn();
    const settingsStore: SettingsStore = {
      load: vi.fn().mockResolvedValue(makeSettings()),
      set: vi.fn(),
      subscribe: vi.fn(() => {
        throw new Error('settings subscribe failed');
      }),
    };
    const platform = createFakePlatform({
      runtime: { subscribe: vi.fn(() => runtimeUnsubscribe) },
    });
    const runtime = createContentRuntime({
      platform,
      settingsStore,
      operations: createRecordingConversionOperations(),
      document: dom.window.document,
      getSelection: () => null,
    });

    await expect(runtime.start()).rejects.toThrow('settings subscribe failed');
    expect(runtimeUnsubscribe).toHaveBeenCalledOnce();
  });

  it('ignores background and unknown messages', async () => {
    const dom = createDom();
    const { listener, operations, runtime } = createRuntime(dom);

    await runtime.start();

    await expect(listener.invoke({ type: 'convert-active-tab' }, {})).resolves.toBeUndefined();
    await expect(listener.invoke({ type: 'unknown' } as never, {})).resolves.toBeUndefined();
    expect(operations.convertDocument).not.toHaveBeenCalled();
  });

  it('disposes runtime, settings, and controller listeners', async () => {
    const dom = createDom();
    const runtimeUnsubscribe = vi.fn();
    const settingsUnsubscribe = vi.fn();
    let settingsListener: ((settings: Settings) => void) | undefined;
    const settingsStore: SettingsStore = {
      load: vi.fn().mockResolvedValue(makeSettings({ auto: true })),
      set: vi.fn(),
      subscribe: vi.fn((listener) => {
        settingsListener = listener;
        return settingsUnsubscribe;
      }),
    };
    const listener = createRuntimeListenerCapture();
    const platform = createFakePlatform({
      runtime: {
        subscribe: vi.fn(() => {
          listener.subscribe(async () => undefined);
          return runtimeUnsubscribe;
        }),
      },
    });
    const operations = createRecordingConversionOperations();
    operations.convertTextNode.mockReturnValue(false);
    operations.convertDocument.mockReturnValue(0);
    const runtime = createContentRuntime({
      platform,
      settingsStore,
      operations,
      document: dom.window.document,
      getSelection: () => null,
    });

    const dispose = await runtime.start();
    dispose();
    dispose();
    settingsListener?.(makeSettings({ auto: true }));
    dom.window.document.body.appendChild(dom.window.document.createElement('section'));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(runtimeUnsubscribe).toHaveBeenCalledOnce();
    expect(settingsUnsubscribe).toHaveBeenCalledOnce();
    expect(operations.convertDocument).toHaveBeenCalledOnce();
  });

  it('contains conversion failures as internal-failure responses', async () => {
    const dom = createDom();
    const operations = createRecordingConversionOperations();
    operations.convertDocument.mockImplementation(() => {
      throw new Error('conversion failed');
    });
    const { listener, runtime } = createRuntime(dom, createFakeSettingsStore(), operations);

    await runtime.start();

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({ kind: 'internal-failure' });
    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({ kind: 'reload-required' });
  });

  it('returns invalid-settings when the settings store cannot load settings', async () => {
    const dom = createDom();
    const load = vi.fn().mockResolvedValueOnce(makeSettings()).mockRejectedValueOnce(new Error('storage failed'));
    const settingsStore: SettingsStore = {
      load,
      set: vi.fn(),
      subscribe: () => () => {},
    };
    const { listener, runtime } = createRuntime(dom, settingsStore);

    await runtime.start();

    await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({ kind: 'invalid-settings' });
  });

  it('suppresses settings-load failures after disposal', async () => {
    const dom = createDom();
    let rejectLoad!: (error: Error) => void;
    let loadCount = 0;
    const settingsStore: SettingsStore = {
      load: vi.fn(() => {
        loadCount += 1;
        if (loadCount === 1) return Promise.resolve(makeSettings());
        return new Promise<Settings>((_resolve, reject) => { rejectLoad = reject; });
      }),
      set: vi.fn(),
      subscribe: () => () => {},
    };
    const { listener, runtime } = createRuntime(dom, settingsStore);

    await runtime.start();
    const responsePromise = listener.invoke({ type: 'convert-page' }, {});
    await Promise.resolve();
    runtime.dispose();
    rejectLoad(new Error('storage failed after dispose'));

    await expect(responsePromise).resolves.toBeUndefined();
  });
});
