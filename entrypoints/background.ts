import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

import type { VariantCode } from '@/lib/constants';
import {
  type ContentMessage,
  type ConvertPageResponse,
  type PageStatusResponse,
  type PopupMessage,
  type RuntimeMessageResponse,
  isPopupMessage,
} from '@/lib/messaging';
import { settingsItem } from '@/lib/storage';

const HTTP_URL_PATTERN = /^https?:/i;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown extension error';
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function canAccessTab(
  tab: Awaited<ReturnType<typeof getActiveTab>>,
): tab is typeof tab & { id: number } {
  return typeof tab?.id === 'number' && (!tab.url || HTTP_URL_PATTERN.test(tab.url));
}

async function sendContentMessage<T>(tabId: number, message: ContentMessage): Promise<T> {
  const response: unknown = await browser.tabs.sendMessage(tabId, message);
  return response as T;
}

async function createContextMenus(): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: 'convert-selection',
    title: 'Convert selected text',
    contexts: ['selection'],
  });
}

async function updateBadge(tabId: number, origin: VariantCode, target: VariantCode): Promise<void> {
  const badgeMap: Partial<Record<`${VariantCode}->${VariantCode}`, string>> = {
    'cn->tw': '繁',
    'cn->twp': '臺',
    'cn->hk': '港',
    'tw->cn': '简',
    'twp->cn': '简',
    'hk->cn': '简',
    'jp->cn': '简',
  };

  await browser.action.setBadgeText({
    text: badgeMap[`${origin}->${target}`] ?? '✓',
    tabId,
  });
  await browser.action.setBadgeBackgroundColor({ color: '#1a73e8', tabId });
}

async function clearBadge(tabId: number): Promise<void> {
  await browser.action.setBadgeText({ text: '', tabId });
}

async function convertActiveTab(
  message: Extract<PopupMessage, { type: 'CONVERT_ACTIVE_TAB' }>,
): Promise<RuntimeMessageResponse<ConvertPageResponse>> {
  const tab = await getActiveTab();
  if (!canAccessTab(tab)) {
    return { ok: false, error: 'This page cannot be accessed by the extension.' };
  }

  const settings = await settingsItem.getValue();
  const origin = message.origin ?? settings.origin;
  const target = message.target ?? settings.target;
  const response = await sendContentMessage<ConvertPageResponse>(tab.id, {
    type: 'CONVERT_PAGE',
    origin,
    target,
    autoMode: message.autoMode ?? settings.autoMode,
  });

  if (response.isConverted) {
    await updateBadge(tab.id, origin, target);
  } else {
    await clearBadge(tab.id);
  }

  return { ok: true, data: response };
}

async function restoreActiveTab(): Promise<RuntimeMessageResponse<PageStatusResponse>> {
  const tab = await getActiveTab();
  if (!canAccessTab(tab)) {
    return { ok: false, error: 'This page cannot be accessed by the extension.' };
  }

  const response = await sendContentMessage<PageStatusResponse>(tab.id, { type: 'RESTORE_PAGE' });
  await clearBadge(tab.id);
  return { ok: true, data: response };
}

async function getActiveTabStatus(): Promise<RuntimeMessageResponse<PageStatusResponse>> {
  const tab = await getActiveTab();
  if (!canAccessTab(tab)) {
    return { ok: true, data: { isConverted: false } };
  }

  const response = await sendContentMessage<PageStatusResponse>(tab.id, {
    type: 'GET_PAGE_STATUS',
  });
  return { ok: true, data: response };
}

async function handlePopupMessage(message: PopupMessage): Promise<RuntimeMessageResponse> {
  try {
    switch (message.type) {
      case 'CONVERT_ACTIVE_TAB':
        return await convertActiveTab(message);
      case 'RESTORE_ACTIVE_TAB':
        return await restoreActiveTab();
      case 'GET_ACTIVE_TAB_STATUS':
        return await getActiveTabStatus();
    }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void createContextMenus();
  });
  void createContextMenus();

  browser.commands.onCommand.addListener((command) => {
    if (command === 'convert-page') {
      void convertActiveTab({ type: 'CONVERT_ACTIVE_TAB' });
    }
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'convert-selection' || typeof tab?.id !== 'number') {
      return;
    }

    const tabId = tab.id;
    void settingsItem.getValue().then((settings) => {
      void sendContentMessage(tabId, {
        type: 'CONVERT_SELECTION',
        origin: settings.origin,
        target: settings.target,
      });
    });
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isPopupMessage(message)) {
      return false;
    }

    void handlePopupMessage(message).then(sendResponse);
    return true;
  });
});
