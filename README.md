# opencc-extension

![OpenCC browser extension icon](./public/icon.png)

[![CI Status](https://github.com/cf5146/opencc-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/cf5146/opencc-extension/actions/workflows/ci.yml)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](https://github.com/cf5146/opencc-extension/blob/main/CONTRIBUTING.md)

Convert Chinese text between Simplified, Traditional (TW/HK), and other OpenCC variants directly inside your browser. The extension ships with an embedded OpenCC engine so every conversion happens locally—no network calls required.

![Popup converting a webpage using opencc-extension](./demo.gif)

## Table of contents

- [Store listings](#store-listings)
- [Overview](#overview)
- [Feature snapshot](#feature-snapshot)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Auto mode](#auto-mode)
- [Development](#development)
- [Testing](#testing)
- [Data and privacy](#data-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)

## Store listings

[![Install from the Chrome Web Store](https://user-images.githubusercontent.com/585534/107280622-91a8ea80-6a26-11eb-8d07-77c548b28665.png)](https://chromewebstore.google.com/detail/opencc/jmlbcbhpnfpffhniogblmmiklgbopoif)
[![Install from Firefox Add-ons](https://user-images.githubusercontent.com/585534/107280546-7b9b2a00-6a26-11eb-8f9f-f95932f4bfec.png)](https://addons.mozilla.org/firefox/addon/opencc)
[![Get it from Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/add-ons-badge-images/microsoft-edge-add-ons-badge.png)](https://microsoftedge.microsoft.com/addons/detail/opencc/mdbpbkojhmbbeepkhehdllcjdefbahnh)

> [!NOTE]
> The extension is actively tested on Chrome and Firefox. Other Chromium-based browsers may work, but compatibility is not guaranteed.

## Overview

The project bundles the official [OpenCC](https://github.com/BYVoid/OpenCC) dictionaries (via [opencc-js](https://github.com/nk2028/opencc-js)) and runs them inside the browser. Supported variants include:

- `cn`: Simplified Chinese (Mainland China)
- `hk`: Traditional Chinese (Hong Kong)
- `tw`: Traditional Chinese (Taiwan)
  - `twp`: Traditional Chinese (Taiwan) with native phrases

The legacy OpenCC presets `t` and `jp` are intentionally excluded to keep the UI focused and the bundles smaller.

## Feature snapshot

- One-click page-wide conversion using a fast [`TreeWalker`](https://developer.mozilla.org/docs/Web/API/TreeWalker).
- Auto mode that watches new and changed content via [`MutationObserver`](https://developer.mozilla.org/docs/Web/API/MutationObserver), using a deduplicated queue that yields between small batches.
- Context-menu action to convert highlighted selections in place.
- Popup text conversion with separate Original and Result fields, copy, clear, and IME-aware previews.
- Exact-host Always/Never auto-conversion rules, with a global default and advanced URL exclusions.
- URL exclusions to skip selected sites in auto mode.
- All work happens offline—no tracking, no telemetry.

![Converting a highlighted text selection](./select.gif)
![Real-time textbox conversion](./textbox.gif)

## Architecture

The codebase follows a layered structure to keep concerns clean and testable:

- **Domain (`src/domain`)** – Locale definitions and validation helpers.
- **Infrastructure (`src/infrastructure`)** – The OpenCC factory that wires dictionary data to runtime converters.
- **Application (`src/application`)** – Stateful services that orchestrate conversion, caching, and DOM traversal.
- **Core (`src/core`)** – A small façade exposing stable helpers (`convertPlainText`, `convertAllNewTextNodes`, `convertSelection`, etc.).
- **Presentation (`entrypoints`)** – WXT background, content-script, popup, and options entrypoints.
- **Platform (`src/platform`)** – The only browser API boundary; application code uses platform ports.

## Installation

### From the stores

Install from the listings above—updates are handled automatically by each store.

### Manual build

1. Clone the repository and install dependencies.
2. Build the target you want to load.
3. Load the matching `.output/<browser>-mv3/` directory as an unpacked extension.

```powershell
npm ci
npm run build:chrome
```

Chrome and Edge use Chromium MV3 service workers. Firefox uses its MV3 background `scripts` declaration and can be loaded from `.output/firefox-mv3/` through `about:debugging`.

The `npm run dist` command writes all three target packages to `.output/` as `opencc.chrome.zip`, `opencc.firefox.zip`, and `opencc.edge.zip`.

## Usage

1. Click the extension icon to open the popup.
2. Choose **來源** (current text variant) and **目標** (desired variant). The interface uses Traditional Chinese.
3. Use one of the entry points:
   - **轉換目前網頁**: Transforms visible text in the active tab.
   - **Convert selection**: Right-click highlighted text and choose “轉換選取的中文字”.
   - **Textbox conversion**: Type or paste into **原文**; **轉換結果** updates without changing your original text. Swap the direction to recompute, use **複製結果**, or **清除文字**. Text is never saved.

If a tab was opened before the static content script was ready, page conversion performs one active-tab injection fallback and one retry.

The extension remembers your last origin/target pair for future sessions. It is shared by page, selection, and popup text conversion. If a page loads more content after a manual conversion, click Convert page again to convert the new text. Unchanged text is skipped.

## Auto mode

Enable **Auto-convert by default** in the popup or settings to continually convert new content, including text replaced inside an existing node. In **This site**, choose **Use default**, **Always auto-convert**, or **Never auto-convert**. Rules match the exact hostname: subdomains are separate, while paths and ports share the rule. An Always rule enables auto conversion even when the global default is off. Excluded URLs and the page-language safeguard still take priority. Manual conversion remains available on excluded sites.

> [!NOTE]
> To avoid unwanted conversions, auto mode skips pages whose `<html>` tag sets a non-Chinese `lang` attribute (for example, `lang="en"`).

Content scripts are declared statically for HTTP and HTTPS pages. Auto mode enables or disables the observer inside that already-declared content script; it never registers or unregisters scripts at runtime. The toolbar badge “A” indicates that the global auto-conversion default is on; it does not report whether the current page is eligible or whether a site override is active. Toggle the default from the popup or settings.

Auto conversion processes queued DOM work in tasks limited to 200 visited nodes or an 8ms cooperative budget. It does not repeatedly scan the page when unrelated elements change. Disabling auto mode cancels queued work and stops observation; it leaves already converted text in place. Reenabling it checks content loaded while it was off. Changing direction on a converted page, or encountering a conversion failure, pauses auto conversion until the page is reloaded. A single long text conversion or cold dictionary initialization can exceed the task budget.

Click **設定** in the popup header to expand **網站規則與進階設定** inside the same popup. Remove hostname rules and edit advanced exclusions here without opening a separate extension settings page. Exclusions are JavaScript regular expressions matched against the full URL, one per line. Existing stored expressions are retained. Invalid edited expressions cannot be saved; malformed expressions already in storage are ignored individually. Select **儲存變更** to apply edits. Save failures keep your edits for retry. The popup keeps its action button visible while the content scrolls, including when the browser limits the available height.

![Automatic conversion mode badge](./auto.gif)

## Development

The project uses Node.js 22.22.2+, 24.15.0+, or 26+, [npm](https://www.npmjs.com/) ≥ 9, [WXT](https://wxt.dev/), and TypeScript. Chrome, Edge, and Firefox are built from one shared source tree with explicit Manifest V3 targets.

```powershell
npm ci
npm run dev             # Chrome watch build in .output/chrome-mv3/
npm run dev:firefox     # Firefox watch build in .output/firefox-mv3/
npm run build:chrome
npm run build:firefox
npm run build:edge
npm run dist            # package all three targets
```

While developing, load the matching `.output/<browser>-mv3/` directory as an unpacked extension or temporary add-on and keep the WXT watch build running. `npm run dev:edge` is also available for Edge development.

## Testing

Unit and integration tests use [Vitest](https://vitest.dev/).

```powershell
npm run typecheck
npm run lint
npm test
npx vitest run tests/conversion-service.test.ts
```

The full local gate is `npm run ci`: it runs linting, type checking, tests, all three MV3 builds, and the generated-artifact verifier for each target. CI runs the same checks on every pull request.

## CI and releases

CI installs once, checks the source, builds each browser once, and packages those verified outputs with SHA-256 checksums. Manual release preparation opens a version/changelog PR; after review and merge, manual publication tags the selected main commit and publishes the verified packages through a recoverable draft release. See [the contributor release and recovery guide](./CONTRIBUTING.md#release-process).

## Data and privacy

- Conversions execute entirely in the browser; no text ever leaves your machine.
- The extension stores preferences (origin/target locales, auto-mode default, hostname rules, URL exclusions, and legacy textbox size) using browser storage APIs. Popup input and results are never persisted.
- No analytics, telemetry, or advertising trackers are included.

## Troubleshooting

- **Nothing changes after clicking convert** – Ensure Origin/Target differ and that the page uses HTTP or HTTPS. Protected browser pages cannot be injected.
- **Auto mode feels slow** – Use Never auto-convert for busy sites or disable the global default. Auto conversion queues only changed content, but very large individual text nodes and initial dictionary construction can still take time.
- **Build output** – Load the target-specific `.output/<browser>-mv3/` directory, not the old `build/` directory. Firefox requires the extension to be reloaded after every source build.

If you bump into a bug, please open an issue with reproduction steps, browser version, and the page URL (if shareable).

## Contributing

Pull requests and issues are welcome! Read [CONTRIBUTING.md](./CONTRIBUTING.md) for workflow details, coding standards, and release steps.

## Credits

- [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC) – Original dictionaries and conversion rules.
- [nk2028/opencc-js](https://github.com/nk2028/opencc-js) – JavaScript adaptation of the OpenCC data.

## License

MIT © 2024 Tony Chan
