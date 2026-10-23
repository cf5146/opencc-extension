# Short-node Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halve short-node conversion completion time without changing per-node output or worsening page responsiveness beyond the agreed limit.
**Architecture:** Profile the existing DOM-to-worker route, then optimize only measured fixed costs. Keep bounded, page-local result reuse in the document converter and aggregate eligible automatic roots without joining node strings. Retain all validation and cancellation checks.
**Tech Stack:** TypeScript, WXT, Vitest/jsdom, unchanged official OpenCC WASM, installed Playwright CLI and Edge.
**Spec:** docs/superpowers/plans/2026-10-23-short-node-performance-spec.md

## Global Constraints

- Exact agreed limits: 2048 entries, 524288 accounted UTF16 bytes; five alternating trials; at least 50% lower completion median in every workload/mode cell; timer drift median <= baseline + 10 ms.
- No cross-node text concatenation, cross-tab cache, persistent cache, engine downgrade, native interface edits or resource changes.
- Base fd37dac3925092c403ac1f6695a157ec8ec01217; original checkout package changes and existing untracked assessment are outside scope.
- Execute inline; the user has already approved implementation. Do not request a second planning approval.

## Review Focus

- A cached hit still checks current parent, text, exclusion status, generation and route before committing.
- A failed/malformed batch does not populate cache or overwrite originals; a canceled selection remains atomic.
- Mode/preset cache separation and LRU entry/byte eviction hold for unchanged outputs and oversized strings.
- Automatic sibling/overlapping roots are coalesced without dropping changes inserted during an in-flight batch.
- Offscreen teardown/failure recovers; initialization optimization must not permanently retain failed promises.

### Task 1: Diagnose and reproduce fixed costs

**Files:** lab-only short-node-profile probes and report; tests/official-integration.test.ts, tests/official-page.test.ts, new focused cache/engine tests as needed.
**Interfaces:** retain ConvertBatch(texts: string[], options: ConversionOptions): Promise<string[]>; capture counts and durations at actual route boundaries.

- [ ] Capture profile of current routing, batching and DOM work before production edits; distinguish measured from inferred causes.
- [ ] Add and run failing behavioral tests for the confirmed fixes and cache constraints; document expected failures.

### Task 2: Minimal integration fixes and page-local cache

**Files:** src/application/official/document-converter.ts, page-controller.ts, engine.ts and background.ts only where profile justifies; new bounded cache helper if needed; corresponding tests.
**Interfaces:** existing page/controller and engine contracts remain; an internal multi-root conversion entry may accept Iterable<Node> while preserving per-node inputs and shared cancellation.

- [ ] Implement minimal profiled routing/batching changes and bounded page-local LRU, each after its failing test.
- [ ] Keep output validation, selection atomicity, current-node validation and cancellation checks; clear cache on disposal.
- [ ] Run focused tests, then full tests, lint and typecheck. Commit coherent passing change.

### Task 3: Reproducible acceptance and final review

**Files:** scripts/performance-short-nodes/*; docs/short-node-performance.md and compact raw evidence directory.
**Interfaces:** explicit baseline/candidate build paths, actual source SHA and file hashes; serial alternating five-trial runs; complete-output hash and completion assertions.

- [ ] Clean-build baseline and candidate; run full agreed Edge matrix serially, report median/range, gate every cell and timer drift.
- [ ] If a gate fails, diagnose the cell before another targeted change; never weaken thresholds or silently omit cells.
- [ ] Run npm run ci, artifact verification and an actual Edge operation/cancellation check; mark Firefox runtime unverified.
- [ ] Obtain one fresh whole-diff review, fix material findings with regression proof, then deliver changes and report.
