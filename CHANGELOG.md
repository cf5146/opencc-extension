# Changelog

## v0.6.1 - 2026-10-23

[Compare changes](https://github.com/cf5146/opencc-extension/compare/v0.6.0...v0.6.1)

### Candidate status

Prepared for review and testing; this preparation does not publish a release, create a tag, sign Firefox packages or submit to a browser store. Edge has recorded runtime evidence; Chrome and Firefox currently have build checks only. Firefox runtime acceptance remains open.

### Features

- Adopt official BYVoid/OpenCC 1.4.2 with bundled offline dictionaries and the official Jieba plugin compiled to WebAssembly. Jieba is the default; mmseg remains an explicit alternative.
- Offer five official presets: s2t, s2tw, s2twp (default), s2hk and tw2sp, in popup previews, page conversion and selection conversion.
- Run conversion in a serialized Worker, using Chromium offscreen documents or the Firefox background page. Models and page text stay local.

### Performance and reliability

- Batch short Text-node requests, group pending automatic roots and reuse exact strings in a bounded page-local cache. Each Text node remains an independent input; there is no cross-tab cache.
- In the recorded Edge benchmark, warm 20,000-node completion medians improved by 75.1–91.6%, and automatic 1,000-root completion medians by 96.6–98.5%, against the pre-optimization official-engine baseline. These are workload-specific results, not cold-start or cross-browser guarantees. See [methods and evidence](https://github.com/cf5146/opencc-extension/blob/a8cb280573399372b698493a4bcfcac4d0f25a26/docs/short-node-performance.md).
- Reject stale conversion results after text, selection, URL or settings changes; preserve selection elements/handlers, protect IME input, and recover popup previews after asynchronous failures.

### Upgrade and compatibility

- This fork is independently maintained by cf5146 and retains Tony Chan's original authorship and license notices. Existing store installations do not automatically move to this fork.
- Settings use the separate officialOpenCC version-2 storage key. Legacy settings are retained but not applied: re-enable automatic conversion for each exact hostname and choose a preset/mode explicitly. Subdomains do not inherit rules; legacy arbitrary locale pairs and regex exclusions are not migrated.
- After converting a page, reload it before applying a different configuration. Excluded script/style, code/pre, editable and translate=no content stays unchanged. Linguistic context does not cross DOM Text-node boundaries.
- Chrome/Edge require runtime.getContexts (116+). Firefox uses the new ID opencc-extension@cf5146; AMO has not confirmed the ID, and no signed XPI or verified store listing is provided.

### Dependency security and development

- Remove the optional web-ext launcher and its unpatched node-forge dependency chain, together with the affected fast-uri tooling dependency. Both npm lockfiles reported zero known advisories during preparation; this is a dated advisory snapshot.
- Development commands still compile/watch, but no longer launch a browser automatically. Manually load the output directory printed by WXT and reload the extension/page after edits. See [dependency assessment](https://github.com/cf5146/opencc-extension/blob/a8cb280573399372b698493a4bcfcac4d0f25a26/docs/dependency-risk-assessment.md).

### Known limits

- Firefox runtime behavior and store signing remain unverified; a generated Firefox ZIP is not an installable signed release for ordinary Firefox installations.
- Jieba initialization can take seconds. One measured default converter used roughly 111 MiB of WASM linear memory, excluding process overhead and transient copies; large inputs can grow it until Worker termination.
- Two cold-start benchmark cells were approximately 8% slower after the short-node optimization. Very large root sets beyond the measured workloads remain unmeasured.
- Embedded NUL and malformed UTF-16 inputs are rejected. On page conversion failure, completed batches remain converted while pending originals stay intact.

## v0.6.0 - 2026-10-18
[Compare changes](https://github.com/cf5146/opencc-extension/compare/v0.5.11...v0.6.0)


### Chores
- bump @types/node from 26.6.4 to 26.6.5
- bump jsdom from 30.1.0 to 30.1.2
- bump @typescript-eslint/eslint-plugin from 8.71.1 to 8.71.2
- bump globals from 17.12.0 to 17.13.0
- bump shell-quote
- bump @typescript-eslint/eslint-plugin from 8.70.0 to 8.71.1
- bump prettier from 3.9.9 to 3.9.10
- bump @wxt-dev/browser from 0.3.4 to 0.3.5
- bump source-map-js
- bump @wxt-dev/browser from 0.2.9 to 0.3.4
- bump eslint from 10.9.1 to 10.12.0
- bump @types/node from 26.6.3 to 26.6.4
- bump brace-expansion in the npm_and_yarn group across 1 directory
- bump prettier from 3.9.8 to 3.9.9
- bump @types/node from 26.5.1 to 26.6.3
- bump web-ext from 10.6.0 to 10.7.0
- bump prettier from 3.9.6 to 3.9.8
- bump @typescript-eslint/eslint-plugin from 8.69.0 to 8.70.0
- bump jsdom from 30.0.1 to 30.1.0
- bump adm-zip in the npm_and_yarn group across 1 directory
- bump @wxt-dev/browser from 0.2.8 to 0.2.9
- bump @types/node from 26.4.1 to 26.5.1
- bump @typescript-eslint/parser from 8.69.0 to 8.70.0
- bump jsdom from 27.4.0 to 30.0.1
- bump @wxt-dev/browser from 0.2.7 to 0.2.8
- bump @types/node from 26.4.0 to 26.4.1
- bump globals from 17.11.0 to 17.12.0
- bump @eslint/js from 9.39.4 to 10.0.1
- bump prettier from 3.7.4 to 3.9.6
- bump globals from 16.5.0 to 17.11.0
- bump @types/node from 24.10.4 to 26.4.0
- bump @humanfs/node in the npm_and_yarn group across 1 directory

### Features
- improve conversion and redesign UI and release workflows

### Fixes
- repair dependency upgrade compatibility
- restore popup layout and inline Traditional Chinese settings
- resolve SonarQube security and reliability gate failures

### Other
- Fix githubactions:S7637 Use full commit SHA hash for this dependency. External GitHub Actions and workflows should be pinned to a commit hash githubactions:S7637
- [chore] Modify workflow and bump node-version to 24

## v0.5.11 - 2026-09-01
[Compare changes](github:tnychn/opencc-extension/compare/v0.5.10...v0.5.11)


### Build
- adopt WXT for MV3 targets

### Chores
- bump the npm_and_yarn group across 1 directory with 2 updates
- bump eslint from 9.39.4 to 10.9.1
- bump the npm_and_yarn group across 1 directory with 5 updates
- bump jsdom from 27.4.0 to 30.0.1
- bump esbuild from 0.27.2 to 0.28.2
- bump vitest from 4.0.16 to 4.1.11
- bump @typescript-eslint/eslint-plugin from 8.51.0 to 8.68.0

### Documentation
- add runtime rewrite plan

### Other
- Revert "chore: bump jsdom from 27.4.0 to 30.0.1"

### Refactoring
- update GitHub Actions workflow to use latest actions and improve credential handling
- enhance error handling and serialization in errorMessage functions
- improve browser-specific output directory handling in build verification script
- update HTML status element to use <output> and improve null checks in conversion service
- update HTML title and format repository link; ensure consistent file endings
- complete WXT runtime migration
- move extension UI behind ports
- use static content runtime
- route tab operations through background
- isolate WebExtension platform APIs
- extract auto conversion controller
- add runtime contracts
