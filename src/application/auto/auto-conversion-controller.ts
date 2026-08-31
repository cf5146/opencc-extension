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

export interface AutoConversionController {
  reconcile(settings: Settings): Promise<void>;
  dispose(): void;
  getStatus(): AutoStatus;
}

const FALLBACK_DELAY_MS = 250;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

type MutationObserverInit = {
  childList?: boolean;
  subtree?: boolean;
  characterData?: boolean;
  characterDataOldValue?: boolean;
  attributes?: boolean;
  attributeOldValue?: boolean;
  attributeFilter?: string[];
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

export function createAutoConversionController(options: AutoConversionControllerOptions): AutoConversionController {
  const isWhitelisted = options.isWhitelisted ?? matchesWhitelist;
  const observerFactory = options.observerFactory ?? ((listener) => createDefaultObserver(options.document, listener));
  const timer = options.timer ?? defaultTimer;

  let status: AutoStatus = 'inactive';
  let observer: ObserverPort | undefined;
  let activeSettings: Settings | undefined;
  let activeUrl: string | undefined;
  let hasFullScan = false;
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
      if (
        disposed ||
        !observer ||
        status !== 'active' ||
        !currentSettings ||
        activeUrl !== expectedUrl ||
        currentSettings.origin !== expectedOrigin ||
        currentSettings.target !== expectedTarget
      ) {
        return;
      }

      void Promise.resolve()
        .then(() => options.operations.convertDocument(currentSettings.origin, currentSettings.target, options.document.body))
        .catch(() => {});
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

  const processMutation = (mutation: MutationRecord, settings: Settings) => {
    let incremental = 0;
    if (mutation.type === 'characterData' && mutation.target.nodeType === TEXT_NODE) {
      if (options.operations.convertTextNode(settings.origin, settings.target, mutation.target as Text)) {
        incremental += 1;
      }
    }
    for (const node of Array.from(mutation.addedNodes)) {
      incremental += convertAddedNode(node, settings);
    }
    return incremental;
  };

  const processMutations = async (mutations: MutationRecord[]) => {
    if (disposed || !observer || !activeSettings || status === 'inactive') return;

    const settings = activeSettings;
    const incremental = mutations.reduce((count, mutation) => count + processMutation(mutation, settings), 0);
    if (incremental === 0) scheduleFallback();
  };

  const handleMutations = (mutations: MutationRecord[]) => {
    void processMutations(mutations).catch(() => {});
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

  const reconcile = async (settings: Settings) => {
    if (disposed) return;

    const url = options.getUrl();
    const lang = options.document.documentElement?.lang ?? '';
    if (
      !settings.auto ||
      settings.origin === settings.target ||
      (lang.length > 0 && !lang.startsWith('zh')) ||
      isWhitelisted(url, settings.whitelist)
    ) {
      stop();
      return;
    }

    if (!activeSettings || !hasFullScan) {
      cancelFallback();
      activeSettings = settings;
      activeUrl = url;
      hasFullScan = true;
      status = 'active';
      scanDocument(settings);
      observe();
      return;
    }

    const urlChanged = activeUrl !== url;
    if (urlChanged) {
      cancelFallback();
      options.operations.resetCaches();
      activeSettings = settings;
      activeUrl = url;
      status = 'active';
      scanDocument(settings);
      observe();
      return;
    }

    const localePairChanged = !hasSameLocalePair(activeSettings, settings);
    activeSettings = settings;
    if (localePairChanged) {
      cancelFallback();
      options.operations.resetCaches();
      status = 'reload-required';
    }
  };

  return {
    reconcile,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stop();
    },
    getStatus: () => status,
  };
}