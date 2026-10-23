# SDD ledger — plan: official-build/PLAN.md

Spec: SPEC.md; user confirmed shared understanding and authorized phase 1.
Pre-flight: build artifacts feed runtime, which feeds native/Edge parity; no conflicting interfaces.
Ruling: WSL-native project cache instead of Windows-mounted tool directory — Python extraction failed with I/O error on the mounted path and succeeded on ext4 — paths are environment-specific, build identity remains explicit.
Ruling: static registration adapter instead of native dlopen — WASM build will use unchanged official JiebaSegmentation.cpp behind the existing plugin-factory interface — parity tests must establish that this adaptation preserves observed results.
Task 1: complete — source-pinned native and WASM builds succeeded; original missing-artifact test failed before implementation.
Ruling: reject embedded NUL and malformed UTF-16 — official Segments.hpp uses strlen and truncates NUL despite length-aware input; unchanged upstream and no splitting are required — callers must preserve original text on this explicit error.
Ruling: canonical Git config bytes — Windows autocrlf changed configuration hashes although semantics matched — Git blob reads avoid OS-dependent resource identity.
Task 2: complete — acceptance 2/2; Node 779/779 parity; 40/40 complete long-output comparisons; manifest contains all 29 resources and 3 runtime artifacts.
Task 3: evidence complete — Edge 779/779 parity; 40/40 complete long-output hashes and byte counts matched; six fresh-Worker offline starts; fresh compilation in new directories reproduced all 32 artifact/resource hashes.
Ruling: evaluation retains all requested handles for broad parity testing — memory grows to approximately 571 MiB after ten configs and long inputs — this policy must not be adopted directly for the product; terminate Worker to reclaim linear memory.
Ruling: retain uncommitted reviewable scripts and evidence in the attached isolated worktree — no production engine rewrite or publishing is authorized in phase 1 — integration remains a later phase.
Final review: independent fresh-context reviewer found P2 incomplete long-matrix coverage gate. Saved evidence itself was complete.
Final: fixed duplicated rows masking missing configurations/lengths/patterns — verification.test.mjs duplicate-evidence test RED→GREEN; acceptance + gate regression suite 4/4; current locked artifact verification passed.
Final: Ruling: production cache bounds, UI/DOM/error preservation, notices and CI remain deferred per approved phase-1 scope — this feasibility probe cannot be released as the product integration — next phase must supply those behaviors before release.
Final: Ruling: finite conversion parity and local fresh-build reproducibility stand as measured, not universal quality or cross-host claims — broader input/hardware variation remains unproven.
Task 3: complete — independent review finding fixed; all phase-1 gates passed. No deferred minor findings.
