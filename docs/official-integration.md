# Official integration evidence — 2026-10-23

Phase1 source/tool and full-output evidence: scripts/opencc-feasibility/RESULTS.md (historical, before product wiring).

Product changes: five named configs, default s2twp/Jieba; async background→offscreen→Worker; single-config/idle worker reclamation; original-preserving DOM snapshots and selection; opt-in exact-host version2 settings; explicit hash and native CI gates. Existing legacy source is retained for regression comparison but absent from production entrypoint imports.

Local real Edge155.0.4283.62: popup preview produced 勇敢的士兵在軟體開發中心使用滑鼠。; offscreen context existed; strict-CSP whole-page/title conversion succeeded; code/editable content stayed unchanged; selection preserved a b element and click handler; dynamic insertions converted; subdomains did not inherit a rule; disabling auto left later additions unchanged; one million-character Text node converted completely. All779 native-reference assertions across ten configs also passed over the actual background/offscreen path with network offline.

Product assets were independently compared with native OpenCC/Jieba1.4.2:779/779 corpus and40/40 complete long-input comparisons. Evidence uses explicit includeTofuRiskDictionaries=true. See .output/official-parity.json after running the gate.

Raw browser evidence is stored in the task artifact folder opencc-adoption-lab/product-integration. Browser checks used a dedicated profile and synthetic fixtures, never user page text. Chrome/Firefox runtime behavior has not been manually exercised. No store deployment, push, or remote CI execution is claimed.

Final gates:215 tests passed; one pre-existing empty legacy placeholder suite skipped. lint/typecheck and all three final builds/hash checks passed. Independent review's two P2s (queued selection identity and popup rule-removal state) were reproduced and fixed with regression tests. Final Edge rerun passed all flows and offline779/779 after rebuilding.

Committed evidence snapshots for review: docs/evidence/official-opencc. Final ZIP SHA256 values are recorded there. The Edge ZIP is5,045,279 bytes. Worker/offscreen/notice files in each output match the source. Invalid/NUL inputs, same-mode failure recovery and content-script settings mutation rejection also passed in real Edge.

Reviewed engine/model/fixture/build-source paths have -text Git attributes so Windows core.autocrlf cannot modify their pinned bytes. No merge, commit, publication or remote CI execution was performed.
