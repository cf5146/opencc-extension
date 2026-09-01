# Copilot instructions for `opencc-extension`

## Big picture (what talks to what)

- **WXT entrypoints**: `entrypoints/background.ts`, `entrypoints/content.ts`, `entrypoints/popup/*`, `entrypoints/options/*`
- **Core API (stable façade)**: `src/core/conversion.ts` + `src/core/whitelist.ts`
- **Application logic**: `src/application/conversion/conversion-service.ts` (caching + DOM traversal)
- **Infrastructure**: `src/infrastructure/conversion/opencc-factory.ts` (converter memoization)
- **OpenCC engine/data**: `src/lib/opencc/*` (Trie-based converter)
- **Browser API boundary**: `src/platform/browser-platform.ts`; application code uses `src/platform/types.ts` ports

## Runtime data flow (follow these files)

1. Popup asks the background runtime to convert the active tab through the runtime port (`entrypoints/popup/main.ts`).
2. Background runtime handles context-menu dispatch, badge state, active-tab conversion, and one-shot fallback injection (`entrypoints/background.ts` and `src/application/runtime/background-runtime.ts`).
3. The statically declared content script loads settings through the settings store and runs conversions (`entrypoints/content.ts`).
4. Conversion pipeline is: `src/core/conversion.ts` → `ConversionService` → `OpenCCFactory` → `lib/opencc/Converter`.

## MV3 / cross-browser rules that matter here

- WXT statically declares the top-frame content script for HTTP and HTTPS pages in every MV3 target.
- Auto mode controls the observer inside the content runtime; it does not register or unregister scripts.
- If you change the content script entrypoint or matches, update `entrypoints/content.ts`, the platform manifest-path lookup, and the artifact verifier.
- When static injection was missed, the background runtime performs one manifest-declared injection and one message retry.

## Project-specific conventions

- Runtime ports normalize browser API errors into `PlatformError` values.
- Auto mode relies on caching to avoid duplicate conversions:
  - `ConversionService` tracks per-Text-node locale pair via `WeakMap<Text, {from,to}>`
  - `convertedOutputs` avoids repeated work in dynamic pages (`src/application/conversion/conversion-service.ts`).
- Auto mode observer resets caches on URL changes and does incremental work + fallback full scan (`src/application/auto/auto-conversion-controller.ts`).
- Whitelist is stored as **regex strings** through the storage port:
  - Options UI accepts `*` wildcards and translates them to `[^ ]*` (`src/application/ui/options-controller.ts`).
  - Matching/compilation is centralized in `src/core/whitelist.ts`.

## Build / run workflows (use these scripts, not guesses)

- Watch Chrome, Firefox, or Edge with `npm run dev`, `npm run dev:firefox`, or `npm run dev:edge`.
- Build explicit MV3 targets with `npm run build:chrome`, `npm run build:firefox`, and `npm run build:edge`.
- Generated output lives in `.output/<browser>-mv3/`; verify each target with `node scripts/verify-build-output.mjs <browser>`.
- Package all targets with `npm run dist`, producing `opencc.chrome.zip`, `opencc.firefox.zip`, and `opencc.edge.zip`.

## Generated data (don’t hand-edit)

- `src/lib/opencc/raw-data.ts` is auto-generated.
- Regenerate after updating `opencc-js` via: `node scripts/generate-opencc-data.mjs`.

## Tests (how they’re structured)

- Vitest + JSDOM (`vitest.config.mjs`), tests live in `tests/`.
- DOM globals are manually installed in tests (e.g. `tests/conversion-service.test.ts`).
- Background MV3 behavior is tested through `src/application/runtime/background-runtime.ts` and platform fakes; browser API calls stay behind the platform boundary.
