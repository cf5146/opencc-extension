# opencc-extension

An independently maintained browser extension built around official [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC) **1.4.2**, with the official Jieba plugin compiled into WebAssembly.

Maintained by [cf5146](https://github.com/cf5146) at [cf5146/opencc-extension](https://github.com/cf5146/opencc-extension), based on the original extension by [Tony Chan](https://github.com/tnychn/opencc-extension). The extension project and the BYVoid/OpenCC engine are separate upstreams.

## Maintenance and distribution

- [GitHub releases and build artifacts](https://github.com/cf5146/opencc-extension/releases)
- [Bug reports and feature requests](https://github.com/cf5146/opencc-extension/issues)
- [Private vulnerability reports](https://github.com/cf5146/opencc-extension/security/advisories/new)

Firefox uses the new add-on ID `opencc-extension@cf5146`. It has **not been submitted to AMO or signed**. This is a separate add-on identity from the original author's extension; existing installations and settings do not automatically migrate across IDs. The ID is selected locally and its availability is checked by AMO on first submission/signing.

No verified Chrome Web Store, Edge Add-ons or AMO listing for this independently maintained version is linked here. GitHub ZIP artifacts are not a claim of store publication or Firefox signing. Edge has been exercised end to end; Chrome and Firefox have separate build checks.

See [maintainer and release identity](docs/maintainer-and-release-identity.md) for ownership, attribution and the remaining store setup.

## Conversion

Choose an official preset and segmentation mode:

| Preset | Direction                                   |
| ------ | ------------------------------------------- |
| s2t    | Simplified to Traditional                   |
| s2tw   | Simplified to Taiwan standard               |
| s2twp  | Simplified to Taiwan vocabulary (default)   |
| s2hk   | Simplified to Hong Kong standard            |
| tw2sp  | Taiwan Traditional to Simplified vocabulary |

Jieba is the default. mmseg is a manual alternative. Errors never switch modes automatically.

- Popup text preview, copy and clear; original text stays intact.
- Convert the active HTTP/HTTPS page, or use the context menu to convert a selection.
- Optional dynamic auto-conversion for each exact hostname, with its own preset/mode. Subdomains are separate.
- Script/style, code/pre, editable controls and translate=no regions are skipped.
- Conversion operates independently on each Text node. DOM boundaries do not constitute linguistic segmentation, and Jieba cannot recover context split across nodes.
- Selection updates existing Text nodes and retains elements and event handlers.

A settings change on an already processed page requires reloading before applying a different conversion. Pending results are discarded when settings, text, selection, or the URL becomes stale. On failure, pending originals remain intact; earlier completed page batches stay converted.

The new officialOpenCC version-2 storage key is separate from the previous settings. Legacy global auto-conversion, free locale pairs and regex exclusions are not applied. Their stored data is retained for review/rollback; enable sites again explicitly.

## Offline execution and privacy

Engine, dictionaries and models are bundled. Conversion never fetches a model/CDN or sends text to a server. Popup text is not persisted.

Conversions run in a serialized Worker, with one active configuration. Chromium uses an offscreen document; Firefox uses its background page. A configuration change, worker failure, or 60 seconds idle terminates the worker to reclaim WASM memory. Chromium requires runtime.getContexts (Chrome/Edge116+); Edge155.0.4283.62 was tested locally.

Jieba's first initialization can take a few seconds. One default converter used roughly111MiB of WASM linear memory in phase1; process overhead and transient copies are additional. Large inputs can grow that memory until the Worker is terminated. Text is passed whole, with explicit UTF-8 lengths: node batching does not split the text within a node. Embedded NUL and malformed UTF-16 are explicitly rejected because upstream cannot safely preserve them.

## Build and load

Use the Node versions declared in package.json.

```powershell
npm ci --ignore-scripts
node_modules/.bin/wxt prepare
npm run build:edge
# Also available: build:chrome, build:firefox
```

Load .output/edge-mv3 as an unpacked extension from edge://extensions. Chrome uses .output/chrome-mv3; Firefox uses .output/firefox-mv3 through about:debugging.

Normal builds verify the committed source-built engine/data hashes before packaging. They do not download newer OpenCC data. The offscreen permission on Chromium supports the bundled Worker. Extension CSP permits local WebAssembly compilation.

## Fixed-source update and verification

The reviewed artifact identity is scripts/opencc-feasibility/artifact-lock.json. Official source commit: 025f371dc76b598d77384fbdab90c937471844d8. Toolchain: Emscripten4.0.22, Python3.13.9, CMake3.31.10 and Ninja1.13.0, isolated in WSL.

1. Follow [source rebuild instructions](scripts/opencc-feasibility/README.md) to rebuild from the pinned source and tools.
2. Run npm run update:official to stage only artifacts that match the reviewed lock. It does not download or update the lock.
3. Run npm run verify:official.
4. For an intentional upstream update, change source/tool pins, rebuild, compare outputs and review the lock diff before accepting it. Rerun all parity, boundary and browser checks.
5. Retain the original OpenCC/dependency/SDK license notices when regenerating the bundle.

The original opencc-js dictionary-flattening generator and synchronous modules remain as legacy regression references. Production entrypoints use src/application/official and never import that engine.

## Tests

```powershell
npm run lint
npm run typecheck
npm test
npm ci --prefix scripts/opencc-feasibility --ignore-scripts
npm run verify:official:parity
npm run ci
npm run package:built
```

The new runtime tests cover exact-host migration, async DOM and settings races, selection across batches, IME/preview revisions, and Worker replacement. Older reference tests remain in the suite. The native gate uses the same pinned OpenCC/Jieba1.4.2, the explicit library-default tofu policy, 779 corpus comparisons and 40 complete100k/1m input comparisons across all ten configurations.

CI builds Chrome/Firefox/Edge and checks each output's engine hashes. A separate Windows job runs the pinned native reference. Configuring those jobs does not imply a remote CI run has occurred.

Local Edge evidence also covers strict page CSP, selection element identity, dynamic additions, exact-host isolation, disabling auto, million-character input and all779 reference comparisons offline. Finite tests are not a universal parity or quality guarantee.

## License and credits

Application: [MIT](LICENSE.txt), retaining the original copyright notice for Tony Chan. Independently maintained by cf5146; the original author is credited in package contributors and Git history. Official OpenCC and bundled components: [third-party notices](public/opencc/THIRD_PARTY_NOTICES.md).
