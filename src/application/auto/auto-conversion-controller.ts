import { createConversionQueue } from "./conversion-queue.js";
import { isAutoEnabled } from "../settings/settings.js";
import { matchesWhitelist } from "../../core/whitelist.js";
import type { Settings } from "../settings/settings.js";

export interface ObserverPort {
  observe(target: Node, options: MutationObserverInit): void;
  disconnect(): void;
}

export interface TimerPort {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
  dispose?(): void;
}

export interface AutoConversionOperations {
  convertTextNode(from: Settings["origin"], to: Settings["target"], node: Text): boolean;
  convertDocument(
    from: Settings["origin"],
    to: Settings["target"],
    root: HTMLElement | DocumentFragment | null,
  ): number;
  convertTitle(from: Settings["origin"], to: Settings["target"]): void;
  convertSelection(from: Settings["origin"], to: Settings["target"], selection: Selection | null): boolean;
  hasConverted(node: Node, from: Settings["origin"], to: Settings["target"]): boolean;
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

export type AutoStatus = "inactive" | "active" | "reload-required";
export type DocumentConversionState = "unprocessed" | "processed" | "reload-required";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

type MutationObserverInit = {
  childList?: boolean;
  subtree?: boolean;
  characterData?: boolean;
};

function createDefaultObserver(document: Document, listener: (mutations: MutationRecord[]) => void): ObserverPort {
  const MutationObserverConstructor = document.defaultView?.MutationObserver;
  if (!MutationObserverConstructor) {
    throw new Error("MutationObserver is unavailable");
  }

  const observer = new MutationObserverConstructor(listener);
  return {
    observe: (target, options) => observer.observe(target, options),
    disconnect: () => observer.disconnect(),
  };
}

function createDefaultTimer(document: Document): TimerPort {
  const Channel = document.defaultView?.MessageChannel;
  if (!Channel)
    return {
      schedule: (callback) => globalThis.setTimeout(callback, 0),
      cancel: (handle) => globalThis.clearTimeout(handle as number),
    };
  // Posted tasks yield to the browser without nested setTimeout's minimum delay.
  const channel = new Channel();
  let next = 0;
  const callbacks = new Map<number, () => void>();
  channel.port1.onmessage = (event) => {
    const callback = callbacks.get(event.data);
    callbacks.delete(event.data);
    callback?.();
  };
  return {
    schedule: (callback) => {
      callbacks.set(++next, callback);
      channel.port2.postMessage(next);
      return next;
    },
    cancel: (handle) => {
      callbacks.delete(handle as number);
    },
    dispose: () => {
      callbacks.clear();
      channel.port1.close();
      channel.port2.close();
    },
  };
}

type LocalePair = Pick<Settings, "origin" | "target">;

function hasSameLocalePair(left: LocalePair | undefined, right: LocalePair): boolean {
  return left?.origin === right.origin && left.target === right.target;
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
  const timer = options.timer ?? createDefaultTimer(options.document);

  let status: AutoStatus = "inactive";
  let observer: ObserverPort | undefined;
  let activeSettings: Settings | undefined;
  let activeUrl: string | undefined;
  let hasFullScan = false;
  let hasProcessedDocument = false;
  let processedPair: LocalePair | undefined;
  let processedUrl: string | undefined;
  let hasSelectionConversion = false;
  let selectionPair: LocalePair | undefined;
  let selectionUrl: string | undefined;
  let requiresReload = false;
  let reloadRequiredUrl: string | undefined;
  let disposed = false;
  const queue = createConversionQueue({
    document: options.document,
    convert: (node) => {
      if (activeSettings) options.operations.convertTextNode(activeSettings.origin, activeSettings.target, node);
    },
    beforeFlush: () => {
      if (disposed || !activeSettings || requiresReload) return false;
      if (activeUrl !== options.getUrl()) {
        const settings = activeSettings;
        void Promise.resolve()
          .then(() => reconcile(settings))
          .catch(markConversionFailed);
        return false;
      }
      if (!isEligible(activeSettings, options.getUrl())) {
        stop();
        return false;
      }
      return true;
    },
    onError: () => markConversionFailed(),
    schedule: (callback) => timer.schedule(callback, 0),
    cancel: (handle) => timer.cancel(handle),
  });

  const cancelFallback = () => queue.clear();
  const stop = () => {
    queue.clear();
    observer?.disconnect();
    observer = undefined;
    activeSettings = undefined;
    activeUrl = undefined;
    hasFullScan = false;
    status = "inactive";
  };

  const processMutations = async (mutations: MutationRecord[]) => {
    if (disposed || !observer || !activeSettings || status !== "active") return;
    if (activeUrl !== options.getUrl()) await reconcile(activeSettings);
    if (!activeSettings || !isEligible(activeSettings, options.getUrl())) {
      stop();
      return;
    }
    for (const mutation of mutations) {
      if (
        mutation.type === "characterData" &&
        !options.operations.hasConverted(mutation.target, activeSettings.origin, activeSettings.target)
      ) {
        queue.enqueue(mutation.target);
      }
      for (const node of mutation.addedNodes) {
        if (
          node.nodeType === TEXT_NODE &&
          options.operations.hasConverted(node, activeSettings.origin, activeSettings.target)
        )
          continue;
        if (node.nodeType === TEXT_NODE || node.nodeType === ELEMENT_NODE) queue.enqueue(node);
      }
    }
  };
  const handleMutations = (mutations: MutationRecord[]) => {
    void processMutations(mutations).catch(markConversionFailed);
  };

  const observe = () => {
    if (observer || !options.document.body) return;
    observer = observerFactory(handleMutations);
    observer.observe(options.document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  const scanDocument = (settings: Settings) => {
    options.operations.convertTitle(settings.origin, settings.target);
    queue.enqueue(options.document.body);
  };

  const rollbackActivation = () => {
    queue.clear();
    observer?.disconnect();
    observer = undefined;
    activeSettings = undefined;
    activeUrl = undefined;
    hasFullScan = false;
    status = "inactive";
  };

  const isEligible = (settings: Settings, url: string) => {
    const lang = options.document.documentElement?.lang ?? "";
    return (
      isAutoEnabled(settings, url) &&
      settings.origin !== settings.target &&
      (lang.length === 0 || lang.startsWith("zh")) &&
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
      hasFullScan = true;
      const pairMatches = hasSameLocalePair(processedPair, settings);
      status = requiresReload || !pairMatches ? "reload-required" : "active";
      if (status === "active") {
        observe();
        queue.enqueue(options.document.body);
      }
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
    observer?.disconnect();
    observer = undefined;
    requiresReload = true;
    reloadRequiredUrl = options.getUrl();
    status = "reload-required";
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
      const processedPairMatches = !hasProcessedDocument || hasSameLocalePair(processedPair, settings);
      const selectionPairMatches = !hasSelectionConversion || hasSameLocalePair(selectionPair, settings);
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
      status = "active";
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
      status = "active";
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
    const localePairChanged = !hasSameLocalePair(activeSettings, settings);
    activeSettings = settings;
    if (!localePairChanged) {
      if (requiresReload && reloadRequiredUrl === activeUrl) status = "reload-required";
      return;
    }
    cancelFallback();
    observer?.disconnect();
    observer = undefined;
    if (!requiresReload) options.operations.resetCaches();
    requiresReload = true;
    reloadRequiredUrl = activeUrl;
    status = "reload-required";
  };

  const reconcile = async (settings: Settings) => {
    if (disposed) return;

    const url = options.getUrl();
    const routeChanged = activeUrl !== undefined && activeUrl !== url;
    if (routeChanged) {
      queue.clear();
      options.operations.resetCaches();
    }
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
      timer.dispose?.();
    },
    getStatus: () => status,
    getDocumentState: (settings) => {
      const url = options.getUrl();
      prepareDocumentState(settings, url);
      if (requiresReload && reloadRequiredUrl === url) return "reload-required";
      if (hasProcessedDocument && processedUrl === url && !hasSameLocalePair(processedPair, settings)) {
        return "reload-required";
      }
      if (hasSelectionConversion && selectionUrl === url && !hasSameLocalePair(selectionPair, settings)) {
        return "reload-required";
      }
      if (!hasProcessedDocument || processedUrl !== url) return "unprocessed";
      return "processed";
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
