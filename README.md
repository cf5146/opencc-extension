# opencc-extension

![OpenCC browser extension icon](./icon.png)

[![CI Status](https://github.com/cf5146/opencc-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/cf5146/opencc-extension/actions/workflows/ci.yml)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](https://github.com/cf5146/opencc-extension/blob/main/CONTRIBUTING.md)

Convert Chinese text between Simplified, Traditional (TW/HK), Japanese Shinjitai, and other OpenCC variants directly inside your browser. The extension is now built with WXT and Svelte, and every conversion happens locally—no network calls required.

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
> The extension is built for Chrome, Firefox, and Edge from the same WXT codebase.

## Overview

The project bundles the official [OpenCC](https://github.com/BYVoid/OpenCC) dictionaries (via [opencc-js](https://github.com/nk2028/opencc-js)) and runs them inside the browser. Supported variants include:

- `cn`: Simplified Chinese (Mainland China)
- `tw`: Traditional Chinese (Taiwan)
- `twp`: Traditional Chinese (Taiwan) with native phrases
- `hk`: Traditional Chinese (Hong Kong)
- `jp`: Japanese Shinjitai
- `t`: Generic Traditional Chinese

## Feature snapshot

- One-click page-wide conversion using OpenCC's `HTMLConverter`.
- Auto mode that watches for new DOM nodes via [`MutationObserver`](https://developer.mozilla.org/docs/Web/API/MutationObserver).
- Context-menu action to convert highlighted selections in place.
- Popup textbox for quick phrase-by-phrase conversion.
- Dark mode, keyboard shortcut support, synced settings, per-site preferences, and blocklist/allowlist rules.
- All work happens offline—no tracking, no telemetry.

![Converting a highlighted text selection](./select.gif)
![Real-time textbox conversion](./textbox.gif)

## Architecture

The codebase follows WXT's file-based extension structure:

- **`entrypoints/`** – Background worker, content script, popup, and options pages.
- **`lib/`** – Typed conversion, storage, messaging, constants, and domain matching helpers.
- **`assets/styles/`** – Shared popup/options theme styles with light, dark, and system modes.
- **`public/_locales/`** – Chrome-compatible i18n messages for English, Traditional Chinese, and Simplified Chinese.
- **`test/`** – Vitest unit tests and Playwright extension E2E tests.

## Installation

### From the stores

Install from the listings above—updates are handled automatically by each store.

### Manual build (Chromium-based browsers)

1. Clone the repository and install dependencies.
2. Build the extension bundle.
3. Load the generated `.output/chrome-mv3/` directory as an unpacked extension.

```powershell
npm install
npm run build
```

For Firefox, use `npm run build:firefox` and load the produced artifacts from `.output/` via `about:debugging`.

## Usage

1. Click the extension icon to open the popup.
2. Choose the **Origin** (current text variant) and **Target** (desired variant).
3. Use one of the entry points:
   - **Convert page**: Transforms visible text in the active tab.
   - **Convert selection**: Right-click any highlighted text and choose “Convert selected text”.
   - **Textbox conversion**: Type or paste phrases in the popup to convert as you go.

The extension remembers your last origin/target pair and per-site conversion choices for future sessions.

## Auto mode

Enable auto mode from the popup to continually convert new content—perfect for sites that stream or dynamically load text.

Use the options page to block or allow specific domain patterns such as `*.example.com`. When a page is converted, the toolbar badge shows the conversion direction.

![Automatic conversion mode badge](./auto.gif)

## Development

The project uses Node.js ≥ 20.19, [npm](https://www.npmjs.com/), WXT, Svelte 5, and TypeScript.

```powershell
npm install            # install dependencies
npm run dev            # start WXT dev mode for Chrome
npm run dev:firefox    # start WXT dev mode for Firefox
npm run build          # build Chrome MV3 output
npm run build:firefox  # build Firefox output
```

WXT writes builds to `.output/` and handles manifest generation for Chrome, Firefox, and Edge.

## Testing

Unit tests use [Vitest](https://vitest.dev/), and extension E2E tests use [Playwright](https://playwright.dev/).

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```

CI runs formatting, linting, type checking, unit tests, browser builds, and Playwright E2E checks on every pull request.

## Data and privacy

- Conversions execute entirely in the browser; no text ever leaves your machine.
- The extension stores only preferences such as origin/target locales, theme, auto-mode flag, per-site preferences, and domain rules using browser storage APIs.
- No analytics, telemetry, or advertising trackers are included.

## Troubleshooting

- **Nothing changes after clicking convert** – Ensure the page is not excluded by the domain blocklist and that Origin/Target differ.
- **Auto mode feels slow** – Heavy pages with frequent DOM mutations may benefit from disabling auto mode or narrowing the scope using the whitelist.
- **Firefox-specific quirks** – Firefox requires the extension to be reloaded after every build from source.

If you bump into a bug, please open an issue with reproduction steps, browser version, and the page URL (if shareable).

## Contributing

Pull requests and issues are welcome! Read [CONTRIBUTING.md](./CONTRIBUTING.md) for workflow details, coding standards, and release steps.

## Credits

- [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC) – Original dictionaries and conversion rules.
- [nk2028/opencc-js](https://github.com/nk2028/opencc-js) – JavaScript adaptation of the OpenCC data.

## License

MIT © 2024 Tony Chan
