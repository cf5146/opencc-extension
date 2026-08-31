import { createAutoConversionController, type AutoConversionOperations } from '../auto/auto-conversion-controller.js';
import type { Settings } from '../settings/settings.js';
import type { SettingsStore } from '../settings/settings-store.js';
import { matchesWhitelist } from '../../core/whitelist.js';
import type { ExtensionPlatform } from '../../platform/types.js';
import type { ConversionResponse, RuntimeMessage } from '../../runtime/messages.js';

export interface ContentRuntimeOptions {
  platform: ExtensionPlatform;
  settingsStore: SettingsStore;
  operations: AutoConversionOperations;
  document: Document;
  getSelection: () => Selection | null;
  now?: () => number;
}

export interface ContentRuntime {
  start(): Promise<() => void>;
  dispose(): void;
}

function noOp(): ConversionResponse {
  return { kind: 'no-op', count: 0, time: 0 };
}

function conversionResult(count: number, time: number): ConversionResponse {
  return count > 0 ? { kind: 'success', count, time } : noOp();
}

export function createContentRuntime(options: ContentRuntimeOptions): ContentRuntime {
  const controller = createAutoConversionController({
    document: options.document,
    getUrl: () => options.document.location?.href ?? '',
    operations: options.operations,
    isWhitelisted: matchesWhitelist,
  });
  const now = options.now ?? (() => Date.now());

  let started = false;
  let disposed = false;
  let startPromise: Promise<() => void> | undefined;
  let ready = false;
  let resolveReady: () => void = () => {};
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  let settingsRevision = 0;
  let reconcileQueue = Promise.resolve();
  let latestSettings: Settings | undefined;
  let latestReconcileFailure: { revision: number; url: string; error: unknown } | undefined;
  const getUrl = () => options.document.location?.href ?? '';

  const enqueueReconcile = (settings: Settings) => {
    if (disposed || !started) return { promise: Promise.resolve(), revision: settingsRevision };
    latestSettings = settings;
    const revision = ++settingsRevision;
    latestReconcileFailure = undefined;
    const reconcile = reconcileQueue.catch(() => {}).then(async () => {
      if (disposed || !started || revision !== settingsRevision) return;
      await controller.reconcile(settings);
    });
    reconcileQueue = reconcile;
    void reconcile.catch((error) => {
      if (revision === settingsRevision) latestReconcileFailure = { revision, url: getUrl(), error };
    });
    return { promise: reconcile, revision };
  };

  const waitForLatestReconcile = async (settings: Settings, loadRevision: number, scheduleInitial: boolean) => {
    let revision = loadRevision;
    let currentSettings = settings;
    let currentUrl = getUrl();

    while (true) {
      if (!scheduleInitial && latestReconcileFailure?.revision === settingsRevision && latestReconcileFailure.url === getUrl()) {
        throw latestReconcileFailure.error;
      }
      if (scheduleInitial && settingsRevision === revision) {
        await enqueueReconcile(currentSettings).promise;
      } else if (settingsRevision !== revision) {
        await reconcileQueue;
      } else {
        await controller.reconcile(currentSettings);
      }

      if (disposed || !started) return undefined;

      const settledRevision = settingsRevision;
      const settledUrl = getUrl();
      if (settledRevision !== revision || settledUrl !== currentUrl) {
        currentSettings = latestSettings ?? (await options.settingsStore.load());
        revision = settingsRevision;
        currentUrl = getUrl();
        scheduleInitial = false;
        continue;
      }

      if (latestReconcileFailure?.url !== currentUrl) latestReconcileFailure = undefined;
      return currentSettings;
    }
  };

  const convertPage = (settings: Settings): ConversionResponse => {
    if (controller.getStatus() === 'reload-required') return { kind: 'reload-required' };
    if (settings.origin === settings.target) return noOp();
    const documentState = controller.getDocumentState(settings);
    if (documentState === 'reload-required') return { kind: 'reload-required' };
    if (documentState === 'processed') return noOp();

    const startedAt = now();
    options.operations.convertTitle(settings.origin, settings.target);
    const count = options.operations.convertDocument(settings.origin, settings.target, options.document.body);
    controller.markDocumentProcessed(settings);
    return conversionResult(count, now() - startedAt);
  };

  const convertSelection = (settings: Settings): ConversionResponse => {
    const selection = options.getSelection();
    if (!selection || selection.rangeCount === 0 || settings.origin === settings.target) return noOp();
    if (controller.getStatus() === 'reload-required') return { kind: 'reload-required' };
    if (controller.getDocumentState(settings) === 'reload-required') return { kind: 'reload-required' };

    const startedAt = now();
    const changed = options.operations.convertSelection(settings.origin, settings.target, selection);
    if (changed) controller.markSelectionProcessed(settings);
    return changed ? { kind: 'success', count: 1, time: now() - startedAt } : noOp();
  };

  const handleMessage = async (message: RuntimeMessage): Promise<ConversionResponse | undefined> => {
    if (!started || disposed || (message.type !== 'convert-page' && message.type !== 'convert-selection')) return undefined;

    await readyPromise;
    if (!ready || !started || disposed) return undefined;

    const loadRevision = settingsRevision;
    let loadedSettings: Settings;
    try {
      loadedSettings = await options.settingsStore.load();
    } catch {
      if (!started || disposed) return undefined;
      return { kind: 'invalid-settings' };
    }

    try {
      const settings = await waitForLatestReconcile(loadedSettings, loadRevision, false);
      if (!settings) return undefined;
      if (!started || disposed) return undefined;
      try {
        return message.type === 'convert-page' ? convertPage(settings) : convertSelection(settings);
      } catch {
        controller.markConversionFailed();
        if (!started || disposed) return undefined;
        return { kind: 'internal-failure' };
      }
    } catch {
      if (!started || disposed) return undefined;
      return { kind: 'internal-failure' };
    }
  };

  let cleanup: (() => void) | undefined;

  const dispose = () => {
    if (cleanup) {
      cleanup();
      return;
    }
    disposed = true;
    started = false;
    ready = false;
    resolveReady();
  };

  const start = async (): Promise<() => void> => {
    if (startPromise !== undefined) return startPromise;
    if (disposed) {
      const noOpCleanup = () => {};
      startPromise = Promise.resolve(noOpCleanup);
      return startPromise;
    }

    startPromise = (async () => {
      started = true;
      let unsubscribeRuntime = () => {};
      let unsubscribeSettings = () => {};
      let cleanupCalled = false;
      cleanup = () => {
        if (cleanupCalled) return;
        cleanupCalled = true;
        disposed = true;
        started = false;
        ready = false;
        unsubscribeRuntime();
        unsubscribeSettings();
        controller.dispose();
        resolveReady();
      };

      try {
        unsubscribeRuntime = options.platform.runtime.subscribe(handleMessage);
        unsubscribeSettings = options.settingsStore.subscribe((settings) => {
          void enqueueReconcile(settings).promise.catch(() => {});
        });
      } catch (error) {
        cleanup();
        throw error;
      }

      const loadRevision = settingsRevision;
      try {
        const settings = await options.settingsStore.load();
        await waitForLatestReconcile(settings, loadRevision, true);
      } catch {
        // Initial settings and conversion failures must not leave the content script unhandled.
      }
      ready = !disposed;
      resolveReady();
      return cleanup;
    })();

    return startPromise;
  };

  return { start, dispose };
}
