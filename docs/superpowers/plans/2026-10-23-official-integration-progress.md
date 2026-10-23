# Ledger: 2026-10-23-official-integration.md

Approved decisions carried forward; no repeat design interview. Existing attached isolated worktree reused. User package.json/package-lock.json changes in primary checkout were not touched.

Task1 complete: worker lifecycle test RED→GREEN; source-locked assets staged. One config at a time, serialized jobs, terminate on change/error/60s idle. Late events from an old failed Worker cannot reset a new one (regression RED→GREEN). Actual Chromium offscreen path passed all ten configs.
Task2 complete: version2 exact-host settings and default s2twp/Jieba; async DOM snapshots, cancellation, original-preserving failures and atomic multi-batch selection. New tests watched fail before implementation.
Task3 complete: new popup/options/content/background entrypoints wired; IME and preview revisions; site-specific settings, visible failure/reload state. Real Edge strict CSP, editable/code skips, title/page/selection identity, dynamic insertions, exact-host isolation, disable and complete1m input passed.
Task4 complete: source/build output hashes, fixed native parity CI job, explicit manual staging, original dependency notices, updated documentation; all final gates below passed.

Independent final review: two P2 findings, both reproduced RED and fixed GREEN:
1. Queued selection captured too late. Capture exact range/text/node identity synchronously at message receipt and invocation; later selection/text changes cancel the request.
2. Removing a site override left stale popup config. Render effective returned settings at the latest write revision; invalidate and recompute preview.
No deferred minor findings from review.

Final verification:
- lint and typecheck passed.
- full suite215 passed across23 files; one pre-existing empty legacy placeholder suite skipped.
- Chrome, Firefox, Edge final builds, manifests and all32 engine/resource hashes passed.
- Bundled native oracle779/779 plus40 complete100k/1m cases passed.
- Final actual Edge offline background/offscreen oracle779/779 passed across all10 configs.
- Final actual popup override deletion and Jieba/mmseg toggling passed, no horizontal overflow.
- Invalid requests/NUL rejected, same-mode recovery passed; injected content script could not mutate settings.
- ZIPs created and source Worker/offscreen/notice files match all3 build outputs.

Ruling: use central offscreen Worker on Chromium and background-page Worker on Firefox — avoids page CSP and bounds config caches — switching configs pays initialization cost; Chrome/Firefox real runtime not exercised locally.
Ruling: retain legacy modules/tests as regression references, with production entrypoints fully replaced — permits comparison without packaging the old engine — repository cleanup remains possible after stabilization.
Ruling: old global/regex auto rules retained in storage but inactive; no guessed mapping — prevents unintended automatic conversions — users must re-enable exact hosts.
Ruling: keep conservative reload after attempted config use — avoids applying different transforms to partially processed DOM — a no-op/failed attempt can still require reload on config change.
Ruling: finite same-host/local-source proofs do not imply universal quality or cross-host binary identity — broader runtime/quality behavior remains unproven.
Ruling: add -text Git attributes for reviewed artifacts and build/fixture sources — core.autocrlf=true would otherwise alter source/model bytes at checkout — these paths retain their reviewed line endings.
Ruling: retain uncommitted reviewable work in attached worktree; no push/merge/publish requested.
