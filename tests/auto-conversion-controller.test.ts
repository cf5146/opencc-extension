import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  createAutoConversionController,
  type AutoConversionOperations,
  type AutoStatus,
  type ObserverPort,
  type TimerPort,
} from '../src/application/auto/auto-conversion-controller.js';
import { DEFAULT_SETTINGS, type Settings } from '../src/application/settings/settings.js';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    textboxSize: { ...DEFAULT_SETTINGS.textboxSize, ...overrides.textboxSize },
  };
}

function makeMutation(document: Document, overrides: Partial<MutationRecord> = {}): MutationRecord {
  return {
    type: 'childList',
    target: document.body,
    addedNodes: [] as unknown as NodeList,
    ...overrides,
  } as MutationRecord;
}

function createDom() {
  return new JSDOM(
    '<!doctype html><html lang="zh"><head><title>title</title></head><body><p>source</p></body></html>',
    { url: 'https://example.com' },
  );
}

describe('auto conversion controller', () => {
  let dom: ReturnType<typeof createDom>;
  let callback: ((mutations: MutationRecord[]) => void) | undefined;
  let observer: ObserverPort;
  let observed = false;
  let disconnected = false;
  let observedTarget: Node | undefined;
  let observedOptions: MutationObserverInit | undefined;
  let convertedDocuments = 0;
  let convertedNodes = 0;
  let convertedTitles = 0;
  let resetCount = 0;
  let documentRoots: Array<HTMLElement | DocumentFragment | null>;
  let nodePairs: Array<[Settings['origin'], Settings['target']]>;
  let currentUrl = 'https://example.com';
  let nextTimerHandle = 0;
  let scheduledTimers: Map<number, { callback: () => void; delayMs: number }>;
  let timer: TimerPort;

  beforeEach(() => {
    dom = createDom();
    callback = undefined;
    observed = false;
    disconnected = false;
    observedTarget = undefined;
    observedOptions = undefined;
    convertedDocuments = 0;
    convertedNodes = 0;
    convertedTitles = 0;
    resetCount = 0;
    documentRoots = [];
    nodePairs = [];
    currentUrl = 'https://example.com';
    nextTimerHandle = 0;
    scheduledTimers = new Map();
    observer = {
      observe: (target, options) => {
        observed = true;
        observedTarget = target;
        observedOptions = options;
      },
      disconnect: () => {
        disconnected = true;
      },
    };
    timer = {
      schedule: vi.fn((scheduledCallback, delayMs) => {
        const handle = ++nextTimerHandle;
        scheduledTimers.set(handle, { callback: scheduledCallback, delayMs });
        return handle;
      }),
      cancel: vi.fn((handle) => {
        scheduledTimers.delete(handle as number);
      }),
    };
  });

  function createOperations(overrides: Partial<AutoConversionOperations> = {}): AutoConversionOperations {
    const operations: AutoConversionOperations = {
      convertTextNode: (from, to) => {
        convertedNodes += 1;
        nodePairs.push([from, to]);
        return true;
      },
      convertDocument: (_from, _to, root) => {
        convertedDocuments += 1;
        documentRoots.push(root);
        return 1;
      },
      convertTitle: () => {
        convertedTitles += 1;
      },
      convertSelection: () => false,
      hasConverted: () => false,
      resetCaches: () => {
        resetCount += 1;
      },
    };
    return { ...operations, ...overrides };
  }

  function createController(operations = createOperations()) {
    return createAutoConversionController({
      document: dom.window.document,
      getUrl: () => currentUrl,
      operations,
      observerFactory: (listener) => {
        callback = listener;
        return observer;
      },
      timer,
    });
  }

  async function emit(mutations: MutationRecord[]) {
    callback?.(mutations);
    await Promise.resolve();
  }

  function runTimer(handle: number) {
    const scheduled = scheduledTimers.get(handle);
    scheduledTimers.delete(handle);
    scheduled?.callback();
  }

  it('starts only for an eligible auto-mode document', async () => {
    const controller = createController();

    await controller.reconcile(makeSettings({ auto: true }));

    expect(controller.getStatus()).toBe<AutoStatus>('active');
    expect(observed).toBe(true);
    expect(observedTarget).toBe(dom.window.document.body);
    expect(observedOptions).toEqual({
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
    });
    expect(convertedTitles).toBe(1);
    expect(convertedDocuments).toBe(1);
    expect(documentRoots).toEqual([dom.window.document.body]);
  });

  it('marks a failed activation reload-required until the URL changes', async () => {
    let attempts = 0;
    const operations = createOperations({
      convertDocument: (_from, _to, root) => {
        attempts += 1;
        if (attempts === 1) throw new Error('initial scan failed');
        convertedDocuments += 1;
        documentRoots.push(root);
        return 1;
      },
    });
    const controller = createController(operations);
    const settings = makeSettings({ auto: true });

    await expect(controller.reconcile(settings)).rejects.toThrow('initial scan failed');
    expect(controller.getStatus()).toBe('inactive');
    expect(observed).toBe(false);

    await controller.reconcile(settings);
    expect(controller.getStatus()).toBe('reload-required');
    expect(attempts).toBe(1);

    currentUrl = 'https://example.com/next';
    await controller.reconcile(settings);

    expect(controller.getStatus()).toBe('active');
    expect(attempts).toBe(2);
    expect(convertedDocuments).toBe(1);
    expect(observed).toBe(true);
  });

  it.each([
    { name: 'auto mode disabled', settings: makeSettings({ auto: false }), prepare: () => {} },
    { name: 'same locale pair', settings: makeSettings({ auto: true, origin: 'cn', target: 'cn' }), prepare: () => {} },
    {
      name: 'non-Chinese document',
      settings: makeSettings({ auto: true }),
      prepare: () => {
        dom.window.document.documentElement.lang = 'en';
      },
    },
    { name: 'whitelisted URL', settings: makeSettings({ auto: true, whitelist: ['example.com'] }), prepare: () => {} },
  ])('stays inactive for $name', async ({ settings, prepare }) => {
    prepare();
    const controller = createController();

    await controller.reconcile(settings);

    expect(controller.getStatus()).toBe('inactive');
    expect(observed).toBe(false);
    expect(convertedTitles).toBe(0);
    expect(convertedDocuments).toBe(0);
  });

  it('stops and disconnects when auto mode is disabled', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));
    await controller.reconcile(makeSettings({ auto: false }));

    expect(controller.getStatus()).toBe('inactive');
    expect(disconnected).toBe(true);
  });

  it('retains document state after auto mode stops', async () => {
    const controller = createController();
    const settings = makeSettings({ auto: true, origin: 'cn', target: 'hk' });

    await controller.reconcile(settings);
    await controller.reconcile(makeSettings({ ...settings, auto: false }));

    expect(controller.getDocumentState(settings)).toBe('processed');
    expect(controller.getDocumentState(makeSettings({ ...settings, origin: 'tw', target: 'cn' }))).toBe(
      'reload-required',
    );
  });

  it('converts added text nodes incrementally', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));
    const added = dom.window.document.createTextNode('added');

    await emit([
      makeMutation(dom.window.document, {
        addedNodes: [added] as unknown as NodeList,
      }),
    ]);

    expect(convertedNodes).toBe(1);
    expect(nodePairs).toEqual([['cn', 'hk']]);
    expect(convertedDocuments).toBe(1);
  });

  it('scans added elements from their own root', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));
    const added = dom.window.document.createElement('section');

    await emit([
      makeMutation(dom.window.document, {
        addedNodes: [added] as unknown as NodeList,
      }),
    ]);

    expect(convertedDocuments).toBe(2);
    expect(documentRoots).toEqual([dom.window.document.body, added]);
  });

  it('converts character-data targets incrementally', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));
    const changed = dom.window.document.createTextNode('changed');

    await emit([
      makeMutation(dom.window.document, {
        type: 'characterData',
        target: changed,
      }),
    ]);

    expect(convertedNodes).toBe(1);
    expect(nodePairs).toEqual([['cn', 'hk']]);
  });

  it('does not schedule fallback for already-tracked conversion mutations', async () => {
    const operations = createOperations({
      convertTextNode: () => false,
      hasConverted: () => true,
    });
    const controller = createController(operations);
    await controller.reconcile(makeSettings({ auto: true }));

    const changed = dom.window.document.createTextNode('already converted');
    await emit([
      makeMutation(dom.window.document, {
        type: 'characterData',
        target: changed,
      }),
    ]);

    expect(timer.schedule).not.toHaveBeenCalled();
    expect(controller.getStatus()).toBe('active');
  });

  it('does not schedule fallback for tracked selection replacement records', async () => {
    const operations = createOperations({
      convertTextNode: () => false,
      hasConverted: () => true,
    });
    const controller = createController(operations);
    await controller.reconcile(makeSettings({ auto: true }));

    const inserted = dom.window.document.createTextNode('tracked selection output');
    const removed = dom.window.document.createTextNode('original selection output');
    await emit([
      makeMutation(dom.window.document, {
        addedNodes: [inserted] as unknown as NodeList,
      }),
      makeMutation(dom.window.document, {
        addedNodes: [] as unknown as NodeList,
        removedNodes: [removed] as unknown as NodeList,
      }),
    ]);

    expect(timer.schedule).not.toHaveBeenCalled();
    expect(controller.getStatus()).toBe('active');
  });

  it('coalesces zero-change batches into one 250ms fallback scan', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));

    await emit([]);
    await emit([]);

    expect(timer.schedule).toHaveBeenCalledTimes(1);
    const handle = [...scheduledTimers.keys()][0];
    if (handle === undefined) throw new Error('fallback timer was not scheduled');
    expect(scheduledTimers.get(handle)?.delayMs).toBe(250);

    runTimer(handle);
    await Promise.resolve();

    expect(convertedDocuments).toBe(2);
  });

  it('reconciles the current URL before a pending fallback scan', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));
    await emit([]);
    const handle = [...scheduledTimers.keys()][0];
    if (handle === undefined) throw new Error('fallback timer was not scheduled');

    currentUrl = 'https://example.com/next';
    runTimer(handle);
    await Promise.resolve();

    expect(resetCount).toBe(1);
    expect(convertedTitles).toBe(2);
    expect(convertedDocuments).toBe(2);
  });

  it('cancels a pending fallback scan on dispose', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));
    await emit([]);

    controller.dispose();

    expect(timer.cancel).toHaveBeenCalledWith(1);
    expect(disconnected).toBe(true);
    expect(controller.getStatus()).toBe('inactive');
  });

  it('resets caches and performs one full conversion when the URL changes', async () => {
    const controller = createController();
    const settings = makeSettings({ auto: true });
    await controller.reconcile(settings);

    currentUrl = 'https://example.com/next';
    await controller.reconcile(settings);

    expect(resetCount).toBe(1);
    expect(convertedTitles).toBe(2);
    expect(convertedDocuments).toBe(2);
    expect(controller.getStatus()).toBe('active');
  });

  it('reconciles a SPA URL change before processing its mutation batch', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));

    currentUrl = 'https://example.com/next';
    const added = dom.window.document.createTextNode('added on next route');
    await emit([
      makeMutation(dom.window.document, {
        addedNodes: [added] as unknown as NodeList,
      }),
    ]);

    expect(resetCount).toBe(1);
    expect(convertedTitles).toBe(2);
    expect(convertedDocuments).toBe(2);
    expect(nodePairs).toEqual([['cn', 'hk']]);
  });

  it('marks a processed document reload-required when the locale pair changes', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true, origin: 'cn', target: 'hk' }));
    await controller.reconcile(makeSettings({ auto: true, origin: 'tw', target: 'cn' }));

    expect(controller.getStatus()).toBe('reload-required');
    expect(convertedDocuments).toBe(1);
    expect(convertedTitles).toBe(1);
    expect(resetCount).toBe(1);
    expect(disconnected).toBe(false);
  });

  it('keeps observing newly added nodes with the new locale pair after reload-required', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true, origin: 'cn', target: 'hk' }));
    await controller.reconcile(makeSettings({ auto: true, origin: 'tw', target: 'cn' }));

    const added = dom.window.document.createTextNode('added after pair change');
    await emit([
      makeMutation(dom.window.document, {
        addedNodes: [added] as unknown as NodeList,
      }),
    ]);

    expect(controller.getStatus()).toBe('reload-required');
    expect(convertedDocuments).toBe(1);
    expect(nodePairs).toEqual([['tw', 'cn']]);
  });

  it('keeps reload-required sticky after alternate-pair mutations and reactivation', async () => {
    const controller = createController();
    const original = makeSettings({ auto: true, origin: 'cn', target: 'hk' });
    const alternate = makeSettings({ auto: true, origin: 'tw', target: 'cn' });

    await controller.reconcile(original);
    await controller.reconcile(alternate);
    const added = dom.window.document.createTextNode('alternate output');
    await emit([makeMutation(dom.window.document, { addedNodes: [added] as unknown as NodeList })]);
    await controller.reconcile(makeSettings({ ...alternate, auto: false }));
    await controller.reconcile(original);

    expect(controller.getStatus()).toBe('reload-required');
    expect(convertedDocuments).toBe(1);
  });

  it('resets caches when a URL transition fails after partial conversion', async () => {
    let attempts = 0;
    const operations = createOperations({
      convertDocument: (_from, _to, root) => {
        attempts += 1;
        if (attempts === 2) throw new Error('route scan failed');
        convertedDocuments += 1;
        documentRoots.push(root);
        return 1;
      },
    });
    const controller = createController(operations);
    const settings = makeSettings({ auto: true });
    await controller.reconcile(settings);
    currentUrl = 'https://example.com/next';

    await expect(controller.reconcile(settings)).rejects.toThrow('route scan failed');

    expect(resetCount).toBe(2);
    expect(controller.getStatus()).toBe('inactive');
  });

  it('does not fallback-scan existing content while reload is required', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true, origin: 'cn', target: 'hk' }));
    await controller.reconcile(makeSettings({ auto: true, origin: 'tw', target: 'cn' }));

    await emit([]);

    expect(timer.schedule).not.toHaveBeenCalled();
    expect(convertedDocuments).toBe(1);
  });

  it('clears reload-required after a URL change and rescans with the current pair', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true, origin: 'cn', target: 'hk' }));
    await controller.reconcile(makeSettings({ auto: true, origin: 'tw', target: 'cn' }));

    currentUrl = 'https://example.com/next';
    await controller.reconcile(makeSettings({ auto: true, origin: 'tw', target: 'cn' }));

    expect(controller.getStatus()).toBe('active');
    expect(resetCount).toBe(2);
    expect(convertedTitles).toBe(2);
    expect(convertedDocuments).toBe(2);
  });

  it('reactivates without rescanning the same processed document', async () => {
    const controller = createController();
    const settings = makeSettings({ auto: true });

    await controller.reconcile(settings);
    await controller.reconcile(makeSettings({ ...settings, auto: false }));
    await controller.reconcile(settings);

    expect(convertedDocuments).toBe(1);
    expect(controller.getStatus()).toBe('active');
  });

  it('contains asynchronous observer operation failures', async () => {
    const failure = new Error('conversion failed');
    const controller = createController({
      ...createOperations({
        convertTextNode: () => {
          throw failure;
        },
      }),
    });
    await controller.reconcile(makeSettings({ auto: true }));

    const unhandledRejection = vi.fn();
    process.on('unhandledRejection', unhandledRejection);
    try {
      const changed = dom.window.document.createTextNode('changed');
      await emit([
        makeMutation(dom.window.document, {
          type: 'characterData',
          target: changed,
        }),
      ]);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }

    expect(unhandledRejection).not.toHaveBeenCalled();
    expect(controller.getStatus()).toBe('reload-required');
  });

  it('marks fallback scan failures reload-required', async () => {
    const operations = createOperations({
      convertDocument: vi.fn()
        .mockReturnValueOnce(1)
        .mockImplementation(() => {
          throw new Error('fallback failed');
        }),
    });
    const controller = createController(operations);

    await controller.reconcile(makeSettings({ auto: true }));
    await emit([]);
    const handle = [...scheduledTimers.keys()][0];
    if (handle === undefined) throw new Error('fallback timer was not scheduled');
    runTimer(handle);

    expect(controller.getStatus()).toBe('reload-required');
    expect(resetCount).toBe(1);
  });
});
