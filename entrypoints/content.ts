import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';

import {
  canConvertText,
  countConvertibleTextNodes,
  createConverter,
  createHTMLConverter,
  getLangTag,
} from '@/lib/converter';
import { isDomainBlocked } from '@/lib/domain-matcher';
import {
  type ContentMessage,
  type ConvertPageMessage,
  type ConvertPageResponse,
  type PageStatusResponse,
  isContentMessage,
} from '@/lib/messaging';
import {
  domainListItem,
  saveSitePreference,
  settingsItem,
  sitePreferencesItem,
} from '@/lib/storage';
import type { ConverterFunction, HTMLConvertHandler } from 'opencc-js/core';

interface ActiveConversion {
  origin: ConvertPageMessage['origin'];
  target: ConvertPageMessage['target'];
  converter: ConverterFunction;
  dynamicHandlers: HTMLConvertHandler[];
  mainHandler: HTMLConvertHandler;
  observer?: MutationObserver;
}

let activeConversion: ActiveConversion | undefined;

function getStatus(): PageStatusResponse {
  return activeConversion
    ? {
        isConverted: true,
        origin: activeConversion.origin,
        target: activeConversion.target,
      }
    : { isConverted: false };
}

async function isCurrentDomainBlocked(): Promise<boolean> {
  const hostname = globalThis.location.hostname;
  if (!hostname) {
    return false;
  }

  return isDomainBlocked(hostname, await domainListItem.getValue());
}

function restorePage(): PageStatusResponse {
  if (!activeConversion) {
    return { isConverted: false };
  }

  activeConversion.observer?.disconnect();
  for (const handler of activeConversion.dynamicHandlers.reverse()) {
    handler.restore();
  }
  activeConversion.mainHandler.restore();
  activeConversion = undefined;
  return { isConverted: false };
}

function convertElement(active: ActiveConversion, element: HTMLElement): void {
  const count = countConvertibleTextNodes(element, active.converter);
  if (count === 0) {
    return;
  }

  const handler = createHTMLConverter(
    active.converter,
    element,
    getLangTag(active.origin),
    getLangTag(active.target),
  );
  handler.convert();
  active.dynamicHandlers.push(handler);
}

function startAutoObserver(active: ActiveConversion): void {
  active.observer?.disconnect();
  active.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData' && mutation.target.parentElement) {
        convertElement(active, mutation.target.parentElement);
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          convertElement(active, node);
        } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
          convertElement(active, node.parentElement);
        }
      }
    }
  });
  active.observer.observe(document.documentElement, {
    characterData: true,
    childList: true,
    subtree: true,
  });
}

async function convertPage(message: ConvertPageMessage): Promise<ConvertPageResponse> {
  const start = performance.now();

  if (message.origin === message.target || (await isCurrentDomainBlocked())) {
    restorePage();
    return { isConverted: false, count: 0, time: Math.round(performance.now() - start) };
  }

  restorePage();

  const converter = createConverter(message.origin, message.target);
  const count = countConvertibleTextNodes(document.documentElement, converter);
  const mainHandler = createHTMLConverter(
    converter,
    document.documentElement,
    getLangTag(message.origin),
    getLangTag(message.target),
  );

  mainHandler.convert();
  activeConversion = {
    origin: message.origin,
    target: message.target,
    converter,
    dynamicHandlers: [],
    mainHandler,
  };

  if (message.autoMode) {
    startAutoObserver(activeConversion);
  }

  await saveSitePreference(globalThis.location.hostname, {
    origin: message.origin,
    target: message.target,
  });

  return {
    isConverted: true,
    origin: message.origin,
    target: message.target,
    count,
    time: Math.round(performance.now() - start),
  };
}

function convertSelection(
  message: Extract<ContentMessage, { type: 'CONVERT_SELECTION' }>,
): boolean {
  const selection = globalThis.getSelection();
  if (!selection || selection.rangeCount === 0 || message.origin === message.target) {
    return false;
  }

  const converter = createConverter(message.origin, message.target);
  let changed = false;

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    const fragment = range.cloneContents();
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      if (!canConvertText(text)) {
        continue;
      }

      const converted = converter(text);
      if (converted !== text) {
        node.textContent = converted;
        changed = true;
      }
    }

    if (changed) {
      range.deleteContents();
      range.insertNode(fragment);
    }
  }

  return changed;
}

async function handleContentMessage(message: ContentMessage) {
  switch (message.type) {
    case 'CONVERT_PAGE':
      return convertPage(message);
    case 'RESTORE_PAGE':
      return restorePage();
    case 'GET_PAGE_STATUS':
      return getStatus();
    case 'CONVERT_SELECTION':
      return convertSelection(message);
  }
}

async function applySavedOrAutoPreference(): Promise<void> {
  if (await isCurrentDomainBlocked()) {
    return;
  }

  const hostname = globalThis.location.hostname;
  const [settings, preferences] = await Promise.all([
    settingsItem.getValue(),
    sitePreferencesItem.getValue(),
  ]);
  const sitePreference = hostname ? preferences[hostname] : undefined;

  if (sitePreference) {
    await convertPage({
      type: 'CONVERT_PAGE',
      origin: sitePreference.origin,
      target: sitePreference.target,
      autoMode: true,
    });
  } else if (settings.autoMode) {
    await convertPage({
      type: 'CONVERT_PAGE',
      origin: settings.origin,
      target: settings.target,
      autoMode: true,
    });
  }
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',

  main() {
    void applySavedOrAutoPreference();

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isContentMessage(message)) {
        return false;
      }

      void handleContentMessage(message).then(sendResponse);
      return true;
    });
  },
});
