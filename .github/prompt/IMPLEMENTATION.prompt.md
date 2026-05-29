# OpenCC Extension — Full Rewrite Implementation Prompt

> **Repository**: `cf5146/opencc-extension`
> **Upstream**: `tnychn/opencc-extension` (stale, last updated ~2 years ago, v0.4.0)
> **Goal**: Publish to Chrome Web Store (+ Firefox AMO + Edge Add-ons) as a maintained modern alternative
> **Approach**: Full rewrite on WXT + Svelte 5 + TypeScript strict

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Feature Tradeoff Matrix](#4-feature-tradeoff-matrix)
5. [Phase 1 — Foundation + Core](#5-phase-1--foundation--core-weeks-13)
6. [Phase 2 — Power Features + Polish](#6-phase-2--power-features--polish-weeks-45)
7. [Phase 3 — Optimization + Expansion](#7-phase-3--optimization--expansion-weeks-67)
8. [Phase 4 — Launch](#8-phase-4--launch)
9. [Testing Strategy](#9-testing-strategy)
10. [CI/CD Pipeline](#10-cicd-pipeline)
11. [Code Quality Tooling](#11-code-quality-tooling)
12. [Key Dependencies](#12-key-dependencies)
13. [Success Criteria](#13-success-criteria)

---

## 1. Project Overview

**What**: A browser extension that converts webpage text between Chinese variants (Simplified ↔ Traditional, with regional idioms for Mainland China, Taiwan, Hong Kong, and Japanese Shinjitai). Powered by [opencc-js](https://github.com/nk2028/opencc-js).

**Why Rewrite**:
- Upstream is stale (~2 years, no active maintenance)
- No TypeScript, no tests, no CI/CD, no automated publishing
- Raw HTML/CSS popup — no framework, no dark mode, no accessibility
- No per-site preferences, no keyboard shortcuts, no settings sync
- Build tooling (esbuild + manual `build.mjs`) is functional but not scalable

**Target Users**: Anyone reading Chinese web content who needs Simplified ↔ Traditional conversion — students, researchers, professionals, diaspora communities.

**Target Browsers**: Chrome, Firefox, Edge (all from a single codebase via WXT).

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Extension Framework** | [WXT](https://wxt.dev/) v0.20.x | Vite-based, file-based entrypoints, auto manifest generation, built-in `wxt submit` for store publishing, HMR, cross-browser builds from single codebase |
| **UI Framework** | [Svelte 5](https://svelte.dev/) via `@wxt-dev/module-svelte` v2.x | Zero-runtime compilation (0 KB overhead), cleanest DX for small UI surfaces, ideal for extension popups that must open instantly |
| **Conversion Engine** | [opencc-js](https://github.com/nk2028/opencc-js) v1.3.1 | Pure JS, no native binaries, bundled dictionaries (no runtime fetch), tree-shakable via `opencc-js/core` + `opencc-js/preset` |
| **Language** | TypeScript 5.9+ (`strict: true`) | Full type coverage, typed Chrome/browser APIs via WXT's built-in `browser` |
| **Storage** | WXT built-in `@wxt-dev/storage` | Type-safe `storage.defineItem()`, supports `local:`, `sync:`, `session:` areas, built-in migration system |
| **Unit Testing** | Vitest 3.x | Vite-native, fast, compatible with WXT's build pipeline |
| **E2E Testing** | Playwright 1.x | Only viable option for Chrome Extension E2E — loads real extension from `.output/chrome-mv3` |
| **Linting** | ESLint 9.x (flat config) + `eslint-plugin-svelte` | Modern config format, Svelte-aware |
| **Formatting** | Prettier 3.x + `prettier-plugin-svelte` | Consistent code style |
| **Package Manager** | pnpm (or bun) | Fast, efficient, WXT's recommended choice |

---

## 3. Project Structure

```
opencc-extension/
├── entrypoints/
│   ├── background.ts              # Service worker: commands, badge, messaging hub
│   ├── content.ts                 # Content script: DOM conversion via OpenCC.HTMLConverter
│   ├── popup/                     # Popup UI (Svelte 5)
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── App.svelte
│   │   └── components/
│   │       ├── VariantSelector.svelte   # Origin/Target dropdown pair
│   │       ├── ConvertButton.svelte     # Convert / Restore toggle
│   │       ├── AutoModeToggle.svelte    # MutationObserver auto-convert
│   │       ├── TextBox.svelte           # Freeform text conversion
│   │       └── SiteIndicator.svelte     # Shows current site preference (Phase 2)
│   └── options/                   # Options page (Phase 2)
│       ├── index.html
│       ├── main.ts
│       ├── App.svelte
│       └── components/
│           ├── BlocklistEditor.svelte   # Domain pattern CRUD
│           ├── PreferenceTable.svelte   # Per-site preference list
│           └── ShortcutDisplay.svelte   # Show configured keyboard shortcut
├── lib/
│   ├── converter.ts               # Typed opencc-js wrapper
│   ├── storage.ts                 # WXT storage.defineItem() definitions
│   ├── constants.ts               # Variant enums, locale codes, defaults
│   ├── messaging.ts               # Type-safe background ↔ content messaging
│   └── domain-matcher.ts          # Glob/pattern matching for blocklist/allowlist
├── assets/
│   ├── icons/                     # Extension icons: 16, 32, 48, 128 px
│   └── styles/
│       ├── theme.css              # CSS custom properties: light + dark
│       └── popup.css              # Popup-specific styles
├── public/
│   └── _locales/                  # Phase 2: Chrome i18n
│       ├── en/messages.json
│       ├── zh_CN/messages.json
│       └── zh_TW/messages.json
├── test/
│   ├── unit/                      # Vitest unit tests
│   │   ├── converter.test.ts
│   │   ├── storage.test.ts
│   │   ├── messaging.test.ts
│   │   └── domain-matcher.test.ts
│   └── e2e/                       # Playwright E2E tests
│       ├── popup.spec.ts
│       ├── conversion.spec.ts
│       ├── restore.spec.ts
│       ├── keyboard-shortcut.spec.ts
│       └── fixtures/
│           └── test-page.html     # Chinese text fixture page
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # PR/push: lint → build → unit test → e2e test
│   │   └── publish.yml            # On tag: build → zip → wxt submit → GitHub Release
│   └── dependabot.yml
├── wxt.config.ts                  # WXT configuration (manifest, modules, permissions)
├── vitest.config.ts               # Vitest configuration
├── playwright.config.ts           # Playwright configuration
├── tsconfig.json                  # TypeScript strict config
├── eslint.config.js               # ESLint flat config
├── .prettierrc                    # Prettier config
├── .commitlintrc.yml              # Commitlint config
├── .env.submit                    # gitignored — wxt submit secrets
├── CHANGELOG.md
├── LICENSE                        # MIT
├── README.md
└── package.json
```

---

## 4. Feature Tradeoff Matrix

| Feature | Effort | User Impact | Risk | Bundle Cost | Verdict | Phase |
|---|---|---|---|---|---|---|
| **Edge support** | 🟢 Near-zero | 🔴 High | 🟢 Very low | None | ✅ Include | **1** |
| **Dark mode + improved popup** | 🟡 Medium | 🔴 High | 🟢 Low | ~2 KB CSS | ✅ Include | **1** |
| **Keyboard shortcut** | 🟢 Very low (~10 LOC) | 🟡 Medium | 🟢 Very low | None | ✅ Include | **1** |
| **`chrome.storage.sync`** | 🟢 Very low | 🟡 Medium | 🟢 Very low | None | ✅ Include | **1** |
| **Per-site preference memory** | 🟡 Medium | 🔴 High | 🟢 Low | ~1 KB | ✅ Include | **2** |
| **i18n (EN + zh-TW + zh-CN)** | 🟡 Low-Medium | 🔴 High | 🟢 Low | ~3 KB | ✅ Include | **2** |
| **Blocklist/Allowlist UI** | 🟡 Medium | 🟡 Medium | 🟢 Low | ~5 KB | ✅ Include | **2** |
| **Lazy-load dictionaries** | 🔴 Medium-High | 🟢 Low | 🟡 Medium | Saves ~200-400 KB | ⏳ Defer | **3** |
| **Safari support** | 🔴 High | 🟢 Low | 🟡 Medium | None | ⏳ Defer | **3** |

### Decision Rationale for Deferred Features

**Lazy-load dictionaries**: opencc-js v1.3.1 bundles dictionary data at build time with zero runtime fetch. The extension only loads when triggered by the user, so there's no page-load penalty. opencc-js already supports tree-shaking via `opencc-js/core` + `opencc-js/preset` imports. Premature optimization with real async complexity risk.

**Safari**: Requires Apple Developer Account ($99/yr), `xcrun safari-web-extension-converter` tooling, and WebKit-specific testing. The target audience (Chinese text conversion users) overwhelmingly uses Chrome/Edge/Firefox.

---

## 5. Phase 1 — Foundation + Core (Weeks 1–3)

### 5.1 Project Scaffolding

```bash
# Initialize WXT project with Svelte template
npx wxt@latest init opencc-extension --template svelte-ts
cd opencc-extension
pnpm install

# Install additional dependencies
pnpm add opencc-js
pnpm add -D vitest @playwright/test eslint eslint-plugin-svelte \
  prettier prettier-plugin-svelte @commitlint/cli \
  @commitlint/config-conventional husky lint-staged
```

### 5.2 WXT Configuration

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'OpenCC — Chinese Converter',
    description: '__MSG_extDescription__',  // Phase 2: i18n
    version: '1.0.0',
    default_locale: 'en',                   // Phase 2: i18n
    permissions: ['storage', 'activeTab', 'contextMenus'],
    commands: {
      'convert-page': {
        suggested_key: {
          default: 'Alt+Shift+C',
          mac: 'Alt+Shift+C',
        },
        description: 'Convert current page text',
      },
    },
  },
  // Build for all target browsers
  // Use `wxt build` for chrome-mv3 (default)
  // Use `wxt build -b firefox` for firefox-mv2/mv3
});
```

### 5.3 TypeScript Configuration

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "jsx": "preserve",
    "types": ["vite/client"]
  },
  "include": [
    "entrypoints/**/*.ts",
    "entrypoints/**/*.svelte",
    "lib/**/*.ts",
    "test/**/*.ts",
    ".wxt/**/*.ts"
  ]
}
```

### 5.4 Core Conversion Logic

```typescript
// lib/constants.ts
export const VARIANTS = {
  cn:  { code: 'cn',  label: '简体中文',           langTag: 'zh-CN' },
  tw:  { code: 'tw',  label: '正體中文（臺灣）',     langTag: 'zh-TW' },
  twp: { code: 'twp', label: '正體中文（臺灣，含慣用語）', langTag: 'zh-TW' },
  hk:  { code: 'hk',  label: '繁體中文（香港）',     langTag: 'zh-HK' },
  jp:  { code: 'jp',  label: '日本新字体',          langTag: 'ja'    },
  t:   { code: 't',   label: 'Traditional (OpenCC)', langTag: 'zh-Hant' },
} as const;

export type VariantCode = keyof typeof VARIANTS;

export const DEFAULT_ORIGIN: VariantCode = 'cn';
export const DEFAULT_TARGET: VariantCode = 'tw';
```

```typescript
// lib/converter.ts
import * as OpenCC from 'opencc-js/core';
import * as Locale from 'opencc-js/preset';
import type { VariantCode } from './constants';

/**
 * Creates a typed OpenCC converter for the given direction.
 */
export function createConverter(from: VariantCode, to: VariantCode) {
  return OpenCC.Converter({ from, to });
}

/**
 * Creates an HTMLConverter that walks the DOM tree and converts all text nodes.
 * Returns an object with `.convert()` and `.restore()` methods.
 */
export function createHTMLConverter(
  converter: ReturnType<typeof createConverter>,
  rootNode: Node,
  fromLangTag: string,
  toLangTag: string,
) {
  return OpenCC.HTMLConverter(converter, rootNode, fromLangTag, toLangTag);
}

/**
 * Converts a plain text string.
 */
export function convertText(text: string, from: VariantCode, to: VariantCode): string {
  const converter = createConverter(from, to);
  return converter(text);
}
```

### 5.5 Storage Schema

```typescript
// lib/storage.ts
import { storage } from '#imports';
import { DEFAULT_ORIGIN, DEFAULT_TARGET, type VariantCode } from './constants';

export interface ExtensionSettings {
  origin: VariantCode;
  target: VariantCode;
  autoMode: boolean;
  theme: 'light' | 'dark' | 'system';
}

export const settingsItem = storage.defineItem<ExtensionSettings>('sync:settings', {
  fallback: {
    origin: DEFAULT_ORIGIN,
    target: DEFAULT_TARGET,
    autoMode: false,
    theme: 'system',
  },
  version: 1,
});

// Phase 2: Per-site preferences
export interface SitePreference {
  origin: VariantCode;
  target: VariantCode;
}

export const sitePreferencesItem = storage.defineItem<Record<string, SitePreference>>(
  'sync:sitePreferences',
  {
    fallback: {},
    version: 1,
  },
);

// Phase 2: Blocklist/Allowlist
export interface DomainList {
  blocklist: string[];  // glob patterns: "*.example.com"
  allowlist: string[];
}

export const domainListItem = storage.defineItem<DomainList>('sync:domainList', {
  fallback: {
    blocklist: [],
    allowlist: [],
  },
  version: 1,
});
```

### 5.6 Type-Safe Messaging

```typescript
// lib/messaging.ts
import { defineExtensionMessaging } from '@anthropic-ai/messaging';
// Or use WXT's built-in messaging pattern:
import type { VariantCode } from './constants';

/**
 * Message types for background ↔ content script communication.
 */
export interface ConvertPageMessage {
  type: 'CONVERT_PAGE';
  origin: VariantCode;
  target: VariantCode;
}

export interface RestorePageMessage {
  type: 'RESTORE_PAGE';
}

export interface GetPageStatusMessage {
  type: 'GET_PAGE_STATUS';
}

export interface PageStatusResponse {
  isConverted: boolean;
  origin?: VariantCode;
  target?: VariantCode;
}

export type BackgroundMessage = ConvertPageMessage | RestorePageMessage | GetPageStatusMessage;
```

### 5.7 Background Service Worker

```typescript
// entrypoints/background.ts
export default defineBackground(() => {
  // Handle keyboard shortcut
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'convert-page') {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Send convert message to content script
        await browser.tabs.sendMessage(tab.id, {
          type: 'CONVERT_PAGE',
          origin: (await settingsItem.getValue()).origin,
          target: (await settingsItem.getValue()).target,
        });
        // Update badge
        await browser.action.setBadgeText({ text: '✓', tabId: tab.id });
        await browser.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
      }
    }
  });

  // Handle context menu
  browser.contextMenus.create({
    id: 'convert-selection',
    title: 'Convert selected text',
    contexts: ['selection'],
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'convert-selection' && tab?.id) {
      await browser.tabs.sendMessage(tab.id, {
        type: 'CONVERT_SELECTION',
        origin: (await settingsItem.getValue()).origin,
        target: (await settingsItem.getValue()).target,
      });
    }
  });

  // Handle messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Message routing logic
  });
});
```

### 5.8 Content Script

```typescript
// entrypoints/content.ts
import { createConverter, createHTMLConverter } from '@/lib/converter';
import { VARIANTS, type VariantCode } from '@/lib/constants';
import type { BackgroundMessage, PageStatusResponse } from '@/lib/messaging';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    let htmlConverter: ReturnType<typeof createHTMLConverter> | null = null;
    let isConverted = false;
    let autoModeObserver: MutationObserver | null = null;

    browser.runtime.onMessage.addListener(
      (message: BackgroundMessage, _sender, sendResponse) => {
        switch (message.type) {
          case 'CONVERT_PAGE': {
            const converter = createConverter(message.origin, message.target);
            const fromTag = VARIANTS[message.origin].langTag;
            const toTag = VARIANTS[message.target].langTag;
            htmlConverter = createHTMLConverter(
              converter,
              document.documentElement,
              fromTag,
              toTag,
            );
            htmlConverter.convert();
            isConverted = true;
            break;
          }
          case 'RESTORE_PAGE': {
            if (htmlConverter) {
              htmlConverter.restore();
              htmlConverter = null;
              isConverted = false;
            }
            break;
          }
          case 'GET_PAGE_STATUS': {
            sendResponse({ isConverted } satisfies PageStatusResponse);
            return true; // async response
          }
        }
      },
    );
  },
});
```

### 5.9 Popup UI (Svelte 5)

```svelte
<!-- entrypoints/popup/App.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import VariantSelector from './components/VariantSelector.svelte';
  import ConvertButton from './components/ConvertButton.svelte';
  import AutoModeToggle from './components/AutoModeToggle.svelte';
  import TextBox from './components/TextBox.svelte';
  import { settingsItem, type ExtensionSettings } from '@/lib/storage';
  import { VARIANTS, type VariantCode } from '@/lib/constants';

  let settings: ExtensionSettings = $state({
    origin: 'cn',
    target: 'tw',
    autoMode: false,
    theme: 'system',
  });

  let isConverted = $state(false);
  let activeTab = $state<'convert' | 'textbox'>('convert');

  onMount(async () => {
    settings = await settingsItem.getValue();
    applyTheme(settings.theme);
  });

  async function handleConvert() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, {
        type: 'CONVERT_PAGE',
        origin: settings.origin,
        target: settings.target,
      });
      isConverted = true;
    }
  }

  async function handleRestore() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, { type: 'RESTORE_PAGE' });
      isConverted = false;
    }
  }

  async function handleSettingsChange() {
    await settingsItem.setValue(settings);
  }

  function applyTheme(theme: 'light' | 'dark' | 'system') {
    document.documentElement.dataset.theme = theme;
  }
</script>

<main class="popup">
  <header class="popup-header">
    <h1>🀄 OpenCC</h1>
    <button class="theme-toggle" onclick={() => {
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
      applyTheme(settings.theme);
      handleSettingsChange();
    }}>
      {settings.theme === 'dark' ? '☀️' : '🌙'}
    </button>
  </header>

  <nav class="tab-bar">
    <button class:active={activeTab === 'convert'} onclick={() => activeTab = 'convert'}>
      Convert Page
    </button>
    <button class:active={activeTab === 'textbox'} onclick={() => activeTab = 'textbox'}>
      Text Box
    </button>
  </nav>

  {#if activeTab === 'convert'}
    <VariantSelector
      bind:origin={settings.origin}
      bind:target={settings.target}
      onchange={handleSettingsChange}
    />
    <ConvertButton
      {isConverted}
      onconvert={handleConvert}
      onrestore={handleRestore}
    />
    <AutoModeToggle
      bind:enabled={settings.autoMode}
      onchange={handleSettingsChange}
    />
  {:else}
    <TextBox origin={settings.origin} target={settings.target} />
  {/if}

  <footer class="popup-footer">
    <span class="shortcut-hint">⌨️ Alt+Shift+C</span>
  </footer>
</main>
```

### 5.10 Dark Mode Theme

```css
/* assets/styles/theme.css */
:root,
[data-theme='light'] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e8e8e8;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent: #1a73e8;
  --accent-hover: #1557b0;
  --border: #e0e0e0;
  --success: #4caf50;
  --radius: 8px;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

[data-theme='dark'] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #3d3d3d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --accent: #8ab4f8;
  --accent-hover: #aecbfa;
  --border: #444444;
  --success: #81c784;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

@media (prefers-color-scheme: dark) {
  [data-theme='system'] {
    --bg-primary: #1e1e1e;
    --bg-secondary: #2d2d2d;
    --bg-tertiary: #3d3d3d;
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --accent: #8ab4f8;
    --accent-hover: #aecbfa;
    --border: #444444;
    --success: #81c784;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
}

body {
  width: 320px;
  min-height: 200px;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

### 5.11 Phase 1 Acceptance Criteria

- [ ] `pnpm dev` launches Chrome with extension loaded, HMR works for popup changes
- [ ] Popup opens in < 100ms, displays variant selector with all 6 locales
- [ ] Clicking "Convert" converts all Chinese text on the active tab via `OpenCC.HTMLConverter`
- [ ] Clicking "Restore" reverts text to original
- [ ] `Alt+Shift+C` keyboard shortcut triggers conversion from any tab
- [ ] Right-click context menu "Convert selected text" works on text selection
- [ ] Dark mode toggle works and persists via `chrome.storage.sync`
- [ ] Settings (origin, target, autoMode, theme) persist across browser sessions
- [ ] Auto mode converts dynamically rendered text using `MutationObserver`
- [ ] Badge shows "✓" when a page is converted
- [ ] `pnpm build` produces valid `.output/chrome-mv3` and `.output/firefox-mv2` bundles
- [ ] `pnpm build -b firefox` produces valid Firefox extension
- [ ] All unit tests pass with > 80% coverage
- [ ] E2E tests pass for popup flow and page conversion
- [ ] ESLint + Prettier pass with zero errors
- [ ] CI pipeline (GitHub Actions) runs on every push/PR

---

## 6. Phase 2 — Power Features + Polish (Weeks 4–5)

### 6.1 Per-Site Preference Memory

```typescript
// In content.ts — on conversion, save the preference for the current domain
async function savePreference(origin: VariantCode, target: VariantCode) {
  const hostname = new URL(window.location.href).hostname;
  const prefs = await sitePreferencesItem.getValue();
  prefs[hostname] = { origin, target };
  await sitePreferencesItem.setValue(prefs);
}

// In content.ts — on page load, check for saved preference and auto-apply
async function checkAutoApply() {
  const hostname = new URL(window.location.href).hostname;
  const prefs = await sitePreferencesItem.getValue();
  const pref = prefs[hostname];
  if (pref) {
    const converter = createConverter(pref.origin, pref.target);
    // ... apply conversion
  }
}
```

### 6.2 i18n

```jsonc
// public/_locales/en/messages.json
{
  "extName": { "message": "OpenCC — Chinese Converter" },
  "extDescription": { "message": "Convert webpages between Simplified and Traditional Chinese with one click." },
  "popupConvert": { "message": "Convert Page" },
  "popupRestore": { "message": "Restore" },
  "popupTextBox": { "message": "Text Box" },
  "popupAutoMode": { "message": "Auto Mode" },
  "optionsBlocklist": { "message": "Blocklist" },
  "optionsAllowlist": { "message": "Allowlist" },
  "shortcutHint": { "message": "Keyboard shortcut: Alt+Shift+C" }
}
```

```jsonc
// public/_locales/zh_TW/messages.json
{
  "extName": { "message": "OpenCC — 中文轉換" },
  "extDescription": { "message": "一鍵自動頁面中文簡繁轉換" },
  "popupConvert": { "message": "轉換頁面" },
  "popupRestore": { "message": "還原" },
  "popupTextBox": { "message": "文字方塊" },
  "popupAutoMode": { "message": "自動模式" },
  "optionsBlocklist": { "message": "封鎖清單" },
  "optionsAllowlist": { "message": "允許清單" },
  "shortcutHint": { "message": "快捷鍵：Alt+Shift+C" }
}
```

### 6.3 Options Page — Blocklist/Allowlist

```typescript
// lib/domain-matcher.ts

/**
 * Matches a hostname against a list of glob patterns.
 * Supports wildcards: *.example.com, exact: example.com
 */
export function matchesDomain(hostname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$',
    );
    return regex.test(hostname);
  });
}
```

### 6.4 Badge Enhancement

```typescript
// In background.ts — show conversion direction on badge
async function updateBadge(tabId: number, origin: VariantCode, target: VariantCode) {
  const badgeMap: Record<string, string> = {
    'cn→tw': '繁',
    'cn→twp': '臺',
    'cn→hk': '港',
    'tw→cn': '簡',
    'hk→cn': '簡',
  };
  const key = `${origin}→${target}`;
  const text = badgeMap[key] ?? '✓';
  await browser.action.setBadgeText({ text, tabId });
  await browser.action.setBadgeBackgroundColor({ color: '#1a73e8', tabId });
}
```

### 6.5 Web Store Assets

- **Screenshots**: 1280×800, showing popup in light + dark mode
- **Promotional tiles**: 440×280 (small), 920×680 (large), 1400×560 (marquee)
- **Description**: bilingual EN + zh-TW, emphasize:
  - One-click conversion
  - All Chinese variants supported
  - Dark mode
  - Keyboard shortcut
  - Per-site memory
  - Open source

### 6.6 Phase 2 Acceptance Criteria

- [ ] Per-site preferences auto-apply on revisit
- [ ] Options page loads with blocklist/allowlist editor
- [ ] Domain patterns can be added, edited, deleted, and exported/imported as JSON
- [ ] i18n works in EN, zh-TW, zh-CN — all popup and options page strings are localized
- [ ] Badge shows conversion direction character (繁/簡/港/臺)
- [ ] Web Store screenshots and promotional tiles are prepared
- [ ] All new features have unit tests, per-site preference has E2E test

---

## 7. Phase 3 — Optimization + Expansion (Weeks 6–7)

### 7.1 Bundle Analysis

```typescript
// wxt.config.ts — add visualizer plugin
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  vite: () => ({
    plugins: [
      visualizer({
        filename: '.output/bundle-report.html',
        open: true,
        gzipSize: true,
      }),
    ],
  }),
});
```

### 7.2 Tree-Shaking Audit

Verify that using `opencc-js/core` + selective `Locale` imports eliminates unused dictionaries:

```typescript
// lib/converter.ts — optimized imports
import { Converter, HTMLConverter, ConverterFactory } from 'opencc-js/core';
import { from as localeFrom, to as localeTo } from 'opencc-js/preset';

// Only the dictionaries needed for the configured direction will be bundled
// if Vite's tree-shaking is working correctly.
```

Compare bundle sizes:
- `import OpenCC from 'opencc-js'` (full bundle)
- `import * as OpenCC from 'opencc-js/core'` + selective Locale (tree-shaken)

### 7.3 Lazy-Load Exploration (If Needed)

```typescript
// lib/converter.ts — dynamic import approach (only if bundle is too large)
export async function createConverterAsync(from: VariantCode, to: VariantCode) {
  const [OpenCC, Locale] = await Promise.all([
    import('opencc-js/core'),
    import('opencc-js/preset'),
  ]);
  return OpenCC.ConverterFactory(Locale.from[from], Locale.to[to]);
}
```

### 7.4 Phase 3 Acceptance Criteria

- [ ] Bundle report generated and reviewed
- [ ] Tree-shaking verified — unused dictionaries excluded
- [ ] Total extension size ≤ 2 MB (Chrome Web Store recommends < 10 MB)
- [ ] Performance: popup opens in < 50ms, page conversion < 500ms for average page
- [ ] Safari evaluation documented (go/no-go decision)
- [ ] Automated publishing via `wxt submit` tested with `--dry-run`

---

## 8. Phase 4 — Launch

### 8.1 Chrome Web Store

1. Create developer account ($5 one-time fee)
2. Create listing manually (first time only)
3. Set up OAuth credentials for `wxt submit` automation:
   - Google Cloud Console → Create Project → Enable Chrome Web Store API
   - OAuth Consent Screen → External → Publish to Production
   - Create OAuth Client ID → Web Application
   - Get Refresh Token via OAuth 2.0 Playground
4. Add secrets to GitHub repo: `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `CHROME_EXTENSION_ID`

### 8.2 Firefox AMO

1. Create developer account (free)
2. Generate API credentials at `addons.mozilla.org/developers/addon/api/key`
3. Add secrets: `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET`, `FIREFOX_EXTENSION_ID`
4. **Important**: Firefox requires source code ZIP for review → `wxt submit --firefox-sources-zip`

### 8.3 Edge Add-ons

1. Create developer account (free, via Microsoft Partner Center)
2. Generate API credentials
3. Add secrets: `EDGE_CLIENT_ID`, `EDGE_CLIENT_SECRET`, `EDGE_ACCESS_TOKEN_URL`, `EDGE_PRODUCT_ID`

### 8.4 Phase 4 Acceptance Criteria

- [ ] Chrome Web Store listing live and approved
- [ ] Firefox AMO listing live and approved
- [ ] Edge Add-ons listing live and approved
- [ ] `wxt submit` automated publishing works on git tag
- [ ] README updated with store badges and installation links
- [ ] CHANGELOG generated from conventional commits
- [ ] GitHub Release created with ZIPs attached

---

## 9. Testing Strategy

### 9.1 Unit Tests (Vitest)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

**Test coverage targets:**

| Module | Tests |
|---|---|
| `lib/converter.ts` | All 10+ direction pairs (cn↔tw, cn↔twp, cn↔hk, cn↔jp, tw↔hk, etc.), edge cases (empty string, mixed scripts, HTML entities) |
| `lib/storage.ts` | `defineItem` fallback values, schema validation, migration from v0→v1 |
| `lib/messaging.ts` | Message type discrimination, response types |
| `lib/domain-matcher.ts` | Exact match, wildcard `*.example.com`, edge cases (`localhost`, IP addresses) |
| `lib/constants.ts` | All variants have valid `langTag` values |

```typescript
// test/unit/converter.test.ts
import { describe, it, expect } from 'vitest';
import { convertText } from '@/lib/converter';

describe('convertText', () => {
  it('converts Simplified Chinese to Traditional Chinese (Taiwan)', () => {
    expect(convertText('汉语', 'cn', 'tw')).toBe('漢語');
  });

  it('converts Traditional Chinese (Taiwan) to Simplified Chinese', () => {
    expect(convertText('漢語', 'tw', 'cn')).toBe('汉语');
  });

  it('converts Simplified to Traditional with Taiwan phrases', () => {
    expect(convertText('软件', 'cn', 'twp')).toBe('軟體');
  });

  it('handles empty string', () => {
    expect(convertText('', 'cn', 'tw')).toBe('');
  });

  it('preserves non-Chinese text', () => {
    expect(convertText('Hello World 123', 'cn', 'tw')).toBe('Hello World 123');
  });

  it('handles mixed content', () => {
    const input = 'Hello 汉语 World';
    const output = convertText(input, 'cn', 'tw');
    expect(output).toBe('Hello 漢語 World');
  });
});
```

```typescript
// test/unit/domain-matcher.test.ts
import { describe, it, expect } from 'vitest';
import { matchesDomain } from '@/lib/domain-matcher';

describe('matchesDomain', () => {
  it('matches exact domain', () => {
    expect(matchesDomain('example.com', ['example.com'])).toBe(true);
  });

  it('matches wildcard subdomain', () => {
    expect(matchesDomain('sub.example.com', ['*.example.com'])).toBe(true);
  });

  it('does not match unrelated domain', () => {
    expect(matchesDomain('other.com', ['example.com'])).toBe(false);
  });

  it('handles empty patterns list', () => {
    expect(matchesDomain('example.com', [])).toBe(false);
  });

  it('matches localhost', () => {
    expect(matchesDomain('localhost', ['localhost'])).toBe(true);
  });
});
```

### 9.2 E2E Tests (Playwright)

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  use: {
    headless: false,  // Extensions require headed mode
  },
  projects: [
    {
      name: 'chromium',
      use: {
        // Load the built extension
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('.output/chrome-mv3')}`,
            `--load-extension=${path.resolve('.output/chrome-mv3')}`,
          ],
        },
      },
    },
  ],
});
```

```typescript
// test/e2e/popup.spec.ts
import { test, expect, type BrowserContext } from '@playwright/test';

test.describe('Popup', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async ({ browserName }) => {
    // Get the extension ID from the service worker
    const serviceWorkers = context.serviceWorkers();
    extensionId = serviceWorkers[0]?.url().split('/')[2] ?? '';
  });

  test('opens popup and displays variant selectors', async ({ page }) => {
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await expect(page.locator('h1')).toContainText('OpenCC');
    await expect(page.locator('[data-testid="origin-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="target-selector"]')).toBeVisible();
  });

  test('convert button triggers page conversion', async ({ page }) => {
    // Navigate to test fixture page with known Chinese text
    await page.goto('file://' + path.resolve('test/e2e/fixtures/test-page.html'));

    // Open popup
    const popup = await page.goto(`chrome-extension://${extensionId}/popup/index.html`);

    // Click convert
    await page.click('[data-testid="convert-button"]');

    // Verify badge updated (or verify via content script status)
  });

  test('dark mode toggle persists', async ({ page }) => {
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.click('[data-testid="theme-toggle"]');
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');

    // Reload and verify persistence
    await page.reload();
    const persistedTheme = await page.locator('html').getAttribute('data-theme');
    expect(persistedTheme).toBe('dark');
  });
});
```

```html
<!-- test/e2e/fixtures/test-page.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>OpenCC E2E Test Page</title>
</head>
<body>
  <h1 id="test-heading">汉语测试页面</h1>
  <p id="test-paragraph">这是一个用于测试简繁转换的页面。软件工程师正在开发新的应用程序。</p>
  <p id="test-mixed">Hello World! 这是混合文本 with English and 中文。</p>
  <div id="test-nested">
    <span>嵌套的文本节点</span>
    <span>另一个节点</span>
  </div>
  <p class="ignore-opencc" id="test-ignored">这段文字不应该被转换</p>
</body>
</html>
```

---

## 10. CI/CD Pipeline

### 10.1 CI Workflow (Every Push/PR)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chrome, firefox]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm wxt build -b ${{ matrix.browser }}
      - uses: actions/upload-artifact@v4
        with:
          name: extension-${{ matrix.browser }}
          path: .output/

  test-e2e:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps chromium
      - uses: actions/download-artifact@v4
        with:
          name: extension-chrome
          path: .output/
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### 10.2 Publish Workflow (On Tag)

```yaml
# .github/workflows/publish.yml
name: Publish

on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      # Build and ZIP for all browsers
      - run: pnpm wxt zip
      - run: pnpm wxt zip -b firefox

      # Submit to stores
      - run: |
          pnpm wxt submit \
            --chrome-zip .output/*-chrome.zip \
            --firefox-zip .output/*-firefox.zip \
            --firefox-sources-zip .output/*-sources.zip \
            --edge-zip .output/*-chrome.zip
        env:
          CHROME_EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
          CHROME_CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
          CHROME_CLIENT_SECRET: ${{ secrets.CHROME_CLIENT_SECRET }}
          CHROME_REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}
          FIREFOX_EXTENSION_ID: ${{ secrets.FIREFOX_EXTENSION_ID }}
          FIREFOX_JWT_ISSUER: ${{ secrets.FIREFOX_JWT_ISSUER }}
          FIREFOX_JWT_SECRET: ${{ secrets.FIREFOX_JWT_SECRET }}
          EDGE_PRODUCT_ID: ${{ secrets.EDGE_PRODUCT_ID }}
          EDGE_CLIENT_ID: ${{ secrets.EDGE_CLIENT_ID }}
          EDGE_CLIENT_SECRET: ${{ secrets.EDGE_CLIENT_SECRET }}
          EDGE_ACCESS_TOKEN_URL: ${{ secrets.EDGE_ACCESS_TOKEN_URL }}

      # Create GitHub Release
      - uses: softprops/action-gh-release@v2
        with:
          files: .output/*.zip
          generate_release_notes: true
```

---

## 11. Code Quality Tooling

### 11.1 ESLint (Flat Config)

```javascript
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    ignores: ['.output/', '.wxt/', 'node_modules/', 'coverage/', 'playwright-report/'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
];
```

### 11.2 Prettier

```jsonc
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [
    {
      "files": "*.svelte",
      "options": {
        "parser": "svelte"
      }
    }
  ]
}
```

### 11.3 Commitlint

```yaml
# .commitlintrc.yml
extends:
  - '@commitlint/config-conventional'
rules:
  type-enum:
    - 2
    - always
    - [feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert]
  subject-case:
    - 2
    - never
    - [sentence-case, start-case, pascal-case, upper-case]
  header-max-length:
    - 2
    - always
    - 72
```

### 11.4 Husky + lint-staged

```jsonc
// package.json (partial)
{
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test": "pnpm test:unit && pnpm test:e2e",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,svelte}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml,css,html}": ["prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

---

## 12. Key Dependencies

```jsonc
{
  "dependencies": {
    "opencc-js": "^1.3.1"
  },
  "devDependencies": {
    // Core
    "wxt": "^0.20.26",
    "@wxt-dev/module-svelte": "^2.0.4",
    "svelte": "^5.0.0",
    "typescript": "^5.9.0",

    // Testing
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "@playwright/test": "^1.50.0",

    // Linting & Formatting
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "eslint-plugin-svelte": "^3.0.0",
    "eslint-config-prettier": "^10.0.0",
    "prettier": "^3.0.0",
    "prettier-plugin-svelte": "^4.0.0",

    // Git hooks & Commit
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",

    // Bundle analysis (Phase 3)
    "rollup-plugin-visualizer": "^5.0.0"
  }
}
```

---

## 13. Success Criteria

### Must-Have for Web Store Launch

| # | Criterion | Measurement |
|---|---|---|
| 1 | Feature parity with upstream | All 6 locales (cn, tw, twp, hk, jp, t) convert correctly |
| 2 | Dark mode | Popup + options page support light/dark/system |
| 3 | Keyboard shortcut | `Alt+Shift+C` triggers conversion |
| 4 | Cross-browser | Chrome + Firefox + Edge all build and install successfully |
| 5 | Settings sync | `chrome.storage.sync` persists settings across devices |
| 6 | Per-site preference | Auto-applies last-used conversion for each domain |
| 7 | Test coverage | > 80% unit test coverage, E2E for all critical paths |
| 8 | CI/CD | Automated lint → build → test on PR; automated publish on tag |
| 9 | i18n | EN + zh-TW + zh-CN for extension UI and Web Store listing |
| 10 | Store listing | Professional screenshots, bilingual description, all three stores |

### Quality Gates

- Zero ESLint errors
- Zero TypeScript errors (`strict: true`)
- All unit tests pass
- All E2E tests pass
- Extension size ≤ 2 MB
- Popup opens in < 100ms
- Page conversion completes in < 500ms for average page
- No `console.error` or unhandled rejections in production build

---

## Appendix: Quick Reference Commands

```bash
# Development
pnpm dev                    # Start dev server with HMR (Chrome)
pnpm dev -b firefox         # Start dev server (Firefox)

# Building
pnpm build                  # Build for Chrome (MV3)
pnpm build -b firefox       # Build for Firefox
pnpm zip                    # Build + ZIP for Chrome
pnpm zip -b firefox         # Build + ZIP for Firefox

# Testing
pnpm test:unit              # Run unit tests
pnpm test:unit -- --watch   # Run unit tests in watch mode
pnpm test:unit -- --coverage # Run with coverage
pnpm test:e2e               # Run E2E tests (requires build first)
pnpm test                   # Run all tests

# Code Quality
pnpm lint                   # ESLint check
pnpm lint:fix               # ESLint auto-fix
pnpm format                 # Prettier format
pnpm format:check           # Prettier check
pnpm typecheck              # TypeScript type check

# Publishing
pnpm wxt submit init        # Set up store credentials (first time)
pnpm wxt submit --dry-run … # Test submission
git tag v1.0.0 && git push --tags  # Trigger automated publish
```
