import type { ContentRequest, ConversionResponse, RuntimeMessage } from '../runtime/messages.js';

export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export interface StoragePort {
  get(defaults: Record<string, unknown>): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  subscribe(listener: (changes: Record<string, StorageChange>, areaName: string) => void): () => void;
}

export interface MessageSender {
  tabId?: number;
}

export type RuntimeMessageListener = (
  message: RuntimeMessage,
  sender: MessageSender,
) => Promise<ConversionResponse | undefined>;

export interface RuntimePort {
  send<TResponse extends ConversionResponse>(message: RuntimeMessage): Promise<TResponse>;
  subscribe(listener: RuntimeMessageListener): () => void;
}

export interface ActiveTab {
  id: number;
  url?: string;
}

export interface TabsPort {
  getActive(): Promise<ActiveTab | undefined>;
  send<TResponse extends ConversionResponse>(tabId: number, message: ContentRequest): Promise<TResponse>;
}

export interface ScriptingPort {
  injectContentScript(tabId: number): Promise<void>;
}

export interface ContextMenuClickInfo {
  menuItemId: string | number;
  tabId?: number;
}

export interface ContextMenusPort {
  ensureSelectionMenu(): Promise<void>;
  subscribe(listener: (info: ContextMenuClickInfo) => void): () => void;
}

export interface ActionPort {
  setBadgeText(text: string): Promise<void>;
  setBadgeBackgroundColor(color: string): Promise<void>;
}

export interface RuntimeManifest {
  version?: string;
  content_scripts?: Array<{ js?: string[] }>;
}

export type PlatformErrorCode =
  | 'no-receiver'
  | 'unsupported-capability'
  | 'request-failed'
  | 'permission-denied';

export class PlatformError extends Error {
  constructor(
    public readonly code: PlatformErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

export interface ExtensionPlatform {
  storage: StoragePort;
  runtime: RuntimePort;
  tabs: TabsPort;
  scripting: ScriptingPort;
  contextMenus: ContextMenusPort;
  action: ActionPort;
  getManifest(): RuntimeManifest;
}
