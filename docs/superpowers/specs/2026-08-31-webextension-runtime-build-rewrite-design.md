# WebExtension Runtime and Build Rewrite

- Status: Approved design
- Date: 2026-08-31
- Repository: `opencc-extension`

## Decision Summary

Adopt WXT as the extension shell and multi-browser build system. Keep the conversion domain, application service, OpenCC infrastructure, and vanilla HTML/TypeScript UI shared and browser-neutral. Put browser APIs behind a small platform adapter and use a typed message protocol between popup, background, and content runtimes.

Build Chrome, Edge, and Firefox from one source tree. Pin every output to Manifest V3. Use a statically declared content script for all three targets and let an auto-conversion controller start or stop the observer from settings. Remove runtime content-script registration and unregister logic. Keep one-shot scripting injection only as a fallback for an already-open tab that did not receive the static content script.

The rewrite may change behavior and permissions where that makes the runtime simpler and safer. It must retain the core conversion capabilities: page conversion, selection conversion, textbox conversion, auto mode, locale whitelist, and persisted settings.

## Context

The repository already separates domain, application, infrastructure, core, and presentation concerns. The conversion service and OpenCC data are not the primary source of runtime complexity. The current complexity is at the browser boundary:

- `build.mjs` owns bundling, browser selection, manifest copying, and post-build version mutation.
- Chrome and Edge dynamically register the content script through `chrome.scripting`.
- Firefox loads the content script statically and uses a different background manifest shape.
- Popup, content, and background code access the global `chrome` API directly.
- Background integration tests construct a loose global API mock.
- Popup recovery, dynamic registration, and storage-driven registration state are coupled together.

The rewrite targets Chrome, Edge, and Firefox as first-class browsers with one shared source tree. Auto-conversion remains a core capability. The extension remains offline-only and must not add remote code, analytics, or page-text persistence.

## Goals

1. Make browser lifecycle and API differences explicit at a small platform boundary.
2. Use one WXT build configuration to produce validated Chrome, Edge, and Firefox MV3 artifacts.
3. Keep auto mode reliable without dynamic registration and unregister branches.
4. Preserve shared conversion logic and vanilla UI rather than introducing a UI framework.
5. Give popup and content runtimes stable, typed success and failure results.
6. Make runtime behavior testable without importing modules that mutate a global browser object at test load time.
7. Keep generated artifacts out of source control and retain predictable CI packaging.

## Non-Goals

- Replacing the OpenCC conversion algorithm or dictionary data.
- Rebuilding the popup or options UI as React, Vue, or another UI framework.
- Adding cloud services, synchronization, telemetry, or remote dictionary loading.
- Supporting Safari in this rewrite.
- Adding new user-facing conversion modes beyond the existing feature set.

## Chosen Architecture

WXT is the build and extension-entrypoint layer only. It does not define the application architecture. Shared modules remain independently usable in unit tests and do not import WXT or browser globals.

The target source layout is:

```text
entrypoints/
  background.ts
  content.ts
  popup/
    index.html
    main.ts
    style.css
  options/
    index.html
    main.ts
    style.css
src/
  application/
    auto/
    conversion/
    settings/
  core/
  domain/
  infrastructure/
  platform/
  runtime/
    messages.ts
```

HTML entrypoints use WXT's one-level directory convention: `entrypoints/popup/index.html` and `entrypoints/options/index.html`, with their local scripts and styles. The ownership boundaries are fixed:

- `entrypoints/background`: service-worker or background-script adapter. It owns context menus, badge state, active-tab routing, and one-shot injection. It does not perform DOM conversion.
- `entrypoints/content`: page runtime. It owns message handling and the auto controller. It calls the shared conversion facade and never registers itself with the browser.
- `entrypoints/popup`: popup event wiring and presentation. It calls platform and runtime interfaces rather than the global browser API directly.
- `entrypoints/options`: whitelist editing and settings presentation.
- `src/platform`: the only module allowed to know WXT's browser API object. It exposes narrow promise-based operations for storage, active tabs, messaging, context menus, badges, and optional scripting injection.
- `src/runtime/messages.ts`: request and response unions for background/content communication.
- `src/application/settings`: defaults, validation, normalization, and storage serialization for origin, target, auto mode, whitelist, and textbox size.
- `src/application/auto`: `AutoConversionController`, which owns observer lifecycle, mutation batching, fallback scans, URL transitions, and reload-required state.
- Existing `src/domain`, `src/core`, `src/application/conversion`, and `src/infrastructure/conversion` modules remain shared and browser-neutral.

## Content Runtime and Auto Mode

The content entrypoint is registered through the generated manifest for every target:

- Matches: `http://*/*` and `https://*/*`.
- Run timing: `document_idle`.
- Frames: top frame only, matching current behavior.
- Registration: manifest/static, never runtime/dynamic.

The content runtime loads settings after the document is available. It remains lightweight when auto mode is off. The controller starts only when all of the following are true:

- `auto` is enabled.
- Origin and target differ.
- The document language is absent or begins with `zh`.
- The URL does not match a whitelist entry.

The controller subscribes to storage changes so toggling auto mode affects an already-open page without re-registering the script. It stops its observer and clears pending timers when auto mode is disabled. Origin, target, and whitelist changes update controller state without triggering an unsafe full-document reinterpretation.

A document remembers the locale pair under which it has already been processed. If the pair changes after conversion has occurred, the controller marks the document as `reload-required` for a fresh full conversion, resets node-level caches, and applies the new pair only to newly inserted nodes. It must never treat already-converted output as if it were original source text. This is required because OpenCC conversion is not generally reversible.

Mutation processing remains incremental. Added text nodes and character-data changes are converted directly; a coalesced fallback scan handles mutations that cannot be attributed safely. The controller serializes or coalesces asynchronous work so observer callbacks cannot produce unhandled promise rejections. URL changes reset conversion state and title handling without requiring a new content-script registration.

## Background Runtime and Message Flow

The background is the only runtime that resolves the active tab and performs one-shot injection.

1. The popup sends `convert-active-tab` to the background.
2. The background obtains the active tab ID and, when available, its URL.
3. It rejects unsupported schemes such as browser-internal pages with a typed `unsupported-scheme` result.
4. It sends `convert-page` to the content runtime.
5. If no content runtime is listening, it performs one-shot scripting injection for the built content entrypoint and retries once.
6. It returns a typed success, no-op, reload-required, or unavailable result to the popup.

Context-menu events use the tab ID delivered by the menu event. The background sends `convert-selection` to that tab and does not re-query the active window. This avoids converting a different tab when focus changes between the menu event and message dispatch.

Textbox conversion remains local to the popup and calls `convertPlainText` directly. Options writes normalized whitelist patterns through the shared settings interface. Badge text is derived from the persisted auto setting by the background storage listener and is not controlled by a second in-memory source of truth.

The message protocol uses discriminated unions. Requests include at least:

- `convert-active-tab`, accepted by the background.
- `convert-page`, accepted by the content runtime.
- `convert-selection`, accepted by the content runtime.

Responses distinguish:

- `success`: changed-node count and elapsed time.
- `no-op`: valid request with no changed nodes.
- `reload-required`: the document was previously converted under another locale pair.
- `unavailable`: stable reason for protected page, unsupported scheme, missing content runtime, denied injection, or unsupported browser capability.
- `invalid-settings` or `internal-failure`: a local configuration or unexpected runtime error.

All message responses are serializable and contain no page text.

## Browser API and Permissions

The platform adapter is the only place that imports or references WXT's browser API. Entry points depend on interfaces so tests can provide fakes without replacing a global object.

The initial permission policy is:

- Keep `storage` for settings.
- Keep `contextMenus` for selection conversion.
- Keep `activeTab` for user-initiated page operations.
- Keep `scripting` for one-shot injection into an already-open tab.
- Keep HTTP and HTTPS host access for static auto-mode content scripts.
- Remove the broad `tabs` permission from every shipped manifest. Active-tab routing uses event-provided IDs or the active-tab grant; URL access is optional and protected-page failures are typed.

Generated manifests must validate this policy per browser. If a browser requires a narrower or additional declaration for a tested capability, the difference belongs in the target-specific manifest function and must have a manifest test and a browser smoke check.

Chrome and Edge use an MV3 service worker. Firefox is explicitly built as MV3 and uses the background declaration supported by its target runtime. The Firefox Gecko extension ID remains unchanged. No target may depend on WXT's default manifest-version selection.

## Build and Packaging

Add `wxt.config.ts` as the sole manifest and build configuration. It defines common metadata, icons, options, popup, static content registration, permissions, host matches, and a target-aware manifest function. Target-specific differences are limited to background declaration, Firefox identity, and any validated browser capability differences.

Use explicit target commands with WXT's browser and MV3 flags. The command names must make the output target obvious:

```text
npm run dev
npm run dev:firefox
npm run build:chrome
npm run build:firefox
npm run build:edge
npm run zip:chrome
npm run zip:firefox
npm run zip:edge
npm run dist
```

Development and production outputs remain separated by browser and mode. CI packaging continues to produce `opencc.chrome.zip`, `opencc.firefox.zip`, and `opencc.edge.zip`. WXT owns package-version insertion; no post-build JSON mutation is retained.

The following old responsibilities are removed after the new output is proven:

- Custom bundling in `build.mjs`.
- Process coordination and file polling in `scripts/dev.mjs`.
- Custom build-and-zip orchestration in `scripts/dist.mjs` and `scripts/dist-all.mjs`.
- Duplicated `src/manifest.*.json` templates.
- Dynamic `registerContentScripts`, unregister, and `ensure-script` message flows.

Generated WXT output is ignored and is never used as source. CI builds each target independently, parses each generated manifest, and packages each target from its own output directory.

## Error Handling and Security Behavior

Unsupported pages and browser API failures are normal product states, not uncaught exceptions. The background maps browser errors to stable reasons and logs diagnostic details without URL query data or page text. The popup renders status with text content and state classes; it does not inject error HTML.

The rewrite retains these security properties:

- No network requests are needed for conversion.
- No user-controlled HTML is inserted into extension pages.
- No page text is persisted in extension storage or sent in background responses.
- No dynamic code evaluation or remote script loading is introduced.
- User-initiated injection is limited to the active tab and is capability-checked.

Observer timers, storage listeners, and message listeners have explicit cleanup paths where their owning runtime can be unloaded or stopped. The content runtime must not leave a running observer when auto mode is disabled.

## Testing and Verification

Retain existing conversion tests for locales, plain text, DOM traversal, selection, whitelist matching, and caching. Extend coverage around the new ownership boundaries:

- Settings tests cover defaults, malformed stored values, normalization, whitelist serialization, and locale-pair transitions.
- Auto-controller tests cover start/stop, storage changes, URL changes, language and whitelist skips, incremental mutations, fallback scheduling, timer cleanup, reload-required state, and contained observer failures.
- Platform tests use fake interfaces rather than a loose global `chrome` object.
- Background tests cover active-tab routing, event-provided context-menu tab IDs, unsupported schemes, one-shot injection and one retry, capability failures, badge synchronization, and typed results.
- Content tests cover typed page and selection requests and ensure auto mode does not start when disabled.
- Generated-manifest tests build or inspect all three targets and assert MV3, background shape, static content registration, popup/options paths, Gecko identity, permission policy, and package version.
- Package tests verify all three zip names and that generated artifacts contain the expected manifest and entrypoint files.

CI runs lint, typecheck, unit/integration tests, and all three target builds. Push builds package all three artifacts. Browser smoke verification covers popup page conversion, selection conversion, textbox conversion, auto conversion on dynamically added content, whitelist behavior, options persistence, auto badge state, protected-page messaging, and Firefox-specific startup.

## Migration Checkpoints

### Checkpoint 1: WXT output baseline

Add WXT configuration and entrypoint scaffolding. Produce valid Chrome, Edge, and Firefox MV3 outputs with the existing metadata and UI assets. Keep the current runtime available until target builds and manifest assertions pass.

### Checkpoint 2: Platform and message boundaries

Introduce the platform interfaces, settings module, and typed message unions. Move browser calls behind those interfaces. Replace loose background mocks with fakes and preserve conversion behavior while the current build remains the rollback baseline. Do not ship an artifact that contains both the old and new registration paths.

### Checkpoint 3: Static content runtime

Move content behavior to the WXT content entrypoint. Add `AutoConversionController`, storage-driven lifecycle, background-owned active-tab routing, stale-tab injection fallback, and reload-required locale-pair handling. Run focused unit and integration tests after each runtime transition.

### Checkpoint 4: Remove obsolete paths

Delete dynamic registration and retry plumbing, old manifest templates, custom build scripts, and generated-output assumptions. Update package scripts, CI, README, `PRIVACY.md`, development instructions, and `MV3_NOTES.md` to reflect the actual target and permission model. Run the full verification suite and browser smoke checklist.

## Acceptance Criteria

The rewrite is complete when all of the following are true:

1. Chrome, Edge, and Firefox are built from one shared source tree with explicit MV3 target configuration.
2. Auto mode works on dynamically changing HTTP and HTTPS pages without runtime content-script registration.
3. Popup page conversion, context-menu selection conversion, textbox conversion, whitelist behavior, options persistence, and badge state work on all supported targets.
4. Already-open tabs receive a single injection fallback or a stable unavailable result; no unbounded retry loop exists.
5. Locale-pair changes cannot silently double-convert an already-processed document.
6. Browser globals are confined to the platform adapter; entrypoints use platform interfaces.
7. Generated manifests and packages pass automated assertions for all three targets.
8. The full CI command and target-specific build/package commands pass.
9. README and MV3 documentation describe the new commands, static registration model, target support, and permission policy.
10. No generated build output or browser-specific source duplication is required to maintain the extension.

## Risks and Mitigations

- WXT may expose target-specific limitations around Firefox MV3 background declarations or one-shot entrypoint injection. Check these capabilities at Checkpoint 1 before moving application behavior; do not hide a failed target behind a successful Chromium build.
- Static content scripts run on pages even when auto mode is off. Keep startup work limited to settings load and message registration, and measure the content bundle during the build baseline.
- Removing `tabs` makes some URL details unavailable on protected pages. Treat missing URL data as an unavailable result and verify active-tab operations in each browser with the reduced permission set.
- A locale-pair change cannot safely restore arbitrary converted text. Make reload-required state explicit in the response contract and user-visible status rather than attempting heuristic reversal.
