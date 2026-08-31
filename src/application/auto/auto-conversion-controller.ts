import { matchesWhitelist } from '../../core/whitelist.js';
import type { Settings } from '../settings/settings.js';

export interface ObserverPort {
  observe(target: Node, options: MutationObserverInit): void;
  disconnect(): void;
}

export interface TimerPort {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export interface AutoConversionOperations {
  convertTextNode(from: Settings['origin'], to: Settings['target'], node: Text): boolean;
  convertDocument(from: Settings['origin'], to: Settings['target'], root: HTMLElement | DocumentFragment | null): number;
  convertTitle(from: Settings['origin'], to: Settings['target']): void;
  convertSelection(from: Settings['origin'], to: Settings['target'], selection: Selection | null): boolean;
  hasConverted(node: Node, from: Settings['origin'], to: Settings['target']): boolean;
  resetCaches(): void;
}

export interface AutoConversionControllerOptions {
  document: Document;
  getUrl: () => string;
  operations: AutoConversionOperations;
  isWhitelisted?: (url: string, patterns: string[]) => boolean;
  observerFactory?: (listener: (mutations: MutationRecord[]) => void) => ObserverPort;
  timer?: TimerPort;
}

export type AutoStatus = 'inactive' | 'active' | 'reload-required';
export type DocumentConversionState = 'unprocessed' | 'processed' | 'reload-required';

const FALLBACK_DELAY_MS = 250;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

type MutationObserverInit = {
  childList?: boolean;
  subtree?: boolean;
  characterData?: boolean;
  characterDataOldValue?: boolean;
};

function createDefaultObserver(document: Document, listener: (mutations: MutationRecord[]) => void): ObserverPort {
  const MutationObserverConstructor = document.defaultView?.MutationObserver;
  if (!MutationObserverConstructor) {
    throw new Error('MutationObserver is unavailable');
  }

  const observer = new MutationObserverConstructor(listener);
  return {
    observe: (target, options) => observer.observe(target, options),
    disconnect: () => observer.disconnect(),
  };
}

const defaultTimer: TimerPort = {
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: (handle) => globalThis.clearTimeout(handle as number),
};

function hasSameLocalePair(left: Settings, right: Settings): boolean {
  return left.origin === right.origin && left.target === right.target;
}

function hasSameProcessedPair(
  processedPair: { origin: Settings['origin']; target: Settings['target'] } | undefined,
  settings: Settings,
): boolean {
  return processedPair?.origin === settings.origin && processedPair.target === settings.target;
}

export interface AutoConversionController {
  reconcile(settings: Settings): Promise<void>;
  dispose(): void;
  getStatus(): AutoStatus;
  getDocumentState(settings: Settings): DocumentConversionState;
  markDocumentProcessed(settings: Settings): void;
  markSelectionProcessed(settings: Settings): void;
  markConversionFailed(): void;
}

export function createAutoConversionController(options: AutoConversionControllerOptions): AutoConversionController {
  const isWhitelisted = options.isWhitelisted ?? matchesWhitelist;
  const observerFactory = options.observerFactory ?? ((listener) => createDefaultObserver(options.document, listener));
  const timer = options.timer ?? defaultTimer;

  let status: AutoStatus = 'inactive';
  let observer: ObserverPort | undefined;
  let activeSettings: Settings | undefined;
  let activeUrl: string | undefined;
  let hasFullScan = false;
  let hasProcessedDocument = false;
  let processedPair: { origin: Settings['origin']; target: Settings['target'] } | undefined;
  let processedUrl: string | undefined;
  let hasSelectionConversion = false;
  let selectionPair: { origin: Settings['origin']; target: Settings['target'] } | undefined;
  let selectionUrl: string | undefined;
  let requiresReload = false;
  let reloadRequiredUrl: string | undefined;
  let disposed = false;
  let pendingTimer: unknown;
  let hasPendingTimer = false;

  const cancelFallback = () => {
    if (!hasPendingTimer) return;
    timer.cancel(pendingTimer);
    pendingTimer = undefined;
    hasPendingTimer = false;
  };

  const stop = () => {
    cancelFallback();
    observer?.disconnect();
    observer = undefined;
    activeSettings = undefined;
    activeUrl = undefined;
    hasFullScan = false;
    status = 'inactive';
  };

  const scheduleFallback = () => {
    if (hasPendingTimer || status !== 'active' || !activeSettings || activeUrl === undefined) return;

    const expectedOrigin = activeSettings.origin;
    const expectedTarget = activeSettings.target;
    const expectedUrl = activeUrl;
    const handle = timer.schedule(() => {
      hasPendingTimer = false;
      pendingTimer = undefined;

      const currentSettings = activeSettings;
      const currentUrl = options.getUrl();
      if (
        disposed ||
        !observer ||
        status !== 'active' ||
        !currentSettings ||
        currentUrl !== expectedUrl ||
        activeUrl !== expectedUrl ||
        currentSettings.origin !== expectedOrigin ||
        currentSettings.target !== expectedTarget
      ) {
        if (!disposed && currentSettings && currentUrl !== expectedUrl) {
          void reconcile({ ...currentSettings, auto: true }).catch(() => {});
        }
        return;
      }

      if (!isEligible(currentSettings, currentUrl)) {
        stop();
        return;
      }

      try {
        options.operations.convertDocument(currentSettings.origin, currentSettings.target, options.document.body);
      } catch {
        markConversionFailed();
      }
    }, FALLBACK_DELAY_MS);

    pendingTimer = handle;
    hasPendingTimer = true;
  };

  const convertAddedNode = (node: Node, settings: Settings) => {
    if (node.nodeType === TEXT_NODE) {
      return options.operations.convertTextNode(settings.origin, settings.target, node as Text) ? 1 : 0;
    }
    if (node.nodeType === ELEMENT_NODE) {
      return options.operations.convertDocument(settings.origin, settings.target, node as HTMLElement);
    }
    return 0;
  };

  const isFullyConvertedNode = (node: Node, settings: Settings) => {
    let sawText = false;
    let allConverted = true;
    const visit = (current: Node) => {
      if (current.nodeType === TEXT_NODE) {
        sawText = true;
        allConverted = allConverted && options.operations.hasConverted(current, settings.origin, settings.target);
        return;
      }
      for (const child of Array.from(current.childNodes)) visit(child);
    };
    visit(node);
    return sawText && allConverted;
  };

  const processMutation = (mutation: MutationRecord, settings: Settings, hasTrackedInsertion: boolean) => {
    let incremental = 0;
    let generated =
      mutation.type === 'childList' &&
      mutation.addedNodes.length === 0 &&
      (mutation.removedNodes?.length ?? 0) > 0 &&
      hasTrackedInsertion;
    if (mutation.type === 'characterData' && mutation.target.nodeType === TEXT_NODE) {
      generated = options.operations.hasConverted(mutation.target, settings.origin, settings.target);
      if (options.operations.convertTextNode(settings.origin, settings.target, mutation.target as Text)) {
        incremental += 1;
      }
    }
    for (const node of Array.from(mutation.addedNodes)) {
      incremental += convertAddedNode(node, settings);
      generated = generated || isFullyConvertedNode(node, settings);
    }
    for (const node of Array.from(mutation.removedNodes ?? [])) {
      generated = generated || isFullyConvertedNode(node, settings);
    }
    return { incremental, generated };
  };

  const processMutations = async (mutations: MutationRecord[]) => {
    if (disposed || !observer || !activeSettings || status === 'inactive') return;

    const currentUrl = options.getUrl();
    if (activeUrl !== currentUrl) {
      await reconcile({ ...activeSettings, auto: true });
      if (disposed || !observer || !activeSettings) return;
    }

    const reconciledUrl = options.getUrl();
    if (activeUrl !== reconciledUrl) {
      void reconcile({ ...activeSettings, auto: true }).catch(() => {});
      return;
    }

    const settings = activeSettings;
    if (!isEligible(settings, reconciledUrl)) {
      stop();
      return;
    }
    let incremental = 0;
    let allGenerated = mutations.length > 0;
    const hasTrackedInsertion = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some((node) => isFullyConvertedNode(node, settings)),
    );
    for (const mutation of mutations) {
      const result = processMutation(mutation, settings, hasTrackedInsertion);
      incremental += result.incremental;
      allGenerated = allGenerated && result.generated;
    }
    if (incremental === 0 && !allGenerated) scheduleFallback();
  };

  const handleMutations = (mutations: MutationRecord[]) => {
    void processMutations(mutations).catch(() => {
      if (!disposed) markConversionFailed();
    });
  };

  const observe = () => {
    if (observer || !options.document.body) return;
    observer = observerFactory(handleMutations);
    observer.observe(options.document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
    });
  };

  const scanDocument = (settings: Settings) => {
    options.operations.convertTitle(settings.origin, settings.target);
    options.operations.convertDocument(settings.origin, settings.target, options.document.body);
  };

  const rollbackActivation = () => {
    observer?.disconnect();
    observer = undefined;
    activeSettings = undefined;
    activeUrl = undefined;
    hasFullScan = false;
    status = 'inactive';
  };

  const isEligible = (settings: Settings, url: string) => {
    const lang = options.document.documentElement?.lang ?? '';
    return (
      settings.auto &&
      settings.origin !== settings.target &&
      (lang.length === 0 || lang.startsWith('zh')) &&
      !isWhitelisted(url, settings.whitelist)
    );
  };

  const markProcessed = (settings: Settings, url: string) => {
    hasProcessedDocument = true;
    processedPair = { origin: settings.origin, target: settings.target };
    processedUrl = url;
  };

  const activateProcessedDocument = (settings: Settings, url: string) => {
    activeSettings = settings;
    activeUrl = url;
    try {
      observe();
      hasFullScan = true;
      const pairMatches = hasSameProcessedPair(processedPair, settings);
      status = requiresReload || !pairMatches ? 'reload-required' : 'active';
      if (!pairMatches) {
        options.operations.resetCaches();
        requiresReload = true;
        reloadRequiredUrl = url;
      }
    } catch (error) {
      rollbackActivation();
      requiresReload = true;
      reloadRequiredUrl = url;
      try {
        options.operations.resetCaches();
      } catch {
        // Preserve the original observer setup failure.
      }
      throw error;
    }
  };

  const discardProcessedDocument = (resetCache = true) => {
    if (resetCache) options.operations.resetCaches();
    hasProcessedDocument = false;
    processedPair = undefined;
    processedUrl = undefined;
    hasSelectionConversion = false;
    selectionPair = undefined;
    selectionUrl = undefined;
    requiresReload = false;
    reloadRequiredUrl = undefined;
  };

  const hasOutputAtUrl = (url: string) =>
    (hasProcessedDocument && processedUrl === url) || (hasSelectionConversion && selectionUrl === url);

  const markConversionFailed = () => {
    if (disposed) return;
    cancelFallback();
    requiresReload = true;
    reloadRequiredUrl = options.getUrl();
    status = 'reload-required';
    try {
      options.operations.resetCaches();
    } catch {
      // Preserve the original conversion failure.
    }
  };

  const prepareDocumentState = (settings: Settings, url: string, resetOnUrlChange = true) => {
    const knownUrls = [processedUrl, selectionUrl, reloadRequiredUrl].filter(
      (knownUrl): knownUrl is string => knownUrl !== undefined,
    );
    if (knownUrls.some((knownUrl) => knownUrl !== url)) {
      if (resetOnUrlChange) options.operations.resetCaches();
      discardProcessedDocument(false);
    }

    if (!requiresReload && hasOutputAtUrl(url)) {
      const processedPairMatches = !hasProcessedDocument || hasSameProcessedPair(processedPair, settings);
      const selectionPairMatches = !hasSelectionConversion || hasSameProcessedPair(selectionPair, settings);
      if (!processedPairMatches || !selectionPairMatches) {
        options.operations.resetCaches();
        requiresReload = true;
        reloadRequiredUrl = url;
      }
    }
  };

  const activateWithFullScan = (settings: Settings, url: string) => {
    activeSettings = settings;
    activeUrl = url;
    try {
      scanDocument(settings);
      observe();
      hasFullScan = true;
      status = 'active';
      markProcessed(settings, url);
    } catch (error) {
      rollbackActivation();
      requiresReload = true;
      reloadRequiredUrl = url;
      try {
        options.operations.resetCaches();
      } catch {
        // Preserve the original activation failure.
      }
      throw error;
    }
  };

  const activateWhenInactive = (settings: Settings, url: string) => {
    cancelFallback();
    if (requiresReload && reloadRequiredUrl === url) {
      activateProcessedDocument(settings, url);
      return;
    }
    if (hasProcessedDocument && processedUrl === url) {
      activateProcessedDocument(settings, url);
      return;
    }
    if (hasProcessedDocument && processedUrl !== url) discardProcessedDocument();
    activateWithFullScan(settings, url);
  };

  const activateAfterUrlChange = (settings: Settings, url: string) => {
    cancelFallback();
    try {
      activeSettings = settings;
      activeUrl = url;
      scanDocument(settings);
      observe();
      status = 'active';
      markProcessed(settings, url);
    } catch (error) {
      rollbackActivation();
      requiresReload = true;
      reloadRequiredUrl = url;
      try {
        options.operations.resetCaches();
      } catch {
        // Preserve the original route-transition failure.
      }
      throw error;
    }
  };

  const updateSettings = (settings: Settings) => {
    const localePairChanged = !hasSameLocalePair(activeSettings!, settings);
    activeSettings = settings;
    if (!localePairChanged) {
      if (requiresReload && reloadRequiredUrl === activeUrl) status = 'reload-required';
      return;
    }
    cancelFallback();
    if (!requiresReload) options.operations.resetCaches();
    requiresReload = true;
    reloadRequiredUrl = activeUrl;
    status = 'reload-required';
  };

  const reconcile = async (settings: Settings) => {
    if (disposed) return;

    const url = options.getUrl();
    const routeChanged = activeUrl !== undefined && activeUrl !== url;
    if (routeChanged) options.operations.resetCaches();
    prepareDocumentState(settings, url, !routeChanged);
    if (!isEligible(settings, url)) {
      stop();
      return;
    }
    if (!activeSettings || !hasFullScan) {
      activateWhenInactive(settings, url);
      return;
    }
    if (activeUrl !== url) {
      activateAfterUrlChange(settings, url);
      return;
    }
    updateSettings(settings);
  };

  return {
    reconcile,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stop();
    },
    getStatus: () => status,
    getDocumentState: (settings) => {
      const url = options.getUrl();
      prepareDocumentState(settings, url);
      if (requiresReload && reloadRequiredUrl === url) return 'reload-required';
      if (hasProcessedDocument && processedUrl === url && !hasSameProcessedPair(processedPair, settings)) {
        return 'reload-required';
      }
      if (hasSelectionConversion && selectionUrl === url && !hasSameProcessedPair(selectionPair, settings)) {
        return 'reload-required';
      }
      if (!hasProcessedDocument || processedUrl !== url) return 'unprocessed';
      return 'processed';
    },
    markDocumentProcessed: (settings) => markProcessed(settings, options.getUrl()),
    markSelectionProcessed: (settings) => {
      hasSelectionConversion = true;
      selectionPair = { origin: settings.origin, target: settings.target };
      selectionUrl = options.getUrl();
    },
    markConversionFailed,
  };
}
