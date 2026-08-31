# WebExtension Runtime and Build Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-built browser runtime and esbuild manifest pipeline with a WXT-based, shared Chrome/Edge/Firefox MV3 extension while preserving page, selection, textbox, auto-mode, whitelist, and settings capabilities.

**Architecture:** WXT owns extension entrypoints, target manifests, development output, and packaging. Browser-neutral application modules own settings, conversion orchestration, auto-mode lifecycle, and typed results; a narrow platform adapter is the only runtime module that imports WXT's browser API. The content script is statically registered for every target, while the background owns active-tab routing and a single injection fallback for stale tabs.

**Tech Stack:** TypeScript 5.9, WXT, `@wxt-dev/browser`, Vitest 4, JSDOM, vanilla HTML/CSS, npm, Chrome/Edge/Firefox Manifest V3.

**Spec:** [docs/superpowers/specs/2026-08-31-webextension-runtime-build-rewrite-design.md](../specs/2026-08-31-webextension-runtime-build-rewrite-design.md)

## Global Constraints

- "Build Chrome, Edge, and Firefox from one source tree."
- "Pin every output to Manifest V3."
- "Use a statically declared content script for all three targets."
- "Auto-conversion remains a core capability."
- "The extension remains offline-only and must not add remote code, analytics, or page-text persistence."
- "Remove the broad `tabs` permission from every shipped manifest."
- "WXT is the build and extension-entrypoint layer only."
- "Existing `src/domain`, `src/core`, `src/application/conversion`, and `src/infrastructure/conversion` modules remain shared and browser-neutral."
- "No generated build output or browser-specific source duplication is required to maintain the extension."
- "Browser globals are confined to the platform adapter; entrypoints use platform interfaces."
- Use `rtk` before every shell command in this repository.
- Do not commit generated `.output/`, `dist/`, `build/`, coverage, or zip artifacts.

---

## File Map

Create these files:

- `wxt.config.ts`: WXT target, output, manifest, and zip configuration.
- `public/icon.png`: WXT public asset copied from the current root `icon.png`.
- `src/build/manifest.ts`: Pure target-aware base manifest factory.
- `entrypoints/background.ts`: WXT background entrypoint wrapper.
- `entrypoints/content.ts`: WXT static content-script entrypoint wrapper.
- `entrypoints/popup/index.html`: Popup HTML entrypoint.
- `entrypoints/popup/main.ts`: Popup WXT wrapper.
- `entrypoints/popup/style.css`: Popup CSS entrypoint.
- `entrypoints/options/index.html`: Options HTML entrypoint.
- `entrypoints/options/main.ts`: Options WXT wrapper.
- `entrypoints/options/style.css`: Options CSS entrypoint.
- `src/runtime/messages.ts`: Runtime request and response unions.
- `src/platform/types.ts`: Browser-neutral storage, runtime, tab, scripting, menu, and action ports.
- `src/platform/browser-platform.ts`: WXT browser API implementation of the ports.
- `src/platform/index.ts`: Platform exports.
- `tests/helpers/fakes.ts`: Shared fake platform, settings store, runtime listener, context-menu dispatcher, and conversion operation factories.
- `src/application/settings/settings.ts`: Settings types, defaults, normalization, and patch merging.
- `src/application/settings/settings-store.ts`: Storage-backed settings store.
- `src/application/settings/index.ts`: Settings exports.
- `src/application/auto/auto-conversion-controller.ts`: Pure auto-mode observer lifecycle and mutation controller.
- `src/application/auto/index.ts`: Auto-controller exports.
- `src/application/runtime/background-runtime.ts`: Background orchestration against platform ports.
- `src/application/runtime/content-runtime.ts`: Content message handling and auto-controller orchestration.
- `src/application/runtime/index.ts`: Runtime orchestration exports.
- `src/application/ui/popup-controller.ts`: Injectable popup DOM and platform behavior.
- `src/application/ui/options-controller.ts`: Injectable options DOM and platform behavior.
- `src/application/ui/index.ts`: UI controller exports.
- `tests/manifest.test.ts`: Pure target manifest tests.
- `tests/settings.test.ts`: Settings normalization and patch tests.
- `tests/settings-store.test.ts`: Storage-backed settings tests.
- `tests/auto-conversion-controller.test.ts`: Auto-mode lifecycle and mutation tests.
- `tests/browser-platform.test.ts`: Platform adapter tests with injected browser fakes.
- `tests/background-runtime.test.ts`: Background routing, injection, menu, and badge tests.
- `tests/content-runtime.test.ts`: Content message and controller lifecycle tests.
- `tests/popup-controller.test.ts`: Popup behavior tests using JSDOM and a fake platform.
- `tests/options-controller.test.ts`: Options persistence tests using JSDOM and a fake platform.
- `scripts/verify-build-output.mjs`: Generated manifest and entrypoint verification.

Modify these files:

- `package.json` and `package-lock.json`: Add WXT dependencies and target scripts; remove direct esbuild, web-ext, and Chrome type dependencies after migration.
- `tsconfig.json`: Extend WXT's generated config and include entrypoints, shared source, tests, and WXT config.
- `eslint.config.mjs`: Lint WXT config and entrypoints with the correct module environments.
- `.gitignore`: Ignore `.output/` and `.wxt/`.
- `scripts/bump-version.cjs`: Update only `package.json`; WXT supplies manifest versioning.
- `.github/workflows/ci.yml`: Build and verify all three WXT targets and package all three zips on pushes.
- `README.md`, `CONTRIBUTING.md`, `PRIVACY.md`, `MV3_NOTES.md`: Document WXT commands, static registration, target policy, and the reduced permission set.

Delete these files only after the new runtime and builds pass:

- `build.mjs`
- `scripts/dev.mjs`
- `scripts/dist.mjs`
- `scripts/dist-all.mjs`
- `src/manifest.chrome.json`
- `src/manifest.edge.json`
- `src/manifest.firefox.json`
- `src/background.ts`
- `src/content.ts`
- `src/content/observer.ts`
- `src/popup/index.ts`
- `src/options/index.ts`

Move `icon.png` to `public/icon.png` without changing its bytes. Leave existing conversion and OpenCC data files untouched unless import paths require an extension-only adjustment.

---

### Task 1: Establish the WXT MV3 Build Baseline

**Files:**

- Create: `wxt.config.ts`
- Create: `src/build/manifest.ts`
- Create: `entrypoints/background.ts`
- Create: `entrypoints/content.ts`
- Create: `entrypoints/popup/index.html`
- Create: `entrypoints/popup/main.ts`
- Create: `entrypoints/popup/style.css`
- Create: `entrypoints/options/index.html`
- Create: `entrypoints/options/main.ts`
- Create: `entrypoints/options/style.css`
- Move: `icon.png` to `public/icon.png`
- Create: `tests/manifest.test.ts`
- Modify: `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`

**Interfaces:**

- Produces `TargetBrowser = 'chrome' | 'edge' | 'firefox'`.
- Produces `createManifest(browser: TargetBrowser): ExtensionManifest`.
- Produces WXT entrypoints that build as background, static content, popup, and options artifacts.

- [ ] **Step 1: Write the failing target manifest test**

Create `tests/manifest.test.ts` with this test contract:

```ts
import { describe, expect, it } from 'vitest';
import { createManifest, type TargetBrowser } from '../src/build/manifest.js';

const targets: TargetBrowser[] = ['chrome', 'edge', 'firefox'];

describe('target manifest factory', () => {
  it.each(targets)('creates an MV3 manifest for %s', (browser) => {
    const manifest = createManifest(browser);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['storage', 'contextMenus', 'scripting', 'activeTab']),
    );
    expect(manifest.permissions).not.toContain('tabs');
    expect(manifest.host_permissions).toEqual(['http://*/*', 'https://*/*']);
    expect(manifest.options_ui).toEqual({ page: 'options.html', open_in_tab: false });
    expect(manifest.action.default_popup).toBe('popup.html');
  });

  it('uses an MV3 service worker for Chromium targets', () => {
    expect(createManifest('chrome').background).toEqual({
      service_worker: 'background.js',
      type: 'module',
    });
    expect(createManifest('edge').background).toEqual({
      service_worker: 'background.js',
      type: 'module',
    });
  });

  it('uses the Firefox MV3 background shape and preserves the Gecko ID', () => {
    expect(createManifest('firefox').background).toEqual({ scripts: ['background.js'] });
    expect(createManifest('firefox').browser_specific_settings).toEqual({
      gecko: { id: 'opencc.extension@tnychn' },
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk npm test -- tests/manifest.test.ts`

Expected: FAIL because `src/build/manifest.ts` does not exist yet.

- [ ] **Step 3: Add the pure manifest factory**

Create `src/build/manifest.ts` with a typed common manifest and only the intentional Firefox background and identity difference:

```ts
export type TargetBrowser = 'chrome' | 'edge' | 'firefox';

type ChromiumBackground = { service_worker: string; type: 'module' };
type FirefoxBackground = { scripts: string[] };

export interface ExtensionManifest {
  manifest_version: 3;
  name: string;
  author: string;
  version?: string;
  description: string;
  homepage_url: string;
  icons: { 128: string };
  options_ui: { page: string; open_in_tab: boolean };
  action: {
    default_icon: { 128: string };
    default_title: string;
    default_popup: string;
  };
  background: ChromiumBackground | FirefoxBackground;
  permissions: string[];
  host_permissions: string[];
  browser_specific_settings?: { gecko: { id: string } };
}

const commonManifest = {
  manifest_version: 3 as const,
  name: 'OpenCC',
  author: 'Tony Chan',
  description: 'Convert webpages between different Chinese variants.',
  homepage_url: 'https://github.com/tnychn/opencc-extension',
  icons: { 128: 'icon.png' },
  options_ui: { page: 'options.html', open_in_tab: false },
  action: {
    default_icon: { 128: 'icon.png' },
    default_title: 'OpenCC',
    default_popup: 'popup.html',
  },
  permissions: ['storage', 'contextMenus', 'scripting', 'activeTab'],
  host_permissions: ['http://*/*', 'https://*/*'],
};

export function createManifest(browser: TargetBrowser): ExtensionManifest {
  if (browser === 'firefox') {
    return {
      ...commonManifest,
      background: { scripts: ['background.js'] },
      browser_specific_settings: { gecko: { id: 'opencc.extension@tnychn' } },
    };
  }

  return {
    ...commonManifest,
    background: { service_worker: 'background.js', type: 'module' },
  };
}
```

- [ ] **Step 4: Add the WXT configuration and build-only entrypoints**

Create `wxt.config.ts` so output names are stable for CI and the zip artifact names remain unchanged:

```ts
import { defineConfig } from 'wxt';
import { createManifest, type TargetBrowser } from './src/build/manifest.js';

export default defineConfig({
  outDirTemplate: '.output/{{browser}}-mv{{manifestVersion}}',
  manifest: ({ browser }) => createManifest(browser as TargetBrowser),
  zip: {
    artifactTemplate: 'opencc.{{browser}}.zip',
    excludeSources: [],
  },
});
```

Create the initial WXT wrappers. They are build scaffolding only and are not packaged as a release until the later runtime tasks replace the no-op bodies:

```ts
// entrypoints/background.ts
import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {});
```

```ts
// entrypoints/content.ts
import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  allFrames: false,
  registration: 'manifest',
  main() {},
});
```

Copy the current popup and options markup and styles into their WXT directories. Preserve all current element IDs and form controls. Change only the asset references to WXT entrypoint-local files:

```html
<link rel="stylesheet" href="./style.css" />
<script type="module" src="./main.ts"></script>
```

Use `export {};` in the two temporary `main.ts` files until the UI controller task wires them:

```ts
export {};
```

- [ ] **Step 5: Install WXT dependencies and update TypeScript/lint configuration**

Run:

```text
rtk npm install --save-dev wxt @wxt-dev/browser
rtk npm uninstall --save-dev esbuild web-ext @types/chrome
rtk npx wxt prepare
```

Update `tsconfig.json` to extend generated WXT types while retaining strict checking for tests and shared modules:

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "target": "ES2021",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"]
    }
  },
  "include": ["src", "entrypoints", "tests", "wxt.config.ts", "scripts"],
  "exclude": ["dist", "build", "node_modules", ".output", ".wxt"]
}
```

Add `.output/` and `.wxt/` to `.gitignore`. Extend the TypeScript ESLint file globs to include `entrypoints/**/*.ts` and `wxt.config.ts`; retain the Node environment for `scripts/**/*.mjs` and use browser/DOM globals for entrypoint and shared runtime files.

Add these package scripts while keeping `test`, `lint`, `typecheck`, and `ci` names available:

```json
{
  "scripts": {
    "dev": "wxt --mv3",
    "dev:firefox": "wxt -b firefox --mv3",
    "dev:edge": "wxt -b edge --mv3",
    "build": "npm run build:chrome",
    "build:chrome": "wxt build -b chrome --mv3",
    "build:firefox": "wxt build -b firefox --mv3",
    "build:edge": "wxt build -b edge --mv3",
    "zip:chrome": "wxt zip -b chrome --mv3",
    "zip:firefox": "wxt zip -b firefox --mv3",
    "zip:edge": "wxt zip -b edge --mv3",
    "dist": "npm run zip:chrome && npm run zip:firefox && npm run zip:edge"
  }
}
```

- [ ] **Step 6: Build all targets and verify the baseline**

Run:

```text
rtk npm run typecheck
rtk npm test -- tests/manifest.test.ts
rtk npm run build:chrome
rtk npm run build:firefox
rtk npm run build:edge
```

Expected: the focused tests pass, each WXT build exits successfully, and manifests are created under `.output/chrome-mv3/`, `.output/firefox-mv3/`, and `.output/edge-mv3/`.

- [ ] **Step 7: Commit the build baseline**

```text
rtk git add wxt.config.ts public/icon.png entrypoints src/build/manifest.ts tests/manifest.test.ts package.json package-lock.json tsconfig.json eslint.config.mjs .gitignore
rtk git commit -m "build: adopt WXT for MV3 targets"
```

---

### Task 2: Add Settings, Message, and Platform Port Contracts

**Files:**

- Create: `src/runtime/messages.ts`
- Create: `src/platform/types.ts`
- Create: `src/platform/index.ts`
- Create: `src/application/settings/settings.ts`
- Create: `src/application/settings/settings-store.ts`
- Create: `src/application/settings/index.ts`
- Create: `tests/helpers/fakes.ts`
- Create: `tests/settings.test.ts`
- Create: `tests/settings-store.test.ts`

**Interfaces:**

- Produces `Settings`, `SettingsPatch`, `DEFAULT_SETTINGS`, `normalizeSettings`, and `mergeSettings`.
- Produces `SettingsStore`, `createSettingsStore`, and storage subscription behavior.
- Produces `BackgroundRequest`, `ContentRequest`, `RuntimeMessage`, `ConversionResponse`, and `UnavailableReason`.
- Produces `ExtensionPlatform` and its narrow sub-ports for later runtime tasks.

- [ ] **Step 1: Write settings normalization tests**

Create `tests/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
  type Settings,
} from '../src/application/settings/settings.js';

describe('settings', () => {
  it('returns defaults for missing or malformed stored values', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        origin: 'invalid',
        target: 42,
        auto: 'yes',
        whitelist: [3],
        textboxSize: { width: -1, height: 'large' },
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and drops invalid whitelist entries', () => {
    expect(
      normalizeSettings({
        origin: 'tw',
        target: 'twp',
        auto: true,
        whitelist: ['example', 3, 'other'],
        textboxSize: { width: 480, height: 180 },
      }),
    ).toEqual({
      origin: 'tw',
      target: 'twp',
      auto: true,
      whitelist: ['example', 'other'],
      textboxSize: { width: 480, height: 180 },
    });
  });

  it('merges a patch without replacing unrelated settings', () => {
    const current: Settings = {
      ...DEFAULT_SETTINGS,
      origin: 'cn',
      target: 'hk',
      whitelist: ['code'],
    };

    expect(mergeSettings(current, { auto: true, textboxSize: { width: 400 } })).toEqual({
      origin: 'cn',
      target: 'hk',
      auto: true,
      whitelist: ['code'],
      textboxSize: { width: 400, height: null },
    });
  });
});
```

- [ ] **Step 2: Run the settings tests and verify they fail**

Run: `rtk npm test -- tests/settings.test.ts`

Expected: FAIL because the settings module does not exist.

- [ ] **Step 3: Implement settings types and normalization**

Create `src/application/settings/settings.ts` with these public declarations:

```ts
import { isLocaleCode, type LocaleCode } from '../../domain/conversion/locales.js';

export interface TextboxSize {
  width: number | null;
  height: number | null;
}

export interface Settings {
  origin: LocaleCode;
  target: LocaleCode;
  auto: boolean;
  whitelist: string[];
  textboxSize: TextboxSize;
}

export type SettingsPatch = Partial<Omit<Settings, 'textboxSize'>> & {
  textboxSize?: Partial<TextboxSize> | null;
};

export const DEFAULT_SETTINGS: Settings = {
  origin: 'cn',
  target: 'hk',
  auto: false,
  whitelist: [],
  textboxSize: { width: null, height: null },
};

export function normalizeSettings(raw: unknown): Settings;
export function mergeSettings(current: Settings, patch: unknown): Settings;
```

Normalization rules are exact: invalid locales use the corresponding defaults, non-boolean `auto` uses `false`, non-string whitelist entries are removed, dimensions must be finite positive numbers or become `null`, and missing nested textbox dimensions use their current/default values. Return new objects so callers cannot mutate `DEFAULT_SETTINGS`.

- [ ] **Step 4: Add message unions and platform port types**

Create `src/runtime/messages.ts`:

```ts
import type { LocaleCode } from '../domain/conversion/locales.js';

export type BackgroundRequest = { type: 'convert-active-tab' };
export type ContentRequest = { type: 'convert-page' } | { type: 'convert-selection' };
export type RuntimeMessage = BackgroundRequest | ContentRequest;

export type UnavailableReason =
  | 'no-active-tab'
  | 'unsupported-scheme'
  | 'missing-content-script'
  | 'injection-denied'
  | 'protected-page'
  | 'unsupported-capability';

export type ConversionResponse =
  | { kind: 'success'; count: number; time: number }
  | { kind: 'no-op'; count: 0; time: number }
  | { kind: 'reload-required' }
  | { kind: 'unavailable'; reason: UnavailableReason }
  | { kind: 'invalid-settings' }
  | { kind: 'internal-failure' };

export interface LocalePair {
  origin: LocaleCode;
  target: LocaleCode;
}
```

Create `src/platform/types.ts` with these ports:

```ts
import type { ConversionResponse, RuntimeMessage } from '../runtime/messages.js';
import type { ContentRequest } from '../runtime/messages.js';

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
```

Export all public settings, message, and port declarations from their `index.ts` files. Do not import WXT, `browser`, `chrome`, or DOM globals from these contract modules.

- [ ] **Step 5: Add and test the settings store**

Create `src/application/settings/settings-store.ts`:

```ts
import type { StoragePort } from '../../platform/types.js';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
  type Settings,
  type SettingsPatch,
} from './settings.js';

export interface SettingsStore {
  load(): Promise<Settings>;
  set(patch: SettingsPatch): Promise<Settings>;
  subscribe(listener: (settings: Settings) => void): () => void;
}

export function createSettingsStore(storage: StoragePort): SettingsStore;
```

`load()` calls `storage.get(DEFAULT_SETTINGS)` and normalizes the result. `set()` loads the current settings, merges the patch, writes the normalized settings object, and returns it. `subscribe()` listens only to local storage changes, reloads normalized settings, invokes the listener, and returns an unsubscribe function. A failed reload must not throw out of the storage event callback.

Create `tests/settings-store.test.ts` with an injected fake storage:

```ts
import type { StorageChange } from '../src/platform/types.js';

it('loads, normalizes, writes, and notifies through the storage port', async () => {
  let stored: Record<string, unknown> = { origin: 'cn', target: 'hk', auto: false };
  let notify: ((changes: Record<string, StorageChange>, area: string) => void) | undefined;
  const storage = {
    get: async () => stored,
    set: async (values: Record<string, unknown>) => { stored = values; },
    subscribe: (listener: (changes: Record<string, StorageChange>, area: string) => void) => {
      notify = listener;
      return () => { notify = undefined; };
    },
  };
  const store = createSettingsStore(storage);
  const seen: boolean[] = [];
  const unsubscribe = store.subscribe((settings) => seen.push(settings.auto));

  await store.set({ auto: true });
  notify?.({}, 'local');
  await Promise.resolve();

  expect((await store.load()).auto).toBe(true);
  expect(seen).toEqual([true]);
  unsubscribe();
});
```

Add `tests/helpers/fakes.ts` so later runtime tests use one typed fake instead of repeating loose browser mocks:

```ts
import type { Settings, SettingsPatch } from '../../src/application/settings/settings.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../../src/application/settings/settings.js';
import type { SettingsStore } from '../../src/application/settings/settings-store.js';
import type {
  ActionPort,
  ContextMenuClickInfo,
  ExtensionPlatform,
  RuntimeMessageListener,
  RuntimePort,
  StoragePort,
  ScriptingPort,
  TabsPort,
} from '../../src/platform/types.js';
import type { RuntimeMessage } from '../../src/runtime/messages.js';
import { vi } from 'vitest';

export type FakePlatformOverrides = {
  storage?: Partial<StoragePort>;
  runtime?: Partial<RuntimePort>;
  tabs?: Partial<TabsPort>;
  scripting?: Partial<ScriptingPort>;
  contextMenus?: Partial<ExtensionPlatform['contextMenus']>;
  action?: Partial<ActionPort>;
  getManifest?: ExtensionPlatform['getManifest'];
};

export function createFakePlatform(overrides: FakePlatformOverrides = {}): ExtensionPlatform {
  const noOpResponse = { kind: 'no-op' as const, count: 0 as const, time: 0 };
  return {
    storage: {
      get: async (defaults) => defaults,
      set: async () => {},
      subscribe: () => () => {},
      ...overrides.storage,
    } as StoragePort,
    runtime: {
      send: async <TResponse>() => noOpResponse as TResponse,
      subscribe: () => () => {},
      ...overrides.runtime,
    } as RuntimePort,
    tabs: {
      getActive: async () => undefined,
      send: async <TResponse>() => noOpResponse as TResponse,
      ...overrides.tabs,
    } as TabsPort,
    scripting: {
      injectContentScript: async () => {},
      ...overrides.scripting,
    } as ScriptingPort,
    contextMenus: {
      ensureSelectionMenu: async () => {},
      subscribe: () => () => {},
      ...overrides.contextMenus,
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
      ...overrides.action,
    },
    getManifest: overrides.getManifest ?? (() => ({})),
  };
}

export interface FakeSettingsStore extends SettingsStore {
  emit(next: Partial<Settings>): Promise<void>;
}

export function createFakeSettingsStore(initial: Partial<Settings> = {}): FakeSettingsStore {
  let current = mergeSettings(DEFAULT_SETTINGS, initial);
  const listeners = new Set<(settings: Settings) => void>();
  return {
    load: async () => current,
    set: async (patch: SettingsPatch) => {
      current = mergeSettings(current, patch);
      for (const listener of listeners) listener(current);
      return current;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: async (next) => {
      current = mergeSettings(current, next);
      for (const listener of listeners) listener(current);
    },
  };
}

export function createRuntimeListenerCapture() {
  let listener: RuntimeMessageListener | undefined;
  return {
    subscribe: (candidate: RuntimeMessageListener) => {
      listener = candidate;
      return () => { listener = undefined; };
    },
    invoke: (message: RuntimeMessage, sender = {}) => {
      if (!listener) throw new Error('runtime listener is not registered');
      return listener(message, sender);
    },
  };
}

export function createContextMenuDispatcher() {
  let listener: ((info: ContextMenuClickInfo) => void) | undefined;
  return {
    subscribe: (candidate: (info: ContextMenuClickInfo) => void) => {
      listener = candidate;
      return () => { listener = undefined; };
    },
    emit: (info: ContextMenuClickInfo) => listener?.(info),
  };
}

export function createRecordingConversionOperations() {
  return {
    convertTextNode: vi.fn().mockReturnValue(true),
    convertDocument: vi.fn().mockReturnValue(1),
    convertTitle: vi.fn(),
    convertSelection: vi.fn().mockReturnValue(false),
    resetCaches: vi.fn(),
  };
}
```

- [ ] **Step 6: Run the focused contract tests**

Run: `rtk npm test -- tests/settings.test.ts tests/settings-store.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the shared contracts**

```text
rtk git add src/runtime src/platform src/application/settings tests/helpers/fakes.ts tests/settings.test.ts tests/settings-store.test.ts
rtk git commit -m "refactor: add runtime and settings contracts"
```

---

### Task 3: Extract the Pure Auto-Conversion Controller

**Files:**

- Create: `src/application/auto/auto-conversion-controller.ts`
- Create: `src/application/auto/index.ts`
- Create: `tests/auto-conversion-controller.test.ts`

**Interfaces:**

- Consumes `Settings`, `matchesWhitelist`, and conversion operations from the existing core facade.
- Produces `AutoStatus = 'inactive' | 'active' | 'reload-required'`.
- Produces `createAutoConversionController(options)` with `reconcile(settings)`, `dispose()`, and `getStatus()`.
- Has no browser API dependency and accepts injected observer/timer factories for tests.

- [ ] **Step 1: Write the failing controller tests**

Create a fake observer and conversion operation recorder in `tests/auto-conversion-controller.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  createAutoConversionController,
  type AutoConversionOperations,
  type ObserverPort,
} from '../src/application/auto/auto-conversion-controller.js';
import { DEFAULT_SETTINGS, type Settings } from '../src/application/settings/settings.js';
import { createRecordingConversionOperations } from './helpers/fakes.js';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    textboxSize: { ...DEFAULT_SETTINGS.textboxSize, ...overrides.textboxSize },
  };
}

describe('auto conversion controller', () => {
  let dom: JSDOM;
  let callback: ((mutations: MutationRecord[]) => void) | undefined;
  let observer: ObserverPort;
  let observed = false;
  let disconnected = false;
  let convertedDocuments = 0;
  let convertedNodes = 0;
  let resetCount = 0;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html lang="zh"><body><p>source</p></body></html>', {
      url: 'https://example.com',
    });
    observer = {
      observe: () => { observed = true; },
      disconnect: () => { disconnected = true; },
    };
    callback = undefined;
    convertedDocuments = 0;
    convertedNodes = 0;
    resetCount = 0;
  });

  function createController(url = 'https://example.com') {
    const operations: AutoConversionOperations = {
      convertTextNode: () => { convertedNodes += 1; return true; },
      convertDocument: () => { convertedDocuments += 1; return 1; },
      convertTitle: () => {},
      convertSelection: () => false,
      resetCaches: () => { resetCount += 1; },
    };
    return createAutoConversionController({
      document: dom.window.document,
      getUrl: () => url,
      operations,
      observerFactory: (listener) => {
        callback = listener;
        return observer;
      },
    });
  }

  it('starts only for an eligible auto-mode document', async () => {
    const controller = createController();

    await controller.reconcile(makeSettings({ auto: true }));

    expect(controller.getStatus()).toBe('active');
    expect(observed).toBe(true);
    expect(convertedDocuments).toBe(1);
  });

  it('stops and disconnects when auto mode is disabled', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));
    await controller.reconcile(makeSettings({ auto: false }));

    expect(controller.getStatus()).toBe('inactive');
    expect(disconnected).toBe(true);
  });

  it('converts added text nodes incrementally', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true }));
    callback?.([{ type: 'childList', target: dom.window.document.body, addedNodes: [dom.window.document.createTextNode('added')] } as MutationRecord]);

    await Promise.resolve();

    expect(convertedNodes).toBe(1);
  });

  it('marks a processed document reload-required when the locale pair changes', async () => {
    const controller = createController();
    await controller.reconcile(makeSettings({ auto: true, origin: 'cn', target: 'hk' }));
    await controller.reconcile(makeSettings({ auto: true, origin: 'tw', target: 'cn' }));

    expect(controller.getStatus()).toBe('reload-required');
    expect(convertedDocuments).toBe(1);
    expect(resetCount).toBe(1);
  });
});
```

Add tests for the remaining specified gates: same origin/target, non-Chinese `lang`, whitelist match, URL change resetting caches and performing one new full conversion, fallback timer cancellation in `dispose()`, and observer callback errors being contained.

Use this additional test shape for the eligibility and cleanup cases:

```ts
it.each([
  { name: 'same locale pair', settings: makeSettings({ auto: true, origin: 'cn', target: 'cn' }), prepare: () => {} },
  {
    name: 'non-Chinese document',
    settings: makeSettings({ auto: true }),
    prepare: () => { dom.window.document.documentElement.lang = 'en'; },
  },
  { name: 'whitelisted URL', settings: makeSettings({ auto: true, whitelist: ['example.com'] }), prepare: () => {} },
])('stays inactive for $name', async ({ settings, prepare }) => {
  prepare();
  const controller = createController();
  await controller.reconcile(settings);
  expect(controller.getStatus()).toBe('inactive');
  expect(convertedDocuments).toBe(0);
});

it('cancels a pending fallback scan on dispose', async () => {
  const timer = { schedule: vi.fn().mockReturnValue(1), cancel: vi.fn() };
  const controller = createAutoConversionController({
    document: dom.window.document,
    getUrl: () => 'https://example.com',
    operations: createRecordingConversionOperations(),
    observerFactory: (listener) => {
      callback = listener;
      return observer;
    },
    timer,
  });
  await controller.reconcile(makeSettings({ auto: true }));
  callback?.([]);
  controller.dispose();
  expect(timer.cancel).toHaveBeenCalledWith(1);
});
```

- [ ] **Step 2: Run the focused controller tests and verify they fail**

Run: `rtk npm test -- tests/auto-conversion-controller.test.ts`

Expected: FAIL because the controller module does not exist.

- [ ] **Step 3: Implement the controller contract**

Create `src/application/auto/auto-conversion-controller.ts` with these public types:

```ts
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

export function createAutoConversionController(
  options: AutoConversionControllerOptions,
): AutoConversionController;
```

Implement these rules exactly:

1. `reconcile()` stops and disconnects when `auto` is false, origin equals target, the document language is non-Chinese, or the URL is whitelisted.
2. The first eligible reconcile converts the title and document once, then observes `document.body` for child-list, subtree, character-data, and old-value mutations.
3. Added text nodes and character-data targets use `convertTextNode`; added elements use a document scan rooted at that element.
4. A zero-change mutation batch schedules one 250 ms fallback scan. `dispose()` cancels that timer and disconnects the observer.
5. A URL change resets conversion caches, clears reload-required status, converts the new title, and performs one full scan for the current pair.
6. A locale-pair change after a full document conversion resets caches, sets reload-required status, does not full-scan existing content, and leaves the observer available for newly added nodes under the new pair.
7. The observer callback invokes async processing through `void processMutations(...).catch(() => {})` so it cannot produce an unhandled rejection.

- [ ] **Step 4: Run the focused controller tests**

Run: `rtk npm test -- tests/auto-conversion-controller.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the controller**

```text
rtk git add src/application/auto tests/auto-conversion-controller.test.ts
rtk git commit -m "refactor: extract auto conversion controller"
```

---

### Task 4: Implement and Test the WXT Browser Platform Adapter

**Files:**

- Create: `src/platform/browser-platform.ts`
- Modify: `src/platform/index.ts`
- Create: `tests/browser-platform.test.ts`

**Interfaces:**

- Consumes the ports from `src/platform/types.ts`.
- Produces `createBrowserPlatform(api?: typeof browser): ExtensionPlatform`.
- Maps browser failures to `PlatformError` codes.
- Reads the generated content-script path from `runtime.getManifest()` before one-shot injection; it never hard-codes a WXT output filename.

- [ ] **Step 1: Write the failing platform tests**

Create `tests/browser-platform.test.ts` with an injected API fake. Cover the key mappings:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createBrowserPlatform } from '../src/platform/browser-platform.js';
import { PlatformError } from '../src/platform/types.js';

it('maps active tab data and sends content messages', async () => {
  const sendMessage = vi.fn().mockResolvedValue({ kind: 'no-op', count: 0, time: 4 });
  const platform = createBrowserPlatform({
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 7, url: 'https://example.com/page' }]),
      sendMessage,
    },
  } as never);

  expect(await platform.tabs.getActive()).toEqual({ id: 7, url: 'https://example.com/page' });
  await platform.tabs.send(7, { type: 'convert-page' });
  expect(sendMessage).toHaveBeenCalledWith(7, { type: 'convert-page' });
});

it('injects the manifest-declared content script path', async () => {
  const executeScript = vi.fn().mockResolvedValue(undefined);
  const platform = createBrowserPlatform({
    runtime: {
      getManifest: () => ({ content_scripts: [{ js: ['content.js'] }] }),
    },
    scripting: { executeScript },
  } as never);

  await platform.scripting.injectContentScript(9);

  expect(executeScript).toHaveBeenCalledWith({
    target: { tabId: 9 },
    files: ['content.js'],
  });
});

it('reports a missing content script as an unsupported capability', async () => {
  const platform = createBrowserPlatform({
    runtime: { getManifest: () => ({}) },
  } as never);

  await expect(platform.scripting.injectContentScript(9)).rejects.toMatchObject<PlatformError>({
    code: 'unsupported-capability',
  });
});
```

Add tests for storage get/set, storage unsubscribe, runtime listener callback bridging, context-menu event unsubscribe, badge calls, and mapping a receiving-end error to `PlatformError('no-receiver', ...)`.

- [ ] **Step 2: Run the focused platform tests and verify they fail**

Run: `rtk npm test -- tests/browser-platform.test.ts`

Expected: FAIL because `src/platform/browser-platform.ts` does not exist.

- [ ] **Step 3: Implement the browser adapter**

Use the WXT unified API import and keep it confined to this file:

```ts
import { browser } from 'wxt/browser';
import type { ExtensionPlatform } from './types.js';
```

Implement the adapters with these rules:

- `storage.get()` and `storage.set()` delegate to `api.storage.local`.
- `storage.subscribe()` registers one wrapper on `api.storage.onChanged` and removes that exact wrapper on unsubscribe.
- `runtime.subscribe()` bridges the callback-style listener by returning `true` from the browser listener, resolving the returned response through `sendResponse`, and converting rejected handlers to `{ kind: 'internal-failure' }`.
- `tabs.getActive()` calls `api.tabs.query({ active: true, currentWindow: true })` and maps the first tab with a numeric ID to `{ id, url }`.
- `tabs.send()` delegates to `api.tabs.sendMessage()` and maps receiving-end errors to `no-receiver`.
- `scripting.injectContentScript()` reads the first JavaScript file from `api.runtime.getManifest().content_scripts`; missing files throw `unsupported-capability`; execute failures throw `permission-denied` or `request-failed`.
- `contextMenus.ensureSelectionMenu()` removes `convert-selection` while consuming `runtime.lastError`, then creates it with title `Convert Chinese Characters` and context `selection`.
- `contextMenus.subscribe()` forwards menu info with `menuItemId` and `tabId` and returns a precise unsubscribe.
- `action` delegates badge operations and `getManifest()` returns the runtime manifest subset used by the adapter.

Export `createBrowserPlatform` and the port types from `src/platform/index.ts`.

- [ ] **Step 4: Run the focused platform tests**

Run: `rtk npm test -- tests/browser-platform.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the platform adapter**

```text
rtk git add src/platform tests/browser-platform.test.ts
rtk git commit -m "refactor: isolate WebExtension platform APIs"
```

---

### Task 5: Move Background Routing Behind Typed Runtime Ports

**Files:**

- Create: `src/application/runtime/background-runtime.ts`
- Modify: `src/application/runtime/index.ts`
- Create: `tests/background-runtime.test.ts`
- Delete later: `tests/background.integration.test.ts`

**Interfaces:**

- Consumes `ExtensionPlatform`, `SettingsStore`, `RuntimeMessage`, and `ConversionResponse`.
- Produces `createBackgroundRuntime(platform, settingsStore): BackgroundRuntime`.
- `BackgroundRuntime` exposes `start(): void` and `dispose(): void`.
- Produces an internal/exported `convertActiveTab(platform): Promise<ConversionResponse>` for focused tests.

- [ ] **Step 1: Write failing active-tab and context-menu tests**

Create `tests/background-runtime.test.ts` with these imports and a fake platform. The active-tab recovery test must prove exactly one injection and one retry:

```ts
import { describe, expect, it, vi } from 'vitest';
import { convertActiveTab, createBackgroundRuntime } from '../src/application/runtime/background-runtime.js';
import { PlatformError } from '../src/platform/types.js';
import {
  createContextMenuDispatcher,
  createFakePlatform,
  createFakeSettingsStore,
} from './helpers/fakes.js';

it('injects once and retries when the content script is missing', async () => {
  const send = vi
    .fn()
    .mockRejectedValueOnce(new PlatformError('no-receiver', 'Receiving end does not exist'))
    .mockResolvedValueOnce({ kind: 'success', count: 3, time: 12 });
  const inject = vi.fn().mockResolvedValue(undefined);
  const platform = createFakePlatform({
    tabs: {
      getActive: vi.fn().mockResolvedValue({ id: 11, url: 'https://example.com' }),
      send,
    },
    scripting: { injectContentScript: inject },
  });

  const result = await convertActiveTab(platform);

  expect(inject).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledTimes(2);
  expect(result).toEqual({ kind: 'success', count: 3, time: 12 });
});

it('uses the context-menu event tab ID without querying the active tab', async () => {
  const send = vi.fn().mockResolvedValue({ kind: 'no-op', count: 0, time: 0 });
  const dispatch = createContextMenuDispatcher();
  const platform = createFakePlatform({
    tabs: {
      getActive: vi.fn(),
      send,
    },
    contextMenus: {
      ensureSelectionMenu: vi.fn().mockResolvedValue(undefined),
      subscribe: dispatch.subscribe,
    },
  });
  const runtime = createBackgroundRuntime(platform, createFakeSettingsStore());
  runtime.start();

  dispatch.emit({ menuItemId: 'convert-selection', tabId: 42 });
  await Promise.resolve();

  expect(send).toHaveBeenCalledWith(42, { type: 'convert-selection' });
  expect(platform.tabs.getActive).not.toHaveBeenCalled();
});
```

Add tests for no active tab, an explicit non-HTTP URL, injection denial, a protected-page send failure, a non-matching menu item, initial badge state, and badge updates after settings changes.

- [ ] **Step 2: Run the focused background tests and verify they fail**

Run: `rtk npm test -- tests/background-runtime.test.ts`

Expected: FAIL because the background runtime module does not exist.

- [ ] **Step 3: Implement background runtime orchestration**

Create `src/application/runtime/background-runtime.ts` with this public contract:

```ts
import type { SettingsStore } from '../settings/settings-store.js';
import type { ExtensionPlatform } from '../../platform/types.js';
import type { ConversionResponse } from '../../runtime/messages.js';

export interface BackgroundRuntime {
  start(): void;
  dispose(): void;
}

export async function convertActiveTab(platform: ExtensionPlatform): Promise<ConversionResponse>;
export function createBackgroundRuntime(
  platform: ExtensionPlatform,
  settingsStore: SettingsStore,
): BackgroundRuntime;
```

Implement `convertActiveTab()` as follows:

1. Get the active tab. Return `{ kind: 'unavailable', reason: 'no-active-tab' }` when there is no numeric tab ID.
2. When a URL exists and is not HTTP or HTTPS, return `{ kind: 'unavailable', reason: 'unsupported-scheme' }` without messaging or injection.
3. Send `{ type: 'convert-page' }` to the tab and return its response.
4. Only for `PlatformError.code === 'no-receiver'`, inject the manifest-declared content script once and retry the same request once.
5. Map injection permission failures to `injection-denied`, unsupported scripting to `unsupported-capability`, and all other injection/send failures to `protected-page`.
6. Never retry more than once and never include a URL or page text in the response.

`createBackgroundRuntime().start()` must create the selection menu, subscribe to runtime messages, subscribe to context-menu events, initialize the badge from `settingsStore.load()`, and subscribe to settings updates. Runtime messages only handle `{ type: 'convert-active-tab' }`; other messages return `undefined`. The context-menu handler sends `{ type: 'convert-selection' }` to `info.tabId` only when `menuItemId === 'convert-selection'` and a tab ID exists. `dispose()` calls every returned unsubscribe function.

- [ ] **Step 4: Replace the background WXT wrapper**

Replace the build-only body in `entrypoints/background.ts`:

```ts
import { defineBackground } from 'wxt/sandbox';
import { createBackgroundRuntime } from '../src/application/runtime/background-runtime.js';
import { createSettingsStore } from '../src/application/settings/settings-store.js';
import { createBrowserPlatform } from '../src/platform/browser-platform.js';

export default defineBackground(() => {
  const platform = createBrowserPlatform();
  const settingsStore = createSettingsStore(platform.storage);
  const runtime = createBackgroundRuntime(platform, settingsStore);
  runtime.start();
});
```

- [ ] **Step 5: Run background and regression tests**

Run:

```text
rtk npm test -- tests/background-runtime.test.ts tests/conversion-service.test.ts tests/conversion.test.ts
rtk npm run typecheck
```

Expected: PASS. The old `tests/background.integration.test.ts` may remain temporarily, but it must not be used as the new runtime contract.

- [ ] **Step 6: Commit background routing**

```text
rtk git add entrypoints/background.ts src/application/runtime tests/background-runtime.test.ts
rtk git commit -m "refactor: route tab operations through background runtime"
```

---

### Task 6: Move Content Handling to Static WXT Entry and Auto Lifecycle

**Files:**

- Create: `src/application/runtime/content-runtime.ts`
- Modify: `src/application/runtime/index.ts`
- Modify: `entrypoints/content.ts`
- Create: `tests/content-runtime.test.ts`

**Interfaces:**

- Consumes `ExtensionPlatform`, `SettingsStore`, `AutoConversionOperations`, and injected time/document dependencies.
- Produces `createContentRuntime(options): ContentRuntime`.
- `ContentRuntime` exposes `start(): Promise<() => void>`; the returned function disposes runtime listeners and the auto controller.
- Uses the existing core conversion facade through an `AutoConversionOperations` adapter.

- [ ] **Step 1: Write failing content runtime tests**

Create `tests/content-runtime.test.ts` with these imports, fake settings storage, runtime listener registration, and conversion operations:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createContentRuntime } from '../src/application/runtime/content-runtime.js';
import {
  createFakePlatform,
  createFakeSettingsStore,
  createRecordingConversionOperations,
  createRuntimeListenerCapture,
} from './helpers/fakes.js';

it('starts auto mode from settings and answers a page request', async () => {
  const listener = createRuntimeListenerCapture();
  const store = createFakeSettingsStore({ auto: true, origin: 'cn', target: 'hk' });
  const operations = createRecordingConversionOperations();
  const platform = createFakePlatform({ runtime: { send: vi.fn(), subscribe: listener.subscribe } });
  const runtime = createContentRuntime({
    platform,
    settingsStore: store,
    operations,
    document: document,
    getSelection: () => null,
    now: () => 100,
  });

  const dispose = await runtime.start();
  const response = await listener.invoke({ type: 'convert-page' }, {});

  expect(operations.convertDocument).toHaveBeenCalled();
  expect(response).toEqual({ kind: 'success', count: 1, time: 0 });
  dispose();
});

it('returns reload-required instead of reinterpreting a converted document', async () => {
  const listener = createRuntimeListenerCapture();
  const store = createFakeSettingsStore({ auto: true, origin: 'cn', target: 'hk' });
  const operations = createRecordingConversionOperations();
  const platform = createFakePlatform({ runtime: { send: vi.fn(), subscribe: listener.subscribe } });
  const runtime = createContentRuntime({
    platform,
    settingsStore: store,
    operations,
    document,
    getSelection: () => null,
    now: () => 100,
  });

  await runtime.start();
  await store.emit({ auto: true, origin: 'tw', target: 'cn' });

  await expect(listener.invoke({ type: 'convert-page' }, {})).resolves.toEqual({
    kind: 'reload-required',
  });
});
```

Add tests for selection conversion, same-locale no-op, settings-driven auto start/stop, and disposal of both runtime and storage listeners.

- [ ] **Step 2: Run the focused content tests and verify they fail**

Run: `rtk npm test -- tests/content-runtime.test.ts`

Expected: FAIL because the content runtime module does not exist.

- [ ] **Step 3: Implement content runtime orchestration**

Create `src/application/runtime/content-runtime.ts` with this contract:

```ts
import type { AutoConversionOperations } from '../auto/auto-conversion-controller.js';
import type { ExtensionPlatform } from '../../platform/types.js';
import type { SettingsStore } from '../settings/settings-store.js';

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
}

export function createContentRuntime(options: ContentRuntimeOptions): ContentRuntime;
```

Use the DOM `Document` type supplied by the TypeScript DOM library; do not import `Document` from a package. The implementation must:

- Construct an auto controller with the supplied document, URL getter, operations, and whitelist matcher.
- Load settings and reconcile the controller before returning from `start()`.
- Subscribe to settings changes and reconcile every normalized update.
- Answer `convert-page` by loading settings, returning `invalid-settings` only if the store itself cannot supply normalized settings, returning `reload-required` when the controller reports that status, and otherwise converting the title and document while timing the operation.
- Answer `convert-selection` with the current selection and current settings. Return `no-op` for no selection, equal locales, or unchanged selection.
- Return `undefined` for `convert-active-tab` and unknown messages because those belong to background.
- Catch runtime conversion exceptions and return `{ kind: 'internal-failure' }`.
- Dispose the runtime listener, settings subscription, auto controller, and pending timers through the returned cleanup function.

- [ ] **Step 4: Wire the static WXT content entrypoint**

Replace the build-only body in `entrypoints/content.ts`:

```ts
import { defineContentScript } from 'wxt/sandbox';
import { createContentRuntime } from '../src/application/runtime/content-runtime.js';
import { createSettingsStore } from '../src/application/settings/settings-store.js';
import { conversionService } from '../src/core/conversion.js';
import { createBrowserPlatform } from '../src/platform/browser-platform.js';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  allFrames: false,
  registration: 'manifest',
  main(ctx) {
    const platform = createBrowserPlatform();
    const settingsStore = createSettingsStore(platform.storage);
    const runtime = createContentRuntime({
      platform,
      settingsStore,
      operations: {
        convertTextNode: conversionService.convertTextNode,
        convertDocument: conversionService.convertAllNewTextNodes,
        convertTitle: conversionService.convertTitle,
        convertSelection: conversionService.convertSelection,
        resetCaches: conversionService.resetConversionCache,
      },
      document,
      getSelection: () => globalThis.getSelection(),
    });

    void runtime.start().then((dispose) => ctx.onInvalidated(dispose));
  },
});
```

The wrapper must not call `registerContentScripts`, `unregisterContentScripts`, or an `ensure-script` message. `registration: 'manifest'` is the only content-script registration mode.

- [ ] **Step 5: Run content and conversion tests**

Run:

```text
rtk npm test -- tests/content-runtime.test.ts tests/auto-conversion-controller.test.ts tests/conversion-service.test.ts tests/conversion.test.ts
rtk npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the static content runtime**

```text
rtk git add entrypoints/content.ts src/application/runtime/content-runtime.ts src/application/auto tests/content-runtime.test.ts
rtk git commit -m "refactor: use static content runtime for auto mode"
```

---

### Task 7: Migrate Popup and Options UI to Injectable Controllers

**Files:**

- Create: `src/application/ui/popup-controller.ts`
- Create: `src/application/ui/options-controller.ts`
- Create: `src/application/ui/index.ts`
- Modify: `entrypoints/popup/index.html`, `entrypoints/popup/main.ts`, `entrypoints/popup/style.css`
- Modify: `entrypoints/options/index.html`, `entrypoints/options/main.ts`, `entrypoints/options/style.css`
- Create: `tests/popup-controller.test.ts`
- Create: `tests/options-controller.test.ts`

**Interfaces:**

- Consumes `ExtensionPlatform`, `SettingsStore`, `ConversionResponse`, and the current DOM element IDs.
- Produces `PopupElements`, `createPopupController(platform, elements)`, and `OptionsElements`, `createOptionsController(platform, elements)`.
- Keeps textbox conversion local through `convertPlainText`.
- Sends page conversion only as `{ type: 'convert-active-tab' }` through `platform.runtime.send()`.

- [ ] **Step 1: Add accessible status markup and write failing UI tests**

In `entrypoints/popup/index.html`, preserve the current controls and add a pre-existing live region inside the footer:

```html
<footer class="app-footer">
  <span id="status" class="footnote" role="status" aria-live="polite"></span>
  <a class="repo-link" target="_blank" rel="noreferrer" href="https://github.com/tnychn/opencc-extension">Repository</a>
</footer>
```

Add `aria-label` values to the icon-only swap and reset buttons while preserving their visible glyphs:

```html
<button id="swap" class="icon" type="button" title="Swap" aria-label="Swap source and target">&harr;</button>
<button id="reset" class="icon" type="button" title="Reset textbox" aria-label="Reset textbox">&#8635;</button>
```

Create `tests/popup-controller.test.ts` with these imports, fake platform ports, and JSDOM markup. The page request must never query tabs in the popup:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createPopupController,
  type PopupElements,
} from '../src/application/ui/popup-controller.js';
import { createFakePlatform } from './helpers/fakes.js';

function makePopupElements(): PopupElements {
  document.body.innerHTML = `
    <select id="origin"><option value="cn">cn</option><option value="hk">hk</option></select>
    <select id="target"><option value="hk">hk</option><option value="cn">cn</option></select>
    <button id="swap"></button>
    <button id="reset"></button>
    <textarea id="textbox"></textarea>
    <button id="convert"></button>
    <input id="auto" type="checkbox" />
    <span id="status"></span>
  `;
  return {
    originSelect: document.getElementById('origin') as HTMLSelectElement,
    targetSelect: document.getElementById('target') as HTMLSelectElement,
    swapButton: document.getElementById('swap') as HTMLButtonElement,
    resetButton: document.getElementById('reset') as HTMLButtonElement,
    textbox: document.getElementById('textbox') as HTMLTextAreaElement,
    convertButton: document.getElementById('convert') as HTMLButtonElement,
    autoCheckbox: document.getElementById('auto') as HTMLInputElement,
    status: document.getElementById('status') as HTMLElement,
    subtitle: null,
  };
}

it('sends active-tab conversion through runtime and renders a text-only result', async () => {
  const send = vi.fn().mockResolvedValue({ kind: 'success', count: 2, time: 8 });
  const platform = createFakePlatform({ runtime: { send } });
  const elements = makePopupElements();
  const controller = createPopupController(platform, elements);

  await controller.initialize();
  elements.convertButton.click();
  await Promise.resolve();

  expect(send).toHaveBeenCalledWith({ type: 'convert-active-tab' });
  expect(elements.status.textContent).toBe('2 nodes changed in 8ms');
  expect(elements.status.innerHTML).toBe('2 nodes changed in 8ms');
});

it('renders unavailable results without HTML injection', async () => {
  const platform = createFakePlatform({
    runtime: { send: vi.fn().mockResolvedValue({ kind: 'unavailable', reason: 'protected-page' }) },
  });
  const elements = makePopupElements();
  const controller = createPopupController(platform, elements);

  await controller.initialize();
  elements.convertButton.click();
  await Promise.resolve();

  expect(elements.status.textContent).toContain('protected');
  expect(elements.status.querySelector('span')).toBeNull();
});
```

Create `tests/options-controller.test.ts` with these imports to prove wildcard conversion and persistence through `SettingsStore.set()`:

```ts
import { expect, it, vi } from 'vitest';
import { createOptionsController } from '../src/application/ui/options-controller.js';
import { createFakePlatform, createFakeSettingsStore } from './helpers/fakes.js';

it('normalizes wildcard whitelist entries and persists them', async () => {
  document.body.innerHTML = '<textarea id="whitelist"></textarea>';
  const settingsStore = createFakeSettingsStore();
  const set = vi.spyOn(settingsStore, 'set');
  const elements = {
    whitelist: document.getElementById('whitelist') as HTMLTextAreaElement,
  };
  const controller = createOptionsController(createFakePlatform(), elements, settingsStore);

  elements.whitelist.value = 'https://*.example.com/*';
  elements.whitelist.dispatchEvent(new Event('input'));
  await new Promise((resolve) => setTimeout(resolve, 550));

  expect(set).toHaveBeenCalledWith({ whitelist: ['https://[^ ]*.example.com/[^ ]*'] });
  controller.dispose();
});
```

The popup test reads `innerHTML` only to prove the rendered value contains no markup; the implementation must use `textContent`, not assign `innerHTML`. The options test injects the production `SettingsStore` interface directly; do not add production-only test hooks.

- [ ] **Step 2: Run the focused UI tests and verify they fail**

Run: `rtk npm test -- tests/popup-controller.test.ts tests/options-controller.test.ts`

Expected: FAIL because the UI controller modules do not exist.

- [ ] **Step 3: Implement the popup controller**

Create `src/application/ui/popup-controller.ts`:

```ts
import type { ExtensionPlatform } from '../../platform/types.js';
import type { ConversionResponse } from '../../runtime/messages.js';
import type { SettingsStore } from '../settings/settings-store.js';

export interface PopupElements {
  originSelect: HTMLSelectElement;
  targetSelect: HTMLSelectElement;
  swapButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  textbox: HTMLTextAreaElement;
  convertButton: HTMLButtonElement;
  autoCheckbox: HTMLInputElement;
  status: HTMLElement;
  subtitle: HTMLElement | null;
}

export interface PopupController {
  initialize(): Promise<void>;
  dispose(): void;
}

export function createPopupController(
  platform: ExtensionPlatform,
  elements: PopupElements,
  settingsStore?: SettingsStore,
): PopupController;
```

Implement these behaviors:

- Load settings during `initialize()`, set both selects, checkbox, textbox dimensions, subtitle version, and convert-button disabled state.
- On origin/target changes, call `settingsStore.set()`, update disabled state, and convert the textbox locally if it has content.
- On swap, exchange the two select values and persist both fields.
- Debounce textbox `input`, `paste`, and `change` conversion by 250 ms; use `convertPlainText` and never send textbox text through runtime messaging.
- On convert click, disable the button, call `platform.runtime.send({ type: 'convert-active-tab' })`, then render through `status.textContent` and a state class. Use exact status strings for success, no-op, reload-required, unsupported scheme, protected page, injection denied, and internal failure.
- On auto checkbox change, call `settingsStore.set({ auto })`. Do not call an action API from popup; background badge synchronization is authoritative.
- Persist textbox dimensions with `ResizeObserver` when available and remove the observer plus every event listener in `dispose()`.

- [ ] **Step 4: Implement the options controller**

Create `src/application/ui/options-controller.ts`:

```ts
import type { ExtensionPlatform } from '../../platform/types.js';
import type { SettingsStore } from '../settings/settings-store.js';

export interface OptionsElements {
  whitelist: HTMLTextAreaElement;
}

export interface OptionsController {
  initialize(): Promise<void>;
  dispose(): void;
}

export function createOptionsController(
  platform: ExtensionPlatform,
  elements: OptionsElements,
  settingsStore?: SettingsStore,
): OptionsController;
```

Load stored regex strings and display them as `*` wildcards. On input, trim each line, debounce for 500 ms, replace `*` with `[^ ]*`, and call `settingsStore.set({ whitelist })`. Cancel the timer and remove the input listener in `dispose()`.

- [ ] **Step 5: Wire the WXT HTML entrypoints**

Replace `entrypoints/popup/main.ts` with an entrypoint-only wrapper:

```ts
import { createPopupController } from '../../src/application/ui/popup-controller.js';
import { createSettingsStore } from '../../src/application/settings/settings-store.js';
import { createBrowserPlatform } from '../../src/platform/browser-platform.js';

const platform = createBrowserPlatform();
const settingsStore = createSettingsStore(platform.storage);
const controller = createPopupController(platform, {
  originSelect: document.getElementById('origin') as HTMLSelectElement,
  targetSelect: document.getElementById('target') as HTMLSelectElement,
  swapButton: document.getElementById('swap') as HTMLButtonElement,
  resetButton: document.getElementById('reset') as HTMLButtonElement,
  textbox: document.getElementById('textbox') as HTMLTextAreaElement,
  convertButton: document.getElementById('convert') as HTMLButtonElement,
  autoCheckbox: document.getElementById('auto') as HTMLInputElement,
  status: document.getElementById('status') as HTMLElement,
  subtitle: document.getElementById('subtitle'),
}, settingsStore);

void controller.initialize();
```

Replace `entrypoints/options/main.ts` with the equivalent injected options controller wrapper. The wrappers may use `document`, but they must not reference `chrome`, `browser`, `tabs`, `storage`, or `scripting` directly.

- [ ] **Step 6: Run UI, type, and accessibility-focused checks**

Run:

```text
rtk npm test -- tests/popup-controller.test.ts tests/options-controller.test.ts
rtk npm run typecheck
rtk npm run lint
```

Expected: PASS. Confirm the popup footer has a pre-existing live region, all controls retain labels, and no UI code assigns `innerHTML`.

- [ ] **Step 7: Commit the UI migration**

```text
rtk git add entrypoints/popup entrypoints/options src/application/ui tests/popup-controller.test.ts tests/options-controller.test.ts
rtk git commit -m "refactor: move extension UI behind platform ports"
```

---

### Task 8: Remove Legacy Runtime Paths, Validate Artifacts, and Update Documentation

**Files:**

- Create: `scripts/verify-build-output.mjs`
- Modify: `package.json`, `package-lock.json`, `scripts/bump-version.cjs`, `.github/workflows/ci.yml`, `.gitignore`
- Modify: `README.md`, `CONTRIBUTING.md`, `PRIVACY.md`, `MV3_NOTES.md`
- Delete: `build.mjs`, `scripts/dev.mjs`, `scripts/dist.mjs`, `scripts/dist-all.mjs`
- Delete: `src/manifest.chrome.json`, `src/manifest.edge.json`, `src/manifest.firefox.json`
- Delete: `src/background.ts`, `src/content.ts`, `src/content/observer.ts`, `src/popup/index.ts`, `src/options/index.ts`
- Delete: `tests/background.integration.test.ts`

**Interfaces:**

- Consumes WXT output at `.output/<browser>-mv3/`.
- Produces a nonzero exit code for invalid generated manifests or missing entrypoints.
- Produces `opencc.chrome.zip`, `opencc.firefox.zip`, and `opencc.edge.zip` from native WXT zip commands.
- Leaves the existing `npm run ci` name as the full local verification gate.

- [ ] **Step 1: Write the generated-output verifier**

Create `scripts/verify-build-output.mjs`:

```js
#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const browser = process.argv[2];
const allowed = new Set(['chrome', 'firefox', 'edge']);
if (!allowed.has(browser)) {
  console.error('Usage: node scripts/verify-build-output.mjs <chrome|firefox|edge>');
  process.exit(1);
}

const outputDir = path.resolve('.output', `${browser}-mv3`);
const manifestPath = path.join(outputDir, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) throw new Error(`${browser}: manifest_version must be 3`);
if (manifest.permissions?.includes('tabs')) throw new Error(`${browser}: broad tabs permission is forbidden`);
for (const permission of ['storage', 'contextMenus', 'scripting', 'activeTab']) {
  if (!manifest.permissions?.includes(permission)) throw new Error(`${browser}: missing ${permission}`);
}
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(['http://*/*', 'https://*/*'])) {
  throw new Error(`${browser}: host permissions are incorrect`);
}
if (!manifest.action?.default_popup || !manifest.options_ui?.page) {
  throw new Error(`${browser}: popup/options entrypoints are missing`);
}
const requiredFiles = [manifest.action.default_popup, manifest.options_ui.page];
const contentScripts = manifest.content_scripts ?? [];
const contentScript = contentScripts.find((entry) => entry.matches?.includes('http://*/*'));
if (!contentScript || contentScript.run_at !== 'document_idle' || contentScript.all_frames !== false || !contentScript.js?.length) {
  throw new Error(`${browser}: static top-frame content script is incorrect`);
}
requiredFiles.push(...contentScript.js);
if (browser === 'firefox') {
  if (!manifest.browser_specific_settings?.gecko?.id) throw new Error('firefox: Gecko ID is missing');
  if (!Array.isArray(manifest.background?.scripts)) throw new Error('firefox: MV3 scripts background is missing');
  requiredFiles.push(...manifest.background.scripts);
} else if (!manifest.background?.service_worker) {
  throw new Error(`${browser}: service worker background is missing`);
} else {
  requiredFiles.push(manifest.background.service_worker);
}
for (const relativePath of requiredFiles) {
  await fs.access(path.join(outputDir, relativePath));
}

console.log(`${browser}: generated manifest and entrypoints verified`);
```

- [ ] **Step 2: Build each final target and run the verifier**

Run:

```text
rtk npm run build:chrome
rtk node scripts/verify-build-output.mjs chrome
rtk npm run build:firefox
rtk node scripts/verify-build-output.mjs firefox
rtk npm run build:edge
rtk node scripts/verify-build-output.mjs edge
```

Expected: all three verifier runs pass. If a manifest shape or referenced file fails, repair the WXT manifest source or entrypoint configuration before continuing; do not weaken the verifier.

- [ ] **Step 3: Remove obsolete build and runtime files**

Delete the custom build scripts, duplicated manifests, old browser entry modules, old observer, and old loose background integration test listed above. Update `scripts/bump-version.cjs` so it updates only `package.json`:

```js
updateJSON('package.json');
```

Remove the code that scans and rewrites `src/manifest.*.json`. Remove package scripts that invoke `build.mjs`, `scripts/dev.mjs`, `scripts/dist.mjs`, or `scripts/dist-all.mjs`. Keep `scripts/generate-opencc-data.mjs`, `scripts/bump-version.cjs`, and `scripts/generate-changelog.cjs` because they are unrelated to the runtime rewrite.

Search the source and tests for legacy paths and APIs:

```text
rtk rg -n "registerContentScripts|unregisterContentScripts|ensure-script|chrome\.|build\.mjs|manifest\.(chrome|edge|firefox)|src/content/observer|innerHTML" src entrypoints tests scripts
```

The only allowed browser API implementation references are inside `src/platform/browser-platform.ts`; `innerHTML` must have no matches in popup/options controllers or entrypoints.

- [ ] **Step 4: Update CI for all target builds and packages**

Change `.github/workflows/ci.yml` so verification runs:

```yaml
      - name: Lint
        run: npm run lint
      - name: Typecheck
        run: npm run typecheck
      - name: Test
        run: npm test
      - name: Build Chrome
        run: npm run build:chrome
      - name: Verify Chrome artifact
        run: node scripts/verify-build-output.mjs chrome
      - name: Build Firefox
        run: npm run build:firefox
      - name: Verify Firefox artifact
        run: node scripts/verify-build-output.mjs firefox
      - name: Build Edge
        run: npm run build:edge
      - name: Verify Edge artifact
        run: node scripts/verify-build-output.mjs edge
```

Keep `permissions: contents: read`, the existing concurrency policy, and the current action versions. Update the package `ci` script to run the same complete local gate:

```json
{
  "scripts": {
    "ci": "npm run lint && npm run typecheck && npm test && npm run build:chrome && node scripts/verify-build-output.mjs chrome && npm run build:firefox && node scripts/verify-build-output.mjs firefox && npm run build:edge && node scripts/verify-build-output.mjs edge"
  }
}
```

On push packaging, run `npm run dist` after verification and upload exactly `opencc.chrome.zip`, `opencc.firefox.zip`, and `opencc.edge.zip`.

- [ ] **Step 5: Update documentation and permission explanations**

Update `README.md`:

- Replace custom `npm run build` and `npm run dev` instructions with `npm run dev`, `npm run dev:firefox`, `npm run build:chrome`, `npm run build:firefox`, `npm run build:edge`, and `npm run dist`.
- State that Chrome, Edge, and Firefox are built from one shared WXT source tree and pinned to MV3.
- State that content scripts are statically declared and auto mode controls the observer, not script registration.
- Remove claims that refer to dynamic registration, `build/` as the source build directory, or a nonexistent `npm run build:firefox` implementation detail.

Update `CONTRIBUTING.md` with the same development/build/package commands and require `rtk`-prefixed commands in local instructions.

Update `PRIVACY.md` permissions:

- `storage`: local preferences only.
- `activeTab`: user-initiated active-tab conversion.
- `scripting`: one-shot fallback injection into the active tab when a static script was missed.
- `contextMenus`: selection conversion.
- HTTP/HTTPS host access: statically declared content-script auto mode.
- Do not mention `tabs` as a shipped permission.

Rewrite `MV3_NOTES.md` to document the final static content-script model, WXT target flags, Firefox MV3 background shape, absence of dynamic registration, and the one-shot injection fallback. Remove obsolete migration notes that claim dynamic registration is required.

- [ ] **Step 6: Run the full build, test, package, and static searches**

Run:

```text
rtk npm run lint
rtk npm run typecheck
rtk npm test
rtk npm run build:chrome
rtk node scripts/verify-build-output.mjs chrome
rtk npm run build:firefox
rtk node scripts/verify-build-output.mjs firefox
rtk npm run build:edge
rtk node scripts/verify-build-output.mjs edge
rtk npm run dist
rtk rg -n "registerContentScripts|unregisterContentScripts|ensure-script|chrome\.|build\.mjs|manifest\.(chrome|edge|firefox)|src/content/observer|innerHTML" src entrypoints tests scripts
rtk git status --short
```

Expected:

- Lint, typecheck, and all tests pass.
- All three MV3 outputs pass the verifier.
- `npm run dist` creates all three expected zip names.
- The legacy search returns no browser-global or registration references outside `src/platform/browser-platform.ts`; if `chrome.` appears in test fixtures or documentation, remove or replace it with the platform abstraction.
- `git status --short` shows only intended source, configuration, documentation, and test changes; generated artifacts remain ignored.

- [ ] **Step 7: Commit the completed migration**

```text
rtk git add .
rtk git commit -m "refactor: rewrite extension runtime with WXT"
```

- [ ] **Step 8: Perform browser smoke verification**

Load each generated target output in its matching browser and verify these flows:

1. Popup textbox conversion changes text locally as the user types.
2. Popup page conversion works on a normal HTTP page.
3. Context-menu selection conversion uses the selected tab.
4. Auto mode converts initial Chinese content and dynamically inserted content.
5. Whitelist patterns prevent auto conversion for matching URLs.
6. Disabling auto mode disconnects the observer without reloading the page.
7. A tab opened before injection either receives one fallback injection and succeeds or shows a stable unavailable status.
8. Browser-internal/protected pages show a stable unavailable status without an uncaught exception.
9. Changing the locale pair after conversion reports reload-required rather than double-converting existing text.
10. Options and popup settings persist across reopening, and the auto badge follows storage state.
11. Firefox starts with the MV3 background declaration and unchanged Gecko extension ID.

Record any browser-specific manifest or permission difference in `MV3_NOTES.md` and add a corresponding assertion to `scripts/verify-build-output.mjs` before considering the task complete.

---

## Final Acceptance Gate

The implementation is complete only when:

- Chrome, Edge, and Firefox build from one source tree with explicit MV3 flags.
- Auto mode works with a static content script and no runtime registration.
- Popup page, context-menu selection, textbox, whitelist, options, and badge behavior work.
- Active-tab recovery performs at most one injection and one retry.
- Locale changes cannot silently reinterpret already-converted content.
- Browser API calls are isolated in `src/platform/browser-platform.ts` and platform consumers use ports.
- Generated manifests pass target-specific assertions and contain no broad `tabs` permission.
- The full lint, typecheck, test, build, verification, package, and smoke checks pass.
- README, contribution, privacy, and MV3 documentation describe the shipped runtime accurately.
