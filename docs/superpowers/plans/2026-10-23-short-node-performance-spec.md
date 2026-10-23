# Short-node performance specification

Confirmed by user Q1-Q13 on 2026-10-23.

- Improve initial and dynamically inserted short DOM text nodes in mmseg and Jieba.
- Preserve exact per-node output, DOM/selection boundaries, cancellation, settings/route invalidation and stale-result protection. No text concatenation or engine downgrade.
- Diagnose actual costs before changing the responsible integration layer. Native/WASM interface changes require separate discussion; official engine/resources remain unchanged in this plan.
- Page-local in-memory LRU only: maximum 2048 entries and 524288 accounted UTF16 bytes for cache keys plus output values; either bound evicts least recently used entries. Key includes full conversion configuration and original text. Page destruction releases cache; controller disposal explicitly clears it. No cross-tab or persistent cache.
- Edge: five alternating baseline/candidate trials for manual warm 20000 nodes and automatic dynamic 1000 distinct roots, unique/repeated inputs, both engines. Every cell must reduce median completion time by at least 50%.
- Median of per-trial maximum page timer drift may increase by no more than 10 ms. Also inspect real Edge operation, cancellation and stale writes. Timer drift is a proxy, not an input-latency guarantee.
- Firefox build and automated checks only; Firefox runtime unverified because unavailable locally.
- Deliver implementation, reproducible benchmark and before/after evidence. No browser-store publication.
