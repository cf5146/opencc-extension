# Copilot instructions for `opencc-extension`

## Big picture (what talks to what)
- **Presentation scripts**: `src/background.ts`, `src/content.ts`, `src/popup/*`, `src/options/*`
- **Core API (stable façade)**: `src/core/conversion.ts` + `src/core/whitelist.ts`
- **Application logic**: `src/application/conversion/conversion-service.ts` (caching + DOM traversal)
- **Infrastructure**: `src/infrastructure/conversion/opencc-factory.ts` (converter memoization)
- **OpenCC engine/data**: `src/lib/opencc/*` (Trie-based converter)

## Runtime data flow (follow these files)
1. Popup triggers page convert via `chrome.tabs.sendMessage({ action: 'click' })` (`src/popup/index.ts`).
2. Background handles context menu + MV3 content script registration (`src/background.ts`).
3. Content script loads settings from `chrome.storage.local`, applies whitelist, then runs conversions (`src/content.ts`).
4. Conversion pipeline is: `src/core/conversion.ts` → `ConversionService` → `OpenCCFactory` → `lib/opencc/Converter`.

## MV3 / cross-browser rules that matter here
- Chromium MV3 **dynamically registers** `content.js` via `chrome.scripting.registerContentScripts` with id `opencc-content` (`src/background.ts`).
- Firefox still uses static `content_scripts` (`src/manifest.firefox.json`).
- If you change content script filename/id/matches, update **both**:
  - `ensureContentScriptRegistered()` + unregister logic in `src/background.ts`
  - popup fallback injection (`chrome.scripting.executeScript({ files: ['content.js'] })`) in `src/popup/index.ts`

## Project-specific conventions
- Async message handlers in content script keep the channel alive by returning `true` (`src/content.ts`).
- Auto mode relies on caching to avoid duplicate conversions:
  - `ConversionService` tracks per-Text-node locale pair via `WeakMap<Text, {from,to}>`
  - `convertedOutputs` avoids repeated work in dynamic pages (`src/application/conversion/conversion-service.ts`).
- Auto mode observer resets caches on URL changes and does incremental work + fallback full scan (`src/content/observer.ts`).
- Whitelist is stored as **regex strings** in `chrome.storage.local.whitelist`:
  - Options UI accepts `*` wildcards and translates them to `[^ ]*` (`src/options/index.ts`).
  - Matching/compilation is centralized in `src/core/whitelist.ts`.

## Build / run workflows (use these scripts, not guesses)
- Build (default output `build/`): `npm run build` (esbuild wrapper: `build.mjs`).
- Watch build: `npm run build:watch` (README mentions `npm run dev`, but the script is `build:watch`).
- Run via `web-ext`:
  - `npm run start:chromium`
  - `npm run start:firefox`
- Packaging uses `web-ext build` into zip: `npm run dist:*` (see `package.json`).
- `BROWSER=firefox|chrome|edge` selects manifest template (edge maps to chrome) in `build.mjs`.

## Generated data (don’t hand-edit)
- `src/lib/opencc/raw-data.ts` is auto-generated.
- Regenerate after updating `opencc-js` via: `node scripts/generate-opencc-data.mjs`.

## Tests (how they’re structured)
- Vitest + JSDOM (`vitest.config.mjs`), tests live in `tests/`.
- DOM globals are manually installed in tests (e.g. `tests/conversion-service.test.ts`).
- Background MV3 behavior is tested with a loose `globalThis.chrome` mock + `__opencc_test__` hook exported from `src/background.ts`.
