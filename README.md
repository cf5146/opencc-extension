# opencc-extension

![OpenCC browser extension icon](./icon.png)

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
- Auto mode that watches for new DOM nodes via [`MutationObserver`](https://developer.mozilla.org/docs/Web/API/MutationObserver).
- Context-menu action to convert highlighted selections in place.
- Popup textbox for quick phrase-by-phrase conversion.
- Locale whitelist to avoid converting unsuitable sections such as code blocks.
- All work happens offline—no tracking, no telemetry.

![Converting a highlighted text selection](./select.gif)
![Real-time textbox conversion](./textbox.gif)

## Architecture

The codebase follows a layered structure to keep concerns clean and testable:

- **Domain (`src/domain`)** – Locale definitions and validation helpers.
- **Infrastructure (`src/infrastructure`)** – The OpenCC factory that wires dictionary data to runtime converters.
- **Application (`src/application`)** – Stateful services that orchestrate conversion, caching, and DOM traversal.
- **Core (`src/core`)** – A small façade exposing stable helpers (`convertPlainText`, `convertAllNewTextNodes`, `convertSelection`, etc.).
- **Presentation (`src/content`, `src/popup`, `src/background`)** – Browser-facing scripts that interact with Chrome/Firefox APIs.

## Installation

### From the stores

Install from the listings above—updates are handled automatically by each store.

### Manual build (Chromium-based browsers)

1. Clone the repository and install dependencies.
2. Build the extension bundle.
3. Load the generated `build/` directory as an unpacked extension.

```powershell
pnpm install
pnpm build
```

For Firefox, use `pnpm build:firefox` and load the produced artifacts from `build/` via `about:debugging`.

## Usage

1. Click the extension icon to open the popup.
2. Choose the **Origin** (current text variant) and **Target** (desired variant).
3. Use one of the entry points:
   - **Convert page**: Transforms visible text in the active tab.
   - **Convert selection**: Right-click any highlighted text and choose “Convert with OpenCC”.
   - **Textbox conversion**: Type or paste phrases in the popup to convert as you go.

The extension remembers your last origin/target pair for future sessions.

## Auto mode

Enable auto mode from the popup to continually convert new content—perfect for sites that stream or dynamically load text.

> [!NOTE]
> To avoid unwanted conversions, auto mode skips pages whose `<html>` tag sets a non-Chinese `lang` attribute (for example, `lang="en"`).

When auto mode is active, a grey badge with the letter “A” appears on the toolbar icon. Toggle it off from the popup at any time.

![Automatic conversion mode badge](./auto.gif)

## Development

The project uses Node.js ≥ 18, [pnpm](https://pnpm.io/) ≥ 8, and TypeScript.

```powershell
pnpm install      # install dependencies
pnpm dev          # start a watch build (outputs to build/)
pnpm build        # generate production bundles
```

While developing, load the `build/` directory as an unpacked extension (Chromium) or temporary add-on (Firefox) and keep the watch build running.

## Testing

Unit and integration tests use [Vitest](https://vitest.dev/).

```powershell
pnpm typecheck
pnpm test
pnpm vitest run tests/conversion-service.test.ts
```

CI runs linting, type checking, and tests on every pull request through GitHub Actions.

## Data and privacy

- Conversions execute entirely in the browser; no text ever leaves your machine.
- The extension stores only minimal preferences (origin/target locales and auto-mode flag) using browser storage APIs.
- No analytics, telemetry, or advertising trackers are included.

## Troubleshooting

- **Nothing changes after clicking convert** – Ensure the page is not excluded by the locale whitelist and that Origin/Target differ.
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
