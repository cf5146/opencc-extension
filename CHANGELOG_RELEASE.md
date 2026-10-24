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
