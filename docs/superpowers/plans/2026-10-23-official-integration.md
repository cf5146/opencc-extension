# Official OpenCC integration implementation plan
> Execute inline with executing-plans. Continue authorization follows the approved grilling decisions and phase-1 evidence.

Goal: ship a reviewable local build using official OpenCC1.4.2 with default s2twp/Jieba, manual mmseg, five presets, popup/page/selection/dynamic exact-host auto, offline resources.
Architecture: background routes validated text requests to a serialized single-config Worker; Chromium uses an offscreen document, Firefox its background page. Async DOM service uses per-node snapshots and cancellation. Versioned settings disable inherited global/regex auto behavior while retaining old storage keys. Existing legacy modules remain regression references until replacement gates pass; no new feature uses the legacy engine.
Spec: scripts/opencc-feasibility/SPEC.md plus user-approved product decisions in this conversation.
Constraints: no fallback, no cross-node segmentation, no text persistence, complete node inputs, errors leave pending originals, bounded worker lifetime. No publish/push.
Review focus: settings/DOM/selection changing during await; node removal; conversion errors; offscreen initialization races; migration and exact-host matching.

- [x] Task1 engine assets + serialized worker transport. RED request validation/lifecycle; implement source-locked staging, host, offscreen, background routing; GREEN unit tests and packaged offline runtime probe.
- [x] Task2 versioned settings + async DOM conversion. RED settings migration/exact-host tests and deferred conversion races, selection element identity; implement service/store; GREEN tests.
- [x] Task3 product wiring + status + dynamic queue. RED explicit config popup/status and settings cancellation; wire entrypoints, popup/options/content auto. GREEN integration tests and real Edge popup/page/selection/dynamic checks.
- [x] Task4 pipeline/docs/licensing + final review. Verify asset lock in normal builds and CI (no downloads), retain fixed-source rebuild command. Run lint/typecheck/tests and Chrome/Firefox/Edge builds. Independent final review, material fixes, final local artifact proof.
