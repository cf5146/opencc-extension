/// <reference types="vitest" />

type LegacyEvent<Arguments extends unknown[]> = {
  addListener(listener: (...args: Arguments) => void): void;
};

type LegacyTab = { id?: number };
type LegacyStorageChange = { oldValue?: unknown; newValue?: unknown };
type LegacyContextMenuInfo = { menuItemId: string | number; selectionText?: string };
type LegacyMessage = { action?: string };

declare const chrome: {
  contextMenus: {
    remove(menuItemId: string | number, callback: () => void): void;
    create(properties: Record<string, unknown>, callback: () => void): void;
    onClicked: LegacyEvent<[LegacyContextMenuInfo, LegacyTab?]>;
  };
  runtime: {
    lastError?: { message?: string };
    onInstalled: LegacyEvent<[]>;
    onMessage: LegacyEvent<[LegacyMessage]>;
  };
  action: {
    setBadgeBackgroundColor(details: { color: string }): void;
    setBadgeText(details: { text: string }): void;
  };
  storage: {
    local: {
      get(defaults: Record<string, unknown>): Promise<Record<string, unknown>>;
    };
    onChanged: LegacyEvent<[Record<string, LegacyStorageChange>, string]>;
  };
  scripting?: {
    registerContentScripts?: (scripts: Record<string, unknown>[]) => Promise<void>;
    getRegisteredContentScripts: (options?: { ids?: string[] }) => Promise<Record<string, unknown>[]>;
    unregisterContentScripts: (options: { ids: string[] }) => Promise<void>;
  };
  tabs: {
    query(options: { active: boolean; currentWindow: boolean }): Promise<LegacyTab[]>;
    sendMessage(tabId: number, message: Record<string, unknown>): void;
  };
};

declare module "jsdom";
