# Auto-conversion performance and correctness

Evaluated October 17, 2026 against the current checkout. This is a synthetic local browser evaluation, not a claim about every website or a comparison against an independently installed older release.

## Confirmed failures and changes

- Manual conversion previously returned no-op once a page was marked processed, ignoring content loaded later. Explicit requests now scan for new or changed text; unchanged nodes are skipped.
- Node metadata previously remembered only the language pair. It now also checks the current text, so websites can replace text inside an existing node and receive conversion again.
- Unrelated zero-change mutation batches previously scheduled whole-body scans. Auto mode now queues inserted roots or changed text nodes and never schedules a fallback scan for empty/removal-only records.
- Repeated recursive tracking checks were removed. Pending roots are deduplicated using ancestor checks, and traversal resumes with one TreeWalker rather than collecting a page-sized text list.
- Queue tasks yield after 200 DOM visits or an 8ms cooperative time budget. Native MessageChannel tasks avoid nested timer clamping; environments without it use timers. Pending work is canceled on disable, navigation, failures, locale changes, and disposal. Reenabling checks text added while disabled.
- Conversion failures and direction changes pause conversion until reload. The observer is disconnected rather than repeatedly retrying future mutations.
- Output caches retain at most 512 strings and 65,536 UTF-16 characters per language pair. Strings over 4,096 characters are excluded. Live node metadata uses a WeakMap.

## Browser measurements

Headless Microsoft Edge on this machine, using actual application modules bundled in memory. The page contained 20,000 short Chinese paragraphs; dictionary initialization was measured separately before measuring queue tasks. Task instrumentation wrapped the default MessageChannel callbacks.

| Scenario                                              | Before                                                 | After                                                         |
| ----------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| 24 empty-element insert/remove pairs over about 2.75s | 8 full-body scans; about 26ms spent inside those scans | 0 full-body scans; 0 text nodes revisited; 0 conversion tasks |
| Manual conversion, append content, convert again      | New text unchanged                                     | New text converted; unchanged repeat returns no-op            |
| Auto mode, append a new element                       | Converted                                              | Converted                                                     |
| Auto mode, replace existing text-node data            | New text unchanged                                     | New text converted                                            |

Latest illustrative warm queue run: 201 tasks, 4.9ms maximum task duration, 0.3ms p95, 352.7ms elapsed for the queued 20,000-node page. Cold dictionary initialization was 60.3ms in that run. Timings vary with load and hardware and are not acceptance thresholds.

The prior synchronous cold scan of 50,000 short text nodes took about 178ms in one probe. This is a different workload and must not be used to infer an end-to-end speedup for the new queue; the queue prioritizes responsiveness.

## Verification

- npm run ci passed: lint, TypeScript, 148 tests, and Chrome/Firefox/Edge MV3 builds plus generated-artifact checks. One existing test suite is skipped by the repository's test configuration/conditions.
- Regression tests cover queue time/node budgets, nested roots, detached traversal nodes, cancellation, route changes, reload guards, malformed exclusions, settings concurrency, original/result text, IME composition, persistence retries, and sender verification.
- The unpacked Chrome build was loaded in a fresh Edge profile. Its options page successfully wrote settings from an extension tab. A routed UTF-8 HTTP test page verified initial auto conversion, appended content, text replacement inside an existing node, manual load-more conversion, and unchanged no-op results.
- Popup and options were rendered in light/dark themes. The popup was checked at 400 by 600 pixels with persistent action/status controls and scrolling content. Firefox was built and artifact-verified; its live runtime was not exercised here.
- Independent code review found the reload guard gap and it was corrected with regression tests. Final review reported no remaining important findings.

## Remaining limits

The task budget is cooperative: one very large text-node conversion or cold dictionary construction can exceed 8ms. Manual page conversion remains a synchronous explicit action. Embedded dictionary bundles remain roughly 1.5MB, so this change does not eliminate their per-context parsing or memory cost. No performance telemetry or page text is persisted by the extension.

Reproduce deterministic correctness and work-bound checks with npm test -- tests/auto-conversion-controller.test.ts tests/conversion-queue.test.ts tests/conversion-service.test.ts tests/content-runtime.test.ts. Machine-specific browser probe scripts and screenshots from this run are in the ignored .output directory.
