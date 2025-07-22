<p align="center">
  <img src="./icon.png" width="64px" />
</p>

<h1 align="center">opencc-extension</h1>

<p align="center"><img src="./demo.gif" width="50%" /></p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/opencc/jmlbcbhpnfpffhniogblmmiklgbopoif">
    <img src="https://user-images.githubusercontent.com/585534/107280622-91a8ea80-6a26-11eb-8d07-77c548b28665.png">
  </a>
  <a href="https://addons.mozilla.org/firefox/addon/opencc">
    <img src="https://user-images.githubusercontent.com/585534/107280546-7b9b2a00-6a26-11eb-8f9f-f95932f4bfec.png" />
  </a>
</p>

A browser extension that converts text in the current active tab between different Chinese variants.

This extension is powered by [opencc-js](https://github.com/nk2028/opencc-js),
which is a JavaScript API wrapper around the great [OpenCC](https://github.com/BYVoid/OpenCC) project.

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

See [usage](#usage) for more ways to convert text.

## Usage

Specify the language settings in the extension popup.

<table><tr><td>
  <strong>Origin</strong> → <strong>Target</strong>
</td></tr></table>

- **Origin**: the original Chinese text variant in the webpage
- **Target**: the desired Chinese text variant to be converted into

<p align="center">
  <img src="./select.gif" width="40%" />
  <img src="./textbox.gif" width="30%" />
</p>

<p align="center">
  <sub><strong>Left:</strong> Convert Text Selection on Webpage</sub>
  <br>
  <sub><strong>Right:</strong> Convert Any Text in Text Box</sub>
</p>

<p align="center">
  <img src="./demo.gif" width="40%" />
  <img src="./auto.gif" width="40%" />
</p>

<p align="center">
  <sub><strong>Left:</strong> One Click</sub>
  <br>
  <sub><strong>Right:</strong> Auto Mode</sub>
</p>

> [!NOTE]
> For performance reason, auto mode will not convert text on webpages which
> explicitly specify their `lang` attributes to be languages other than `zh` in their HTML documents.

When auto mode is enabled, a grey badge with the letter `A` appears on the corner of the extension icon.

All text in the webpage of the current active tab is converted whenever it loads or is updated.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 8+

### Setup

```bash
# Clone the repository
git clone https://github.com/cf5146/opencc-extension.git
cd opencc-extension

# Install dependencies
pnpm install
```

### Building

```bash
# Development build with watch mode
pnpm build:watch

# Production builds
pnpm dist:chrome    # Chrome Web Store package
pnpm dist:firefox   # Firefox Add-ons package
pnpm dist           # All platforms
```

### Testing Locally

```bash
# Chrome/Chromium
pnpm start:chromium

# Firefox
pnpm start:firefox
```

### CI/CD Pipeline

This project uses GitHub Actions for automated testing, building, and deployment:

- **🔍 Code Quality**: ESLint, Prettier, security audits
- **🚀 Multi-Browser Builds**: Chrome, Firefox, Edge extensions
- **📦 Automated Releases**: Version management and GitHub releases
- **🏪 Store Submission**: Firefox Add-ons and Chrome Web Store
- **🔄 Dependency Updates**: Weekly automated dependency maintenance

The workflows automatically:

- Run tests on every PR and push
- Build preview versions for pull requests
- Create release packages when a new version is tagged
- Submit to browser extension stores (with proper API credentials)

See [`.github/WORKFLOWS.md`](.github/WORKFLOWS.md) for detailed workflow documentation.

## Credits

- https://github.com/BYVoid/OpenCC
- https://github.com/nk2028/opencc-js

---

<p align="center">
  <sub><strong>~ crafted with ♥︎ by tnychn ~</strong></sub>
  <br>
  <sub><strong>MIT © 2024 Tony Chan</strong></sub>
</p>
