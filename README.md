# opencc-extension

![OpenCC browser extension icon](./icon.png)

[![CI Status](https://github.com/cf5146/opencc-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/cf5146/opencc-extension/actions/workflows/ci.yml)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](https://github.com/cf5146/opencc-extension/blob/main/CONTRIBUTING.md)

![Popup converting a webpage using opencc-extension](./demo.gif)

[![Install from the Chrome Web Store](https://user-images.githubusercontent.com/585534/107280622-91a8ea80-6a26-11eb-8d07-77c548b28665.png)](https://chromewebstore.google.com/detail/opencc/jmlbcbhpnfpffhniogblmmiklgbopoif)
[![Install from Firefox Add-ons](https://user-images.githubusercontent.com/585534/107280546-7b9b2a00-6a26-11eb-8f9f-f95932f4bfec.png)](https://addons.mozilla.org/firefox/addon/opencc)

A browser extension that converts text in the current active tab between different Chinese variants.

This extension now ships with a self-hosted OpenCC converter (see `src/lib/opencc`),
built directly from the official [OpenCC](https://github.com/BYVoid/OpenCC) dictionaries.
The bundled data originates from the MIT-licensed [opencc-js](https://github.com/nk2028/opencc-js) project,
but the runtime implementation is maintained within this repository.

Most of the variants supported by OpenCC are supported:

- `cn`: Simplified Chinese (Mainland China)
- `hk`: Traditional Chinese (Hong Kong)
- `tw`: Traditional Chinese (Taiwan)
  - `twp`: Traditional Chinese (Taiwan) with native phrases
- ~~`t`: Traditional Chinese (OpenCC standard)~~
- ~~`jp`: Japanese Shinjitai~~

> [!NOTE]
> Only Chrome and Firefox are tested.
> Other browsers may also work but are not guaranteed to.

## Features

- Minimalist user interface.
- Fast performance (using [`TreeWalker`](https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker)).
- Converts whole text on a webpage with one click.
  - Can also convert dynamically rendered text in auto mode
    (using [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)).
- Converts selected text on a webpage in right click context menu.
- Converts any text provided in the text box in real time.
- Other features of OpenCC.
  - 嚴格區分「一簡對多繁」和「一簡對多異」。
  - 完全兼容異體字，可以實現動態替換。
  - 嚴格審校一簡對多繁詞條，原則爲「能分則不合」。
  - 支持中國大陸、臺灣、香港異體字和地區習慣用詞轉換，如「裏」「裡」、「鼠標」「滑鼠」。

## Architecture

- **Domain (`src/domain`)** – locale rules, validation helpers, and other pure data definitions.
- **Infrastructure (`src/infrastructure`)** – adapters that wire the bundled OpenCC converter into the app.
- **Application (`src/application`)** – stateful services that handle caching, DOM traversal, and selection updates.
- **Core (`src/core`)** – small façade exporting stable helpers (`convertAllNewTextNodes`, `convertPlainText`, etc.) to the rest of the extension.
- **Presentation (`src/content`, `src/popup`, `src/background`)** – browser-facing scripts that consume the core façade and Chrome APIs.

See [usage](#usage) for more ways to convert text.

## Usage

Specify the language settings in the extension popup.

| Setting | Description |
| --- | --- |
| **Origin** | The original Chinese variant on the current page |
| **Target** | The desired Chinese variant to convert into |

- **Origin**: the original Chinese text variant in the webpage
- **Target**: the desired Chinese text variant to be converted into

![Converting a highlighted text selection](./select.gif)
![Real-time textbox conversion](./textbox.gif)

![One-click full page conversion](./demo.gif)
![Automatic conversion mode badge](./auto.gif)

> [!NOTE]
> For performance reason, auto mode will not convert text on webpages which
> explicitly specify their `lang` attributes to be languages other than `zh` in their HTML documents.

When auto mode is enabled, a grey badge with the letter `A` appears on the corner of the extension icon.

All text in the webpage of the current active tab is converted whenever it loads or is updated.

## Credits

- <https://github.com/BYVoid/OpenCC>
- <https://github.com/nk2028/opencc-js> (dictionaries)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for GitHub Flow, development, and release process.

---

> ~ crafted with ♥︎ by tnychn ~
>
> MIT © 2024 Tony Chan
