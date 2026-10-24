# 貢獻指南 / Contributing

## 開發環境 / Development environment

使用 npm 與 package.json 的 engines 所列 Node.js 版本：^22.22.2、^24.15.0 或 >=26.0.0；CI 使用 Node.js 24。RTK 是選用的本機工具。
Use npm and a Node.js version allowed by package.json engines: ^22.22.2, ^24.15.0, or >=26.0.0. CI uses Node.js 24. RTK is optional local tooling.

```sh
npm ci --ignore-scripts
node_modules/.bin/wxt prepare
npm run dev
```

Firefox 與 Edge 開發模式分別使用 npm run dev:firefox 與 npm run dev:edge。WXT 將開發輸出寫入對應目錄，須手動載入及重新整理瀏覽器；目前停用自動啟動瀏覽器。
Use npm run dev:firefox or npm run dev:edge for those browsers. WXT writes development output to the corresponding directory. Load and reload the extension manually; automatic browser launch is disabled.

| 瀏覽器 / Browser | 建置 / Build          | 輸出 / Output        |
| ---------------- | --------------------- | -------------------- |
| Chrome           | npm run build:chrome  | .output/chrome-mv3/  |
| Firefox          | npm run build:firefox | .output/firefox-mv3/ |
| Edge             | npm run build:edge    | .output/edge-mv3/    |

Chrome 與 Edge 在擴充功能管理頁啟用開發人員模式，載入對應的未封裝目錄。Firefox 在 about:debugging 載入 firefox-mv3/manifest.json 作為暫用附加元件；目前沒有已簽署 XPI。
In Chrome or Edge, enable developer mode in extension management and load the matching unpacked directory. In Firefox, use about:debugging to load firefox-mv3/manifest.json as a temporary add-on; no signed XPI is currently provided.

## 驗證與封裝 / Verification and packaging

提交 PR 前執行完整檢查，包含官方資產雜湊、ESLint、TypeScript、Vitest，以及三個瀏覽器的建置與產物驗證。
Before opening a PR, run the complete gate: official asset hashes, ESLint, TypeScript, Vitest, and builds plus artifact verification for all three browsers.

```sh
npm run ci
```

個別檢查與格式檢查 / Individual checks and formatting:

```sh
npm run lint
npm run typecheck
npm test
npm run format:check
node scripts/verify-build-output.mjs chrome
node scripts/verify-official-assets.mjs chrome
```

單一產物驗證須先建置該目標。介面修改另以實際瀏覽器確認操作、明暗主題及狀態訊息；單元測試不能證明商店或實機相容性。
Build a target before verifying its artifacts. For UI changes, also check interaction, light/dark themes, and status messages in a browser. Unit tests do not establish store or live-browser compatibility.

npm run dist 重新建置並封裝三個目標；npm run package:built 只封裝既有產物，應在完整檢查通過後使用。後者會拒絕缺漏、無效或版本不一致的建置。
npm run dist rebuilds and packages all targets. npm run package:built packages existing outputs and should follow a successful complete gate; it rejects missing, invalid, or version-mismatched builds.

封裝輸出位於 .output/：opencc.chrome.zip、opencc.firefox.zip、opencc.edge.zip；package:built 另產生 SHA256SUMS。
Packages are written to .output/: opencc.chrome.zip, opencc.firefox.zip, and opencc.edge.zip. package:built also produces SHA256SUMS.

## 修改與提交 / Changes and pull requests

以 main 為基礎建立分支，集中處理一項問題，提交訊息使用 feat:、fix:、docs: 等前綴，向 main 提出 PR。保留既有未提交修改。
Create a branch from main, keep each change focused, use commit prefixes such as feat:, fix:, or docs:, and open a PR against main. Preserve existing uncommitted changes.

修改前先查看[術語](./GLOSSARY.md)；涉及執行流程或平台邊界時，閱讀[架構說明](./MV3_NOTES.md)。變更行為時同步更新相關測試與文件。
Consult the [glossary](./GLOSSARY.md) before changing terminology and the [architecture notes](./MV3_NOTES.md) for runtime or platform changes. Update relevant tests and documentation when behavior changes.

原生引擎比對另需安裝 scripts/opencc-feasibility 的依賴並執行 npm run verify:official:parity；重建程序見 [官方引擎指南](./scripts/opencc-feasibility/README.md)。
Native parity additionally requires dependencies under scripts/opencc-feasibility and npm run verify:official:parity; see the [official engine guide](./scripts/opencc-feasibility/README.md) for rebuilds.

CI 在每個 PR、main push 與手動執行時運作；dev push 不再單獨觸發。ci.yml 呼叫共用的 validate.yml，在 Ubuntu 與 Node.js 24 上平行執行品質檢查及 Chrome、Firefox、Edge 建置矩陣。品質工作執行 actionlint、官方資產雜湊、ESLint、TypeScript 與 Vitest；三個建置各自驗證產物與官方資產雜湊，全部成功後才下載並封裝。最終 verify 工作要求整個共用流程成功，失敗、略過或取消均不會通過。既有 official-parity 工作仍在 Windows 比對原生 OpenCC 與 Jieba，verify 亦要求此工作成功。
CI runs on every PR, main push, and manual dispatch; dev pushes no longer trigger separate runs. ci.yml calls validate.yml to run quality checks and a Chrome/Firefox/Edge build matrix in parallel on Ubuntu and Node.js 24. Quality runs actionlint, official asset hashes, ESLint, TypeScript, and Vitest. Each build verifies its output and official asset hashes; packaging downloads all three builds only after every check succeeds. The final verify job requires the entire reusable workflow to succeed; failure, skipping, or cancellation cannot pass it. The existing official-parity job still compares native OpenCC and Jieba on Windows, and verify also requires it to succeed.

成功執行會提供三個可安裝 ZIP 與 SHA256SUMS。PR 與準備流程手動觸發的發布分支產物保存 7 天，main 與其他手動執行保存 14 天；矩陣中繼產物採相同期限。重跑失敗工作時只取代該瀏覽器的中繼產物，最終套件名稱包含執行及嘗試編號。
Successful runs provide three installable ZIPs and SHA256SUMS. PR artifacts and explicitly dispatched release-branch artifacts are retained for 7 days; main and other manual artifacts are retained for 14 days. Matrix intermediates use the same retention. Failed-job reruns replace only the affected browser's intermediate output; final package names include the run and attempt numbers.

## 發布 / Releases

GitHub Release 與商店發布／Firefox 簽署分開處理；Firefox ID 為 opencc-extension@cf5146，尚未向 AMO 提交。詳見[維護與發布識別](./docs/maintainer-and-release-identity.md)。
GitHub releases are separate from store submission and Firefox signing. The Firefox ID opencc-extension@cf5146 has not been submitted to AMO. See [maintainer and release identity](./docs/maintainer-and-release-identity.md).

### 準備與審查 / Prepare and review

1. 在 main 執行 **Prepare release**。version 留空會選擇高於套件版本及現有標籤的下一個修補版本；亦可指定不含 v 的版本及附加說明。
   Run **Prepare release** on main. An empty version selects the next patch above the package version and existing tags. Alternatively, specify a version without v and optional notes.
2. 工作流程更新套件版本、鎖定檔與兩份版本文件，建立 codex/release-vX.Y.Z 分支及 PR，並手動觸發該分支的 CI。
   The workflow updates package versions, the lockfile, and both release documents, creates codex/release-vX.Y.Z and a PR, and explicitly dispatches CI for that branch.
3. 等待準備流程成功，審查差異與檢查結果後，透過正常 PR 流程合併；合併至 main 後會自動發布。重新執行準備流程會沿用現有分支，保留分支與 PR 說明的審查編輯，以新的 bot 留言記錄準備來源並重新觸發 CI，不會覆寫 PR 說明。
   Wait for preparation to succeed, review the diff and checks, and merge through the normal PR process; merging into main publishes automatically. Repeating preparation reuses the existing branch, preserves reviewed branch changes and PR prose, records refreshed provenance in a new bot comment, and dispatches CI again without replacing the PR description.

CHANGELOG.md 是精簡版本歷史；CHANGELOG_RELEASE.md 是發布程式讀取的最新說明，首行必須維持「## vX.Y.Z - YYYY-MM-DD」。CHANGELOG.md 的「# Changelog」標題也由產生器使用。準備流程會從提交訊息產生說明，審查時應整理成中英對照。
CHANGELOG.md holds concise version history. CHANGELOG_RELEASE.md is the current publication input and must begin with “## vX.Y.Z - YYYY-MM-DD”. The generator also relies on the “# Changelog” heading in CHANGELOG.md. Preparation generates notes from commits; edit them into bilingual form during review.

儲存庫須允許 GitHub Actions 建立 PR；準備流程使用 contents: write、pull-requests: write 與 actions: write。若組織政策禁止，先處理權限設定。
The repository must allow GitHub Actions to create PRs. Preparation uses contents: write, pull-requests: write, and actions: write. Resolve repository or organization policy restrictions before proceeding.

### 發布已審查的提交 / Publish the reviewed commit

1. **Release** 由 PR 合併至 main 自動觸發。資格閘要求同儲存庫的 codex/release-vX.Y.Z 分支、GitHub Actions bot 建立的 PR，以及 PR 初始說明或 bot 留言中的隱藏標記所對應的成功 main 手動準備執行。該執行還必須有成功的「Prepared release PR #N vX.Y.Z」工作回條，對應此 PR 與版本；人類留言與複製其他發布的標記無效。較新的失敗準備留言不會使既有有效來源失效。回條保存在 Actions 工作紀錄中，不依賴可過期的產物。一般 PR、fork PR 或單純修改版本不會發布。請保留來源標記與 bot 留言；既有未帶標記或回條的發布 PR，須在合併前重新執行準備流程。
   **Release** starts automatically when a PR merges into main. Eligibility requires a same-repository codex/release-vX.Y.Z branch, a PR authored by the GitHub Actions bot, and a hidden marker in the initial description or a bot comment referencing a successful preparation dispatch from main. That run must also contain a successful “Prepared release PR #N vX.Y.Z” receipt job matching this PR and version; human comments and markers copied from another release are insufficient. A newer failed preparation comment does not invalidate existing valid provenance. Receipts live in Actions job history rather than expiring artifacts. Ordinary PRs, fork PRs, and version edits alone do not publish. Preserve provenance markers and bot comments; rerun preparation before merging older release PRs that lack the marker or receipt.
2. 資格閘要求事件 SHA（github.sha）等於已審查的 merge_commit_sha；共用流程只簽出此固定事件 SHA，不接受可設定的簽出來源，重新執行完整品質檢查及三瀏覽器建置，並要求套件、鎖定檔、說明與分支版本相符。它不使用當下的 main 或 PR 測試產物。產物整理使用可信任的 Git 絕對路徑；託管流程設定 GIT_EXECUTABLE=/usr/bin/git。
   The eligibility gate requires the event SHA (github.sha) to equal the reviewed merge_commit_sha. The reusable workflow always checks out that immutable event SHA, with no configurable checkout ref, and reruns all quality checks and three-browser builds, and requires package, lockfile, notes, and branch versions to agree. It uses neither the current main tip nor PR test artifacts. Artifact staging uses a trusted absolute Git path; the hosted workflow sets GIT_EXECUTABLE=/usr/bin/git.
3. 獨立發布工作下載產物並驗證中繼資料與雜湊；建立版本標籤及草稿 Release，上傳並驗證遠端檔案後公開。
   A separate publication job downloads artifacts and validates metadata and hashes. It creates the version tag and draft release, then uploads and verifies remote assets before publishing.

只有獨立發布工作具有 contents: write；建置只有 contents: read，資格閘只有 actions: read 與 pull-requests: read。發布工作不執行儲存庫程式、不修改 main，也不自動上架瀏覽器商店。各發布 PR 使用獨立且不取消進行中執行的併發群組，避免其他版本取代等待中的發布。公開版本時明確使用 make_latest: legacy，讓 GitHub 依版本判定 Latest，避免較舊版本較晚完成時降級 Latest。
Only the isolated publication job has contents: write; builds have contents: read and eligibility has actions: read plus pull-requests: read. Publication executes no repository code, does not modify main, and does not submit to browser stores. Each release PR uses its own concurrency group without canceling active runs, so another version cannot replace its pending publication. Publishing explicitly uses make_latest: legacy so GitHub determines Latest by version, preventing an older release finishing later from downgrading Latest.

### 失敗復原 / Recovery

- 準備失敗：以相同版本重跑，沿用已建立的分支與 PR。
  Preparation failure: rerun with the same version to reuse the branch and PR.
- 發布失敗：在原執行使用 **Re-run failed jobs**，沿用成功建置的產物與提交；相符檔案會保留，缺漏檔案會補上。
  Publication failure: use **Re-run failed jobs** on the original run to reuse its successful build artifacts and commit. Matching assets are preserved and missing assets are uploaded.
- 不提供獨立的手動發布入口；不要為了復原改用最新 main。若資格閘失敗，檢查準備執行是否成功，以及 PR 初始說明或 bot 留言的標記是否完整。
  There is no standalone manual publishing trigger; do not switch recovery to the latest main. If eligibility fails, check the preparation run's success and the marker in the initial description or bot comments.
- 產物在 14 天後過期：重跑原執行的所有工作，重建原本鎖定的提交。
  After artifacts expire at 14 days, rerun all jobs in the original run to rebuild its frozen commit.
- 標籤指向其他提交、說明或檔案內容衝突：先查明差異；流程不會自動移動標籤或覆寫已發布檔案。
  If tags, notes, or asset bytes conflict, investigate the mismatch. Workflows do not move tags or overwrite published assets automatically.

本機測試不代表託管權限已驗證；首次使用時，維護者須確認分支保護的 verify 檢查、PR 建立、CI 觸發及產物下載權限。
Local tests do not establish hosted permissions. On first use, maintainers must confirm the verify branch-protection check, PR creation, CI dispatch, and artifact download permissions.

## 問題、安全與授權 / Issues, security, and license

一般問題請提供瀏覽器版本、重現步驟及錯誤訊息，使用本維護版本的[問題追蹤](https://github.com/cf5146/opencc-extension/issues)。敏感漏洞使用[私人漏洞回報](https://github.com/cf5146/opencc-extension/security/advisories/new)。貢獻採 MIT 授權並保留原作者聲明。
For ordinary issues, provide the browser version, reproduction steps, and errors. Use this fork’s issue tracker and private vulnerability reporting for sensitive issues. Contributions use MIT with original attribution retained.
