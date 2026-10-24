# GitHub Actions Implementation Plan / 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作已核准的 CI 與自動發布設計。Implement the approved CI and automatic release design.

**Architecture:** 共用唯讀驗證工作流程執行品質檢查、三瀏覽器建置與封裝；CI 彙總 verify，發布另有資格閘與獨立寫入工作。A reusable read-only workflow checks quality, builds three browsers and packages outputs; CI aggregates verify, while release has eligibility and isolated publication jobs.

**Tech Stack:** GitHub Actions, Node.js 24, npm, Vitest, actionlint.

**Spec:** ../specs/2026-10-23-github-actions-design.md

## Global Constraints / 全域限制

- 保留既有修改。Preserve pre-existing changes.
- 全 PR/main push；PR 7 天、main/release 14 天；Ubuntu/Node 24。All PRs/main pushes; PR retention 7 days, main/release 14 days; Ubuntu/Node 24.
- 確切合併 SHA、安全重試、唯讀建置、獨立 contents:write。Exact merge SHA, safe retries, read-only builds, isolated contents:write.
- 文件中英對照。Bilingual documentation.

## Review Focus / 審查重點

- 非發布或 fork PR 不得發布。Ordinary and fork PRs cannot publish.
- 偽造準備來源不得通過資格閘。Forged preparation provenance cannot pass eligibility.
- 失敗與略過的子工作不得讓 verify 通過。Failed/skipped dependencies cannot produce a green verify.
- 重試不漂移來源提交或產物名稱。Retries retain source commit and successful artifact identity.
- 平行產物下載必須保留三個瀏覽器目錄。Parallel artifact downloads preserve all three browser directories.

### Task 1: 共用驗證 / Shared validation

**Files:** .github/workflows/validate.yml, .github/workflows/ci.yml
**Interfaces:** Uses immutable github.sha; inputs artifact_prefix, retention_days, release_version; outputs artifact_name and version. / 使用固定事件 SHA；輸入產物前綴、保存天數、發布版本，輸出產物名稱與版本。

- [x] 建立品質工作、三瀏覽器矩陣、品質與建置成功後才封裝。Create quality, browser matrix and success-gated packaging jobs.
- [x] CI 呼叫共用流程並以 always() verify 檢查成功。Call it from CI and aggregate success with always() verify.
- [x] 執行 actionlint，檢查事件、權限與產物路徑。Run actionlint and inspect triggers, permissions and artifact paths.

### Task 2: 發布資格與重試 / Release eligibility and recovery

**Files:** scripts/prepare-release.mjs, tests/prepare-release.test.mjs, tests/release-eligibility.test.mjs, .github/workflows/prepare-release.yml, .github/workflows/release.yml
**Interfaces:** Preparation records verifiable provenance on the PR; eligibility binds the reviewed merge to github.sha and passes its version to Task 1. / 準備留下可驗證來源；資格閘確認合併與事件 SHA 一致，將版本傳入工作一。

- [x] 先新增準備來源與資格失敗測試並確認失敗。Write provenance and eligibility regressions and observe failure.
- [x] 實作準備來源及合併事件資格閘，保留原發布程式。Implement preparation provenance and merged-event eligibility while retaining the publisher.
- [x] 執行準備、資格、產物及發布測試。Run preparation, eligibility, artifact and publication tests; expect all green.

### Task 3: 文件與最終驗證 / Documentation and verification

**Files:** CONTRIBUTING.md and approved workflow/script/test files above.
**Interfaces:** Documents final triggers, artifact retention, release review and original-run recovery. / 說明最終觸發、保存、審查與原執行復原。

- [x] 局部更新雙語文件，保留既有內容。Update bilingual workflow sections without replacing unrelated edits.
- [x] 執行 npm run ci、封裝入口、actionlint 與變更檔格式檢查。Run the full gate, packaging entry point, actionlint and changed-file formatting; expect success.
- [x] 獨立審查差異並處理重要發現；不提交、推送或實際發布。Obtain independent review and resolve important findings; leave changes uncommitted and do not push/publish.

## 執行紀錄 / Execution record

使用目前的 codex 分支，保留未提交修改；使用者已核准實作，無需重複確認執行方式。
Use the current codex branch to preserve uncommitted work; implementation was explicitly approved, so no additional execution-choice prompt is needed.

獨立審查發現準備標記未綁定 PR；新增不可由 PR 文字偽造的 Actions 工作名稱回條，綁定 PR 編號及版本，並透過分頁 API 驗證。相較產物回條，此選擇不受產物保存期限限制。複製標記等四個回歸測試先失敗再通過。
Independent review found that preparation markers were not bound to a PR. Add a server-recorded Actions receipt job binding PR number and version, verified through the paginated jobs API. Unlike artifact receipts, this choice does not expire with artifacts. Four copied-marker/receipt regressions failed before the fix and passed after it.

Windows 沙箱內的 Git 暫存 push 遭遇 waitpid 錯誤；同一測試在沙箱外可重現預期失敗並通過修正。最終完整驗證使用沙箱外執行，不變更產品 Git 行為。
Temporary Git pushes encounter a waitpid error inside the Windows sandbox. The same test outside the sandbox reproduced the intended regression and passed after the fix. Run final full verification outside the sandbox without changing product Git behavior.

最終 npm run ci 通過：220 個測試、ESLint、TypeScript 與三個瀏覽器的建置及驗證。既有空的 legacy convert 測試檔維持略過。封裝入口 node scripts/package-built.mjs、actionlint 1.7.12 與變更檔 Prettier 檢查通過；actionlint 的選用 ShellCheck/Pyflakes 未執行。實際 GitHub 權限、事件觸發與發布尚未在託管環境驗證。
Final npm run ci passed: 220 tests, ESLint, TypeScript and all three browser builds/verifications. The pre-existing empty legacy convert suite remains skipped. Packaging via node scripts/package-built.mjs, actionlint 1.7.12 and changed-file Prettier checks passed; optional ShellCheck/Pyflakes were not run. Actual GitHub permissions, event dispatch and publication remain unverified in the hosted environment.

後續審查修正：準備重跑改以 bot 留言補充來源，不再覆寫 PR 說明；資格閘同時支援 bot 留言與初始說明標記，仍要求相符的準備回條。發布改用 make_latest: legacy，避免較舊版本最後完成時降級 Latest。審查者筆記覆寫與版本順序回歸先失敗再通過；49 個相關測試及獨立修正審查通過。
Review follow-up fixes: preparation retries append bot provenance comments instead of replacing PR descriptions. Eligibility accepts bot comments and initial-description markers while still requiring a matching preparation receipt. Publishing uses make_latest: legacy so an older release finishing last cannot downgrade Latest. Reviewer-note and release-order regressions failed before the fixes and passed afterward; all 49 focused tests and independent fix review passed.

修正後完整 npm run ci 通過：225 個測試與三瀏覽器建置驗證；actionlint 與變更檔格式檢查亦通過。既有空的 legacy 測試仍略過，託管發布未執行。
After these fixes, npm run ci passed all 225 tests and three-browser build verification. Actionlint and changed-file formatting also passed. The pre-existing empty legacy suite remains skipped; no hosted release was performed.

PR 整合：使用者後續授權建立 PR；在隔離分支以 main 的 71ab831（v0.6.2）為基礎，只移入 Actions 相關修改，保留主工作目錄的既有編輯。保留目前 main 的官方資產雜湊與 Windows 原生 parity，最終 verify 同時要求共用驗證及 parity 成功。
PR integration: the user subsequently authorized PR creation. Base the isolated branch on main at 71ab831 (v0.6.2), transfer only Actions changes, and preserve edits in the original checkout. Retain current main's official asset hashes and Windows native parity; final verify requires both shared validation and parity to succeed.

整合驗證：npm run ci 通過 300 個測試與三瀏覽器建置、manifest 及 32 個官方資產雜湊驗證；原生 parity 通過 779 個案例與 40 組完整長輸入比對。封裝、actionlint、格式檢查及獨立整合審查均通過。沒有修改套件版本、引擎程式或託管設定。
Integration verification: npm run ci passed 300 tests plus all three browser builds, manifest checks and 32 official asset hashes. Native parity passed 779 cases and 40 complete long-input comparisons. Packaging, actionlint, formatting and independent integration review passed. Package versions, engine code and hosted settings remain unchanged.

CodeQL 修正：移除可設定的 source_ref，所有共用工作固定簽出 github.sha。發布資格閘另外拒絕事件 SHA 與已審查合併提交不一致的執行；此回歸先失敗再通過。不停用快取，也不略過安全掃描。
CodeQL fix: remove configurable source_ref and pin every shared checkout to github.sha. Release eligibility rejects any event SHA differing from the reviewed merge commit; the regression failed before the guard and passed afterward. Keep caching and security scanning enabled.

此修正的 npm run ci 通過 301 個測試與全部瀏覽器建置、manifest 及官方資產雜湊檢查；actionlint、格式與獨立修正審查通過。託管 CodeQL 結果需在推送後確認。
For this fix, npm run ci passed 301 tests and all browser builds, manifest checks and official asset hashes. Actionlint, formatting and independent fix review passed. Confirm hosted CodeQL after pushing.
